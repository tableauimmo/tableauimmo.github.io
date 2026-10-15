// Audit technique du site en ligne : toutes les pages du sitemap, les fichiers pour les robots et les liens internes.
import { XMLParser } from 'fast-xml-parser';
import { ELEMENT_NODE, parse, TEXT_NODE, walkSync, type DocumentNode, type ElementNode } from 'ultrahtml';
import { fetchWithRetry, HttpError } from '../lib/http.ts';
import { mapLimit } from './concurrency.ts';
import type { Issue, PageAudit, SiteAudit, VisibilityConfig } from './schema.ts';

const CONCURRENCY = 4;
const TITLE_MAX = 70;
const TITLE_MIN = 15;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;
const THIN_CONTENT_WORDS = 120;
const SLOW_RESPONSE_MS = 1500;
const IGNORED_TEXT_PARENTS = new Set(['script', 'style', 'noscript', 'template', 'svg']);

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const xmlParser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === 'url' || name === 'sitemap', parseTagValue: false });

/** Adresses listées par un sitemap ou un index de sitemaps. */
export function parseSitemap(xml: string): { pages: string[]; sitemaps: string[] } {
  const document: { urlset?: { url?: { loc?: string }[] }; sitemapindex?: { sitemap?: { loc?: string }[] } } = xmlParser.parse(xml);
  if (!document.urlset && !document.sitemapindex) throw new Error('Sitemap invalide : ni <urlset> ni <sitemapindex>');
  const locs = (entries: { loc?: string }[] | undefined) => (entries ?? []).map((entry) => (entry.loc ?? '').trim()).filter(Boolean);
  return { pages: locs(document.urlset?.url), sitemaps: locs(document.sitemapindex?.sitemap) };
}

function isElement(node: unknown): node is ElementNode {
  return typeof node === 'object' && node !== null && (node as { type?: number }).type === ELEMENT_NODE;
}

function insideIgnoredElement(node: { parent?: unknown }): boolean {
  let current: unknown = node.parent;
  while (isElement(current)) {
    if (IGNORED_TEXT_PARENTS.has(current.name)) return true;
    current = current.parent;
  }
  return false;
}

function insideElement(node: { parent?: unknown }, name: string): boolean {
  let current: unknown = node.parent;
  while (isElement(current)) {
    if (current.name === name) return true;
    current = current.parent;
  }
  return false;
}

