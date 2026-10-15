import { describe, expect, it } from 'vitest';
import { mapLimit } from '../../scripts/visibility/concurrency.ts';
import { analysePage, decodeEntities, duplicateIssues, internalLink, parseSitemap } from '../../scripts/visibility/site-audit.ts';

const ORIGIN = 'https://tableauimmo.github.io';
const URL_PAGE = `${ORIGIN}/lexique/lmnp/`;

const words = (count: number) => Array.from({ length: count }, (_, index) => `mot${index}a`).join(' ');

function page({ title = 'LMNP (Loueur en meublé non professionnel) : définition | Tableau Immo', description = 'Statut fiscal du particulier qui loue des logements meublés sans en faire sa profession : ses loyers sont imposés comme des BIC.', canonical = URL_PAGE, extraHead = '', body = '' } = {}): string {
  return `<!doctype html><html lang="fr"><head>
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:image" content="${ORIGIN}/_astro/og.jpg">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":["TVSeries","CreativeWork"]}]}</script>
    ${extraHead}
  </head><body>
    <svg><title>Icône</title></svg>
    <main><h1>LMNP</h1><p>${words(150)}</p>${body}
      <a href="/episodes/">Épisodes</a><a href="/outils/#top">Outils</a><a href="https://www.youtube.com/@TableauImmo">YouTube</a>
      <a href="mailto:tableauimmo@gmail.com">Contact</a><img src="/a.png" alt=""><script>const ignore = "${words(500)}";</script>
    </main></body></html>`;
}

describe('analysePage', () => {
  it('lit les balises SEO, les données structurées, le contenu et les liens internes', () => {
    const { page: audit, links, issues } = analysePage(URL_PAGE, 200, 120, page(), ORIGIN);
    expect(audit).toMatchObject({ statut: 200, titre: 'LMNP (Loueur en meublé non professionnel) : définition | Tableau Immo', canonique: URL_PAGE, h1: 1, ogImage: true, indexable: true });
    expect(audit.jsonLd).toEqual(['Organization', 'TVSeries', 'CreativeWork']);
    // Le texte des scripts n'est pas compté ; le titre de l'icône SVG n'est pas le titre de la page.
    expect(audit.mots).toBeGreaterThanOrEqual(150);
    expect(audit.mots).toBeLessThan(170);
    expect(links).toEqual([`${ORIGIN}/episodes/`, `${ORIGIN}/outils/`]);
    expect(issues).toEqual([]);
  });

  it('signale les défauts qui coûtent des positions', () => {
    const html = page({ title: 'LMNP', description: 'Trop court', canonical: `${ORIGIN}/autre/`, extraHead: '<meta name="robots" content="noindex"><script type="application/ld+json">{oups</script>', body: '<h1>Deux</h1><img src="/b.png">' });
    const codes = analysePage(URL_PAGE, 200, 2500, html, ORIGIN).issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['titre-court', 'description-longueur', 'canonique-differente', 'noindex', 'jsonld-invalide', 'h1', 'image-sans-alt', 'lent']));
  });

  it('page absente : erreur HTTP, titre, description et canonique manquants', () => {
    const codes = analysePage(URL_PAGE, 404, 50, '', ORIGIN).issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['http', 'titre-absent', 'description-absente', 'canonique-absente', 'langue-absente']));
  });
});

describe('outils de l’audit', () => {
  it('décode les entités HTML', () => {
    expect(decodeEntities('L&#39;épisode &amp; la chanson &#x2014; &quot;oui&quot;')).toBe('L\'épisode & la chanson — "oui"');
  });

  it('ne garde que les liens internes, sans fragment', () => {
    expect(internalLink('/outils/#haut', URL_PAGE, ORIGIN)).toBe(`${ORIGIN}/outils/`);
    expect(internalLink('../lmp/', URL_PAGE, ORIGIN)).toBe(`${ORIGIN}/lexique/lmp/`);
    expect(internalLink('https://www.youtube.com/', URL_PAGE, ORIGIN)).toBeNull();
    expect(internalLink('tel:0600000000', URL_PAGE, ORIGIN)).toBeNull();
  });

  it('lit un index de sitemaps et un sitemap', () => {
    expect(parseSitemap('<sitemapindex><sitemap><loc>https://tableauimmo.github.io/sitemap-0.xml</loc></sitemap></sitemapindex>')).toEqual({ pages: [], sitemaps: ['https://tableauimmo.github.io/sitemap-0.xml'] });
    expect(parseSitemap('<urlset><url><loc>https://tableauimmo.github.io/</loc></url><url><loc> https://tableauimmo.github.io/outils/ </loc></url></urlset>').pages).toEqual(['https://tableauimmo.github.io/', 'https://tableauimmo.github.io/outils/']);
    expect(() => parseSitemap('<html></html>')).toThrow(/Sitemap invalide/);
  });

  it('repère les titres et descriptions en double', () => {
    const base = { statut: 200, dureeMs: 1, canonique: '', h1: 1, mots: 200, jsonLd: [], ogImage: true, indexable: true };
    const issues = duplicateIssues([
      { ...base, url: 'a', titre: 'Même titre', description: 'A' },
      { ...base, url: 'b', titre: 'Même titre', description: 'B' },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'titre-duplique', url: 'a b' });
  });

  it('limite le parallélisme et garde l’ordre des résultats', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapLimit([30, 10, 20, 5], 2, async (delay, index) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, delay));
      running -= 1;
      return index;
    });
    expect(results).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
    await expect(mapLimit([1], 0, async () => 1)).rejects.toThrow(/invalide/);
  });
});
