// Google Search Console : requêtes et pages qui amènent des visiteurs, état des sitemaps,
// et inspection d'URL (la page est-elle indexée ? quels résultats enrichis Google y voit-il ?).
import { fetchWithRetry } from '../lib/http.ts';
import { mapLimit } from './concurrency.ts';
import type { SearchConsoleData, SearchRow, SearchTotals } from './schema.ts';

export const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters';
const API = 'https://searchconsole.googleapis.com';
/** Les données de Search Console arrivent avec environ 3 jours de retard. */
const DATA_DELAY_DAYS = 3;
const PERIOD_DAYS = 28;
const INSPECTION_CONCURRENCY = 3;

const DAY_MS = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export interface Period {
  debut: string;
  fin: string;
}

/** Les 28 derniers jours disponibles et les 28 jours d'avant, pour comparer. */
export function periods(now: Date): { actuel: Period; precedent: Period } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DATA_DELAY_DAYS * DAY_MS);
  const start = new Date(end.getTime() - (PERIOD_DAYS - 1) * DAY_MS);
  const previousEnd = new Date(start.getTime() - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (PERIOD_DAYS - 1) * DAY_MS);
  return { actuel: { debut: isoDay(start), fin: isoDay(end) }, precedent: { debut: isoDay(previousStart), fin: isoDay(previousEnd) } };
}

interface ApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export function toRows(rows: ApiRow[] | undefined): SearchRow[] {
  return (rows ?? []).map((row) => ({
    cles: row.keys ?? [],
    clics: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export function toTotals(rows: ApiRow[] | undefined): SearchTotals {
  const [row] = toRows(rows);
  return row ? { clics: row.clics, impressions: row.impressions, ctr: row.ctr, position: row.position } : { clics: 0, impressions: 0, ctr: 0, position: 0 };
}

interface ApiInspection {
  inspectionResult?: {
    indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string; googleCanonical?: string };
    richResultsResult?: { detectedItems?: { richResultType?: string }[] };
  };
}

export function toInspection(url: string, payload: ApiInspection): SearchConsoleData['inspections'][number] {
  const status = payload.inspectionResult?.indexStatusResult ?? {};
  const verdict = status.verdict ?? 'VERDICT_UNSPECIFIED';
  return {
    url,
    verdict,
    etat: status.coverageState ?? 'inconnu',
    indexee: verdict === 'PASS',
    ...(status.lastCrawlTime ? { derniereExploration: status.lastCrawlTime } : {}),
    ...(status.googleCanonical ? { canoniqueGoogle: status.googleCanonical } : {}),
    resultatsEnrichis: (payload.inspectionResult?.richResultsResult?.detectedItems ?? []).map((item) => item.richResultType ?? '?'),
  };
}

export class SearchConsoleClient {
  readonly #token: string;
  readonly #property: string;

  constructor(token: string, property: string) {
    this.#token = token;
    this.#property = property;
  }

  async #request<T>(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<T> {
    const response = await fetchWithRetry(`${API}${path}`, {
      method,
      timeoutMs: 30_000,
      headers: { Authorization: `Bearer ${this.#token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  #sitePath(suffix: string): string {
    return `/webmasters/v3/sites/${encodeURIComponent(this.#property)}${suffix}`;
  }

  async searchAnalytics(period: Period, dimensions: string[], rowLimit: number): Promise<ApiRow[]> {
    const payload = await this.#request<{ rows?: ApiRow[] }>(this.#sitePath('/searchAnalytics/query'), 'POST', {
      startDate: period.debut,
      endDate: period.fin,
      dimensions,
      rowLimit,
    });
    return payload.rows ?? [];
  }

  async sitemaps(): Promise<SearchConsoleData['sitemaps']> {
    const payload = await this.#request<{ sitemap?: { path?: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean; errors?: string; warnings?: string }[] }>(
      this.#sitePath('/sitemaps'),
      'GET',
    );
    return (payload.sitemap ?? []).map((sitemap) => ({
      chemin: sitemap.path ?? '?',
      ...(sitemap.lastSubmitted ? { soumisLe: sitemap.lastSubmitted } : {}),
      ...(sitemap.lastDownloaded ? { luLe: sitemap.lastDownloaded } : {}),
      erreurs: Number(sitemap.errors ?? 0),
      avertissements: Number(sitemap.warnings ?? 0),
      enAttente: Boolean(sitemap.isPending),
    }));
  }

  async submitSitemap(sitemapUrl: string): Promise<void> {
    await this.#request(this.#sitePath(`/sitemaps/${encodeURIComponent(sitemapUrl)}`), 'PUT');
  }

  async inspect(url: string): Promise<SearchConsoleData['inspections'][number]> {
    const payload = await this.#request<ApiInspection>('/v1/urlInspection/index:inspect', 'POST', {
      inspectionUrl: url,
      siteUrl: this.#property,
      languageCode: 'fr-FR',
    });
    return toInspection(url, payload);
  }
}

export async function collectSearchConsole(client: SearchConsoleClient, inspectUrls: string[], now: Date): Promise<SearchConsoleData> {
  const { actuel, precedent } = periods(now);
  const [totalsNow, totalsBefore, queries, pages, queryPages, previousQueries, sitemaps] = await Promise.all([
    client.searchAnalytics(actuel, [], 1),
    client.searchAnalytics(precedent, [], 1),
    client.searchAnalytics(actuel, ['query'], 250),
    client.searchAnalytics(actuel, ['page'], 250),
    client.searchAnalytics(actuel, ['query', 'page'], 1000),
    client.searchAnalytics(precedent, ['query'], 250),
    client.sitemaps(),
  ]);
  const inspections = await mapLimit(inspectUrls, INSPECTION_CONCURRENCY, (url) => client.inspect(url));
  return {
    periode: actuel,
    periodePrecedente: precedent,
    totaux: { actuel: toTotals(totalsNow), precedent: toTotals(totalsBefore) },
    requetes: toRows(queries),
    pages: toRows(pages),
    requetesPages: toRows(queryPages),
    requetesPrecedentes: toRows(previousQueries),
    sitemaps,
    inspections,
  };
}
