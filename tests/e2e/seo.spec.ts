// Référencement (SEO) et moteurs de réponse (GEO) sur le site réel.
import { expect, test } from '@playwright/test';
import { SITE } from '../../site.config.mjs';
import { jsonLd, nodesOfType } from './helpers.ts';

const ROOT = `${SITE.url}${SITE.base.replace(/\/$/, '')}`;

test('robots.txt admet explicitement les robots de recherche et d’IA, et annonce les sitemaps', async ({ request }) => {
  const body = await (await request.get('/robots.txt')).text();
  for (const bot of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Claude-SearchBot', 'Applebot']) {
    expect(body).toContain(`User-agent: ${bot}\nAllow: /`);
  }
  expect(body).toContain('User-agent: *\nAllow: /');
  expect(body).toContain(`Sitemap: ${ROOT}/sitemap-index.xml`);
  expect(body).not.toMatch(/Disallow: \/\s/);
});

test('sitemap : toutes les pages publiques, sans la 404', async ({ request }) => {
  const index = await (await request.get('/sitemap-index.xml')).text();
  expect(index).toContain(`${ROOT}/sitemap-0.xml`);
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  for (const path of ['/', '/episodes/', '/outils/', '/outils/capacite-emprunt/', '/lexique/', '/lexique/jeanbrun/', '/categories/fiscalite/', '/methode/', '/plan-du-site/']) {
    expect(sitemap).toContain(`<loc>${ROOT}${path}</loc>`);
  }
  expect(sitemap).not.toContain('404');
});

test('sitemap vidéo : annoncé seulement s’il contient au moins une vidéo', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  const response = await request.get('/video-sitemap.xml');
  if (response.status() === 404) {
    expect(robots).not.toContain('video-sitemap.xml');
    return;
  }
  expect(await response.text()).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
  expect(robots).toContain(`Sitemap: ${ROOT}/video-sitemap.xml`);
});

test('flux RSS, manifeste, llms.txt et llms-full.txt', async ({ request }) => {
  const rss = await (await request.get('/rss.xml')).text();
  expect(rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(rss).toContain('<language>fr-FR</language>');

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Tableau Immo', lang: 'fr' });
  for (const icon of manifest.icons as { src: string }[]) expect((await request.get(icon.src)).status(), icon.src).toBe(200);

  const llms = await (await request.get('/llms.txt')).text();
  expect(llms).toContain('# Tableau Immo');
  expect(llms).toContain(`${ROOT}/outils/mensualite-credit-immobilier/`);
  expect(llms).toContain(`${ROOT}/lexique/lmnp/`);
  const full = await (await request.get('/llms-full.txt')).text();
  expect(full).toContain('### Dispositif Jeanbrun (Statut du bailleur privé)');
  expect(full).toContain('**Définition :**');
  expect(full).toContain(`](${ROOT}/lexique/`);
  expect(full.length).toBeGreaterThan(40_000);
});

test('images de partage : présentes et servies', async ({ page, request }) => {
  for (const path of ['/', '/outils/rendement-locatif/', '/lexique/dpe/']) {
    await page.goto(path);
    const image = (await page.locator('meta[property="og:image"]').getAttribute('content')) ?? '';
    expect(image.startsWith(`${ROOT}/og/`), path).toBe(true);
    expect((await request.get(new URL(image).pathname)).status(), image).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ROOT}${path}`);
  }
});

test('politique de sécurité : scripts verrouillés, lecteur youtube-nocookie autorisé', async ({ page }) => {
  await page.goto('/');
  const csp = (await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content')) ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toMatch(/script-src 'self' 'sha256-/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(csp).toContain('frame-src https://www.youtube-nocookie.com');
});

test('lexique : DefinedTermSet sur l’index, DefinedTerm relié sur chaque terme', async ({ page }) => {
  await page.goto('/lexique/');
  const [set] = nodesOfType(await jsonLd(page), 'DefinedTermSet');
  expect((set?.hasDefinedTerm as unknown[]).length).toBe(30);
  await page.goto('/lexique/lmnp/');
  const graph = await jsonLd(page);
  const [term] = nodesOfType(graph, 'DefinedTerm');
  expect(term).toMatchObject({ name: 'LMNP', url: `${ROOT}/lexique/lmnp/`, inDefinedTermSet: { '@id': `${ROOT}/lexique/#lexique` } });
  expect(term?.alternateName).toContain('Loueur en meublé non professionnel');
  const breadcrumb = nodesOfType(graph, 'BreadcrumbList')[0] as { itemListElement: { name: string }[] } | undefined;
  expect(breadcrumb?.itemListElement.map((item) => item.name)).toEqual(['Accueil', 'Lexique', 'LMNP']);
  await expect(page.locator('.callout--warning').first()).toContainText('À surveiller');
});

test('calculateurs : FAQ structurée et date de vérification', async ({ page }) => {
  await page.goto('/outils/capacite-emprunt/');
  const [faq] = nodesOfType(await jsonLd(page), 'FAQPage');
  expect((faq?.mainEntity as unknown[]).length).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.tool__updated')).toContainText('vérifiées le');
});

/** Toutes les entités « Person » des données structurées, à n'importe quelle profondeur. */
function personsIn(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(personsIn);
  if (value === null || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  const children = Object.values(node).flatMap(personsIn);
  return node['@type'] === 'Person' ? [node, ...children] : children;
}

test('identité : signé « Tableau Immo », aucune personne, aucun lien avec d’autres activités', async ({ page, request }) => {
  for (const path of ['/', '/a-propos/', '/mentions-legales/', '/lexique/lmnp/', '/outils/']) {
    await page.goto(path);
    await expect(page.locator('meta[name="author"]'), path).toHaveAttribute('content', 'Tableau Immo');
    const graph = await jsonLd(page);
    expect(personsIn(graph), path).toEqual([]);
    const [organization] = nodesOfType(graph, 'Organization');
    expect(organization).toMatchObject({ name: 'Tableau Immo', email: 'tableauimmo@gmail.com' });
    await expect(page.locator('.site-footer__copy'), path).toHaveText(/^© \d{4} Tableau Immo$/);
  }
  const full = await (await request.get('/llms-full.txt')).text();
  for (const [, url] of full.matchAll(/(https:\/\/[^\s)]+)/g)) expect(allowedHost(url ?? ''), url).toBe(true);
});

/** Seuls domaines vers lesquels le site renvoie : la chaîne, ses réseaux, les sources officielles, l'hébergeur. */
const ALLOWED_HOSTS = [
  new URL(SITE.url).hostname,
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'linkedin.com',
  'x.com',
  'legifrance.gouv.fr',
  'impots.gouv.fr',
  'economie.gouv.fr',
  'service-public.fr',
  'anil.org',
  'ecologie.gouv.fr',
  'inc-conso.fr',
  'banque-france.fr',
  'insee.fr',
  'paris.notaires.fr',
  'github.com',
];

function allowedHost(url: string): boolean {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

test('aucun lien vers un site étranger à la chaîne (réseaux, sources officielles, hébergeur seulement)', async ({ page }) => {
  test.setTimeout(120_000);
  const sitemap = await (await page.request.get('/sitemap-0.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? '').pathname);
  for (const path of paths) {
    await page.goto(path);
    const links = await page.locator('a[href^="http"]').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
    for (const link of links) expect(allowedHost(link), `${path} → ${link}`).toBe(true);
  }
});