function textOf(element: ElementNode): string {
  let text = '';
  walkSync(element, (node) => {
    if (node.type === TEXT_NODE && !insideIgnoredElement(node)) text += ` ${node.value}`;
  });
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/** Normalise un lien interne (sans fragment) ou renvoie null s'il pointe hors du site. */
export function internalLink(href: string, pageUrl: string, origin: string): string | null {
  if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return null;
  let url: URL;
  try {
    url = new URL(decodeEntities(href), pageUrl);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  url.hash = '';
  return url.href;
}

export interface PageAnalysis {
  page: PageAudit;
  links: string[];
  issues: Issue[];
}

/** Analyse une page HTML : balises SEO, données structurées, contenu, images et liens internes. */
export function analysePage(url: string, status: number, durationMs: number, html: string, origin: string): PageAnalysis {
  const document = parse(html) as DocumentNode;
  const issues: Issue[] = [];
  const add = (severite: Issue['severite'], code: string, message: string) => issues.push({ severite, code, url, message });

  let title = '';
  let description = '';
  let canonical = '';
  let robots = '';
  let ogImage = false;
  let h1 = 0;
  let lang = '';
  let imagesWithoutAlt = 0;
  let main: ElementNode | undefined;
  const jsonLdTypes: string[] = [];
  const links = new Set<string>();

  walkSync(document, (node) => {
    if (!isElement(node)) return;
    const attributes = node.attributes;
    switch (node.name) {
      case 'html':
        lang = attributes.lang ?? '';
        break;
      case 'title':
        if (!insideElement(node, 'svg')) title = textOf(node);
        break;
      case 'meta':
        if (attributes.name === 'description') description = decodeEntities(attributes.content ?? '').trim();
        if (attributes.name === 'robots') robots = attributes.content ?? '';
        if (attributes.property === 'og:image' && attributes.content) ogImage = true;
        break;
      case 'link':
        if (attributes.rel === 'canonical') canonical = decodeEntities(attributes.href ?? '');
        break;
      case 'h1':
        h1 += 1;
        break;
      case 'main':
        main ??= node;
        break;
      case 'img':
        if (!('alt' in attributes)) imagesWithoutAlt += 1;
        break;
      case 'a': {
        const target = attributes.href ? internalLink(attributes.href, url, origin) : null;
        if (target) links.add(target);
        break;
      }
      case 'script':
        if (attributes.type === 'application/ld+json') {
          const raw = node.children.map((child) => (child.type === TEXT_NODE ? child.value : '')).join('');
          try {
            const data: unknown = JSON.parse(raw);
            const graph = (data as { '@graph'?: unknown[] })['@graph'] ?? [data];
            for (const item of graph) {
              const type = (item as { '@type'?: unknown })['@type'];
              for (const name of Array.isArray(type) ? type : [type]) if (typeof name === 'string') jsonLdTypes.push(name);
            }
          } catch {
            add('erreur', 'jsonld-invalide', 'Données structurées JSON-LD illisibles (Google les ignore).');
          }
        }
        break;
    }
  });

  const words = main ? textOf(main).split(' ').filter((word) => /\p{L}/u.test(word)).length : 0;
  const indexable = !/noindex/i.test(robots);

  if (status !== 200) add('erreur', 'http', `La page répond ${status}.`);
  if (!lang) add('avertissement', 'langue-absente', 'Attribut lang absent sur <html>.');
  if (!title) add('erreur', 'titre-absent', 'Balise <title> absente.');
  else if (title.length > TITLE_MAX) add('avertissement', 'titre-long', `Titre de ${title.length} caractères (Google coupe au-delà d'environ ${TITLE_MAX}).`);
  else if (title.length < TITLE_MIN) add('avertissement', 'titre-court', `Titre de ${title.length} caractères seulement.`);
  if (!description) add('erreur', 'description-absente', 'Meta description absente.');
  else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    add('avertissement', 'description-longueur', `Meta description de ${description.length} caractères (idéal : ${DESCRIPTION_MIN} à ${DESCRIPTION_MAX}).`);
  }
  if (!canonical) add('erreur', 'canonique-absente', 'Lien canonique absent.');
  else if (canonical !== url) add('avertissement', 'canonique-differente', `Canonique « ${canonical} » différente de l'adresse du sitemap.`);
  if (!indexable) add('erreur', 'noindex', 'Page du sitemap marquée noindex : Google ne l’indexera pas.');
  if (h1 !== 1) add('avertissement', 'h1', `${h1} titre(s) <h1> (un seul attendu).`);
  if (!ogImage) add('avertissement', 'og-image-absente', 'Pas d’image de partage (og:image).');
  if (jsonLdTypes.length === 0 && !issues.some((issue) => issue.code === 'jsonld-invalide')) add('avertissement', 'jsonld-absent', 'Aucune donnée structurée.');
  if (imagesWithoutAlt > 0) add('avertissement', 'image-sans-alt', `${imagesWithoutAlt} image(s) sans attribut alt.`);
  if (main && words < THIN_CONTENT_WORDS) add('info', 'contenu-mince', `${words} mots dans le contenu principal.`);
  if (durationMs > SLOW_RESPONSE_MS) add('info', 'lent', `Réponse en ${Math.round(durationMs)} ms.`);

  return {
    page: { url, statut: status, dureeMs: Math.round(durationMs), titre: title, description, canonique: canonical, h1, mots: words, jsonLd: [...new Set(jsonLdTypes)], ogImage, indexable },
    links: [...links],
    issues,
  };
}

/** Titres et descriptions identiques sur plusieurs pages (Google n'en retient qu'une). */
export function duplicateIssues(pages: PageAudit[]): Issue[] {
  const issues: Issue[] = [];
  for (const [field, code, label] of [
    ['titre', 'titre-duplique', 'Titre'],
    ['description', 'description-dupliquee', 'Description'],
  ] as const) {
    const byValue = new Map<string, string[]>();
    for (const page of pages) {
      const value = page[field];
      if (value) byValue.set(value, [...(byValue.get(value) ?? []), page.url]);
    }
    for (const [value, urls] of byValue) {
      if (urls.length > 1) issues.push({ severite: 'avertissement', code, url: urls.join(' '), message: `${label} identique sur ${urls.length} pages : « ${value} »` });
    }
  }
  return issues;
}

async function fetchText(url: string): Promise<{ status: number; durationMs: number; text: string }> {
  const started = performance.now();
  try {
    const response = await fetchWithRetry(url, { retries: 1, timeoutMs: 20_000 });
    const text = await response.text();
    return { status: response.status, durationMs: performance.now() - started, text };
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, durationMs: performance.now() - started, text: '' };
    throw error;
  }
}

