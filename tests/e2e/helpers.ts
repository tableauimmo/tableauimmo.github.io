import { expect, type ConsoleMessage, type Page, type Request } from '@playwright/test';

/** Pages du site, lues dans le sitemap (source de vérité de ce qui est publié). */
export async function sitemapPaths(page: Page): Promise<string[]> {
  const response = await page.request.get('/sitemap-0.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? '').pathname);
}

/** Collecte les erreurs de console, les requêtes en échec et les réponses 4xx/5xx du site pendant un test. */
export function watchErrors(page: Page, baseURL: string | undefined): { errors: string[] } {
  const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request: Request) => {
    const url = request.url();
    // Le lecteur YouTube (domaine externe) peut être bloqué hors ligne : ce n'est pas une erreur du site.
    if (/youtube-nocookie\.com|youtube\.com|googlevideo|ytimg|doubleclick|google/.test(url)) return;
    errors.push(`requête en échec : ${url} (${request.failure()?.errorText ?? '?'})`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === origin) errors.push(`HTTP ${response.status()} : ${response.url()}`);
  });
  return { errors };
}

export interface JsonLdGraph {
  '@context': string;
  '@graph': { '@type': string | string[]; [key: string]: unknown }[];
}

export async function jsonLd(page: Page): Promise<JsonLdGraph> {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(raw, 'JSON-LD présent').toBeTruthy();
  return JSON.parse(raw ?? '{}') as JsonLdGraph;
}

export function nodesOfType(graph: JsonLdGraph, type: string): JsonLdGraph['@graph'] {
  return graph['@graph'].filter((node) => (Array.isArray(node['@type']) ? node['@type'].includes(type) : node['@type'] === type));
}

/** Texte avec des espaces simples (le site utilise des espaces insécables à la française). */
export function plain(text: string | null | undefined): string {
  return (text ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Largeur de page qui dépasse l'écran (0 = aucun défilement horizontal). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
