import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signedAssertion, type ServiceAccount } from '../../scripts/visibility/google-auth.ts';
import { parseKnowledgeGraph } from '../../scripts/visibility/knowledge-graph.ts';
import { parseLighthouseResult, parsePageSpeed } from '../../scripts/visibility/performance.ts';
import { collectSearchConsole, periods, SearchConsoleClient, toInspection, toTotals } from '../../scripts/visibility/search-console.ts';

afterEach(() => vi.unstubAllGlobals());

const lhr = {
  categories: { performance: { score: 0.97 }, seo: { score: 1 }, accessibility: { score: 1 }, 'best-practices': { score: 0.96 } },
  audits: { 'largest-contentful-paint': { numericValue: 2522.4 }, 'cumulative-layout-shift': { numericValue: 0.00012 }, 'total-blocking-time': { numericValue: 12.6 } },
};

describe('compte de service Google', () => {
  it('signe une assertion JWT vérifiable avec la clé publique', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const account: ServiceAccount = {
      type: 'service_account',
      client_email: 'visibilite@tableau-immo-visibilite.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      token_uri: 'https://oauth2.googleapis.com/token',
    };
    const jwt = signedAssertion(account, 'https://www.googleapis.com/auth/webmasters', 1_000);
    const [header, claims, signature] = jwt.split('.');
    expect(JSON.parse(Buffer.from(header ?? '', 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(claims ?? '', 'base64url').toString())).toEqual({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters',
      aud: account.token_uri,
      iat: 1_000,
      exp: 4_600,
    });
    const valid = createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature ?? '', 'base64url'));
    expect(valid).toBe(true);
  });
});

describe('Search Console', () => {
  it('compare les 28 derniers jours disponibles aux 28 jours précédents', () => {
    expect(periods(new Date('2026-10-14T10:00:00Z'))).toEqual({
      actuel: { debut: '2026-09-14', fin: '2026-10-11' },
      precedent: { debut: '2026-08-17', fin: '2026-09-13' },
    });
  });

  it('interprète l’inspection d’URL', () => {
    expect(
      toInspection('https://tableauimmo.github.io/', {
        inspectionResult: {
          indexStatusResult: { verdict: 'PASS', coverageState: 'Envoyée et indexée', lastCrawlTime: '2026-10-13T08:00:00Z', googleCanonical: 'https://tableauimmo.github.io/' },
          richResultsResult: { detectedItems: [{ richResultType: 'FAQ' }, { richResultType: 'Videos' }] },
        },
      }),
    ).toEqual({ url: 'https://tableauimmo.github.io/', verdict: 'PASS', etat: 'Envoyée et indexée', indexee: true, derniereExploration: '2026-10-13T08:00:00Z', canoniqueGoogle: 'https://tableauimmo.github.io/', resultatsEnrichis: ['FAQ', 'Videos'] });
    expect(toInspection('https://tableauimmo.github.io/outils/', {})).toMatchObject({ indexee: false, etat: 'inconnu', resultatsEnrichis: [] });
    expect(toTotals(undefined)).toEqual({ clics: 0, impressions: 0, ctr: 0, position: 0 });
  });

  it('interroge l’API avec le jeton, la bonne propriété et les bonnes dimensions', async () => {
    const calls: { url: string; method: string; body: unknown; auth: string | null }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init.method ?? 'GET', body, auth: new Headers(init.headers).get('Authorization') });
      if (url.endsWith('/sitemaps')) return Response.json({ sitemap: [{ path: 'https://tableauimmo.github.io/sitemap-index.xml', isPending: false, errors: '0', warnings: '1', lastDownloaded: '2026-10-14T00:00:00Z' }] });
      if (url.includes('urlInspection')) return Response.json({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Détectée, actuellement non indexée' } } });
      const dimensions: string[] = body.dimensions;
      if (dimensions.length === 0) return Response.json({ rows: [{ clicks: 12, impressions: 340, ctr: 0.035, position: 8.2 }] });
      return Response.json({ rows: [{ keys: dimensions.map((dimension) => `${dimension}-1`), clicks: 3, impressions: 90, ctr: 0.033, position: 6.4 }] });
    });
    const client = new SearchConsoleClient('jeton-test', 'sc-domain:tableauimmo.fr');
    const data = await collectSearchConsole(client, ['https://tableauimmo.github.io/outils/'], new Date('2026-10-14T10:00:00Z'));

    expect(calls.every((call) => call.auth === 'Bearer jeton-test')).toBe(true);
    const analytics = calls.filter((call) => call.url.includes('searchAnalytics'));
    expect(analytics[0]?.url).toBe('https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Atableauimmo.fr/searchAnalytics/query');
    expect(analytics.map((call) => (call.body as { dimensions: string[] }).dimensions)).toEqual([[], [], ['query'], ['page'], ['query', 'page'], ['query']]);
    expect(calls.find((call) => call.url.includes('urlInspection'))?.body).toEqual({ inspectionUrl: 'https://tableauimmo.github.io/outils/', siteUrl: 'sc-domain:tableauimmo.fr', languageCode: 'fr-FR' });

    expect(data.totaux.actuel).toEqual({ clics: 12, impressions: 340, ctr: 0.035, position: 8.2 });
    expect(data.requetesPages[0]?.cles).toEqual(['query-1', 'page-1']);
    expect(data.sitemaps).toEqual([{ chemin: 'https://tableauimmo.github.io/sitemap-index.xml', luLe: '2026-10-14T00:00:00Z', erreurs: 0, avertissements: 1, enAttente: false }]);
    expect(data.inspections[0]).toMatchObject({ indexee: false, etat: 'Détectée, actuellement non indexée' });
  });

  it('une erreur d’autorisation remonte avec l’explication de Google', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: { message: 'User does not have sufficient permission for site' } }, { status: 403 }));
    const client = new SearchConsoleClient('jeton-test', 'sc-domain:tableauimmo.fr');
    await expect(client.sitemaps()).rejects.toThrow(/HTTP 403.*sufficient permission/);
  });
});