/** Pages listées par le sitemap du site (index + sitemaps enfants), au plus `limit`. */
export async function sitemapPages(site: string, limit: number): Promise<string[]> {
  const index = parseSitemap(await (await fetchWithRetry(`${site}/sitemap-index.xml`)).text());
  const pages = [...index.pages];
  for (const sitemap of index.sitemaps) {
    pages.push(...parseSitemap(await (await fetchWithRetry(sitemap)).text()).pages);
    if (pages.length >= limit) break;
  }
  return [...new Set(pages)].slice(0, limit);
}

export async function auditSite(site: string, config: VisibilityConfig, publishedEpisodes: number): Promise<SiteAudit> {
  const origin = new URL(site).origin;
  const urls = await sitemapPages(site, config.maxCrawlPages);
  if (urls.length === 0) throw new Error('Le sitemap ne liste aucune page');

  const analyses = await mapLimit(urls, CONCURRENCY, async (url) => {
    const { status, durationMs, text } = await fetchText(url);
    return analysePage(url, status, durationMs, text, origin);
  });
  const pages = analyses.map((analysis) => analysis.page);
  const issues = [...analyses.flatMap((analysis) => analysis.issues), ...duplicateIssues(pages)];

  // Liens internes vers des adresses absentes du sitemap : vérifiés un par un (pages oubliées ou cassées).
  const known = new Set(urls);
  const linkSources = new Map<string, string>();
  for (const analysis of analyses) {
    for (const link of analysis.links) if (!known.has(link) && !linkSources.has(link)) linkSources.set(link, analysis.page.url);
  }
  const toCheck = [...linkSources.keys()].slice(0, config.maxLinkChecks);
  const linkStatuses = await mapLimit(toCheck, CONCURRENCY, async (link) => ({ link, status: (await fetchText(link)).status }));
  for (const { link, status } of linkStatuses) {
    if (status >= 400) issues.push({ severite: 'erreur', code: 'lien-casse', url: linkSources.get(link) ?? link, message: `Lien interne cassé vers ${link} (HTTP ${status}).` });
  }

  const [robots, llms, rss, videoSitemap] = await Promise.all(
    ['/robots.txt', '/llms.txt', '/rss.xml', '/video-sitemap.xml'].map(async (path) => (await fetchText(`${site}${path}`)).status === 200),
  );
  const fileIssue = (ok: boolean | undefined, severite: Issue['severite'], code: string, message: string) => {
    if (!ok) issues.push({ severite, code, url: site, message });
  };
  fileIssue(robots, 'erreur', 'robots-absent', 'robots.txt inaccessible.');
  fileIssue(llms, 'avertissement', 'llms-absent', 'llms.txt inaccessible (résumé du site pour les IA).');
  fileIssue(rss, 'avertissement', 'rss-absent', 'Flux RSS inaccessible.');
  if (publishedEpisodes > 0) fileIssue(videoSitemap, 'erreur', 'sitemap-video-absent', 'Des épisodes sont publiés mais le sitemap vidéo est inaccessible.');
  else if (videoSitemap) issues.push({ severite: 'erreur', code: 'sitemap-video-vide', url: site, message: 'Sitemap vidéo publié sans aucun épisode (Google le refuse).' });

  return {
    pages,
    problemes: issues,
    fichiers: { robots: Boolean(robots), llms: Boolean(llms), rss: Boolean(rss), sitemapVideo: Boolean(videoSitemap) },
    liensVerifies: toCheck.length,
  };
}