describe('performance', () => {
  it('convertit un résultat Lighthouse en scores sur 100', () => {
    expect(parseLighthouseResult(lhr, 'https://tableauimmo.github.io/', 'lighthouse-local')).toEqual({
      source: 'lighthouse-local',
      url: 'https://tableauimmo.github.io/',
      scores: { performance: 97, seo: 100, accessibilite: 100, bonnesPratiques: 96 },
      lcpMs: 2522,
      cls: 0,
      tbtMs: 13,
    });
    expect(() => parseLighthouseResult({}, 'https://tableauimmo.github.io/', 'pagespeed')).toThrow(/inattendu/);
  });

  it('ajoute les données réelles des visiteurs quand PageSpeed en a', () => {
    const withField = parsePageSpeed(
      { lighthouseResult: lhr, loadingExperience: { overall_category: 'FAST', metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1800 }, INTERACTION_TO_NEXT_PAINT: { percentile: 90 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 2 } } } },
      'https://tableauimmo.github.io/',
    );
    expect(withField.terrain).toEqual({ categorie: 'FAST', lcpMs: 1800, inpMs: 90, cls: 0.02 });
    expect(parsePageSpeed({ lighthouseResult: lhr, loadingExperience: { id: 'x' } }, 'https://tableauimmo.github.io/').terrain).toBeUndefined();
  });
});

describe('Knowledge Graph', () => {
  it('détecte si Google connaît la marque comme entité', () => {
    const payload = { itemListElement: [{ resultScore: 12.5, result: { name: 'Tableau Immo', '@type': ['Organization', 'Thing'], description: 'Chaîne vidéo' } }] };
    expect(parseKnowledgeGraph(payload, 'tableau immo')).toEqual({ reconnu: true, entites: [{ nom: 'Tableau Immo', types: ['Organization', 'Thing'], score: 12.5, description: 'Chaîne vidéo' }] });
    expect(parseKnowledgeGraph({}, 'tableau immo')).toEqual({ reconnu: false, entites: [] });
  });
});
