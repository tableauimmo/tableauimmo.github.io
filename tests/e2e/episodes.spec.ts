// Site de démonstration (npm run build:fixture) construit à partir de tests/fixtures/episodes et de la vraie
// synchronisation YouTube sur tests/fixtures/feed.xml :
//  - épisode 1 : déjà publié dans sa fiche ;
//  - épisode 2 : fiche « upcoming » publiée par la synchro (chapitres lus dans la description YouTube) ;
//  - une vidéo sans fiche et un Short : ignorés.
import { expect, test } from '@playwright/test';
import { SITE } from '../../site.config.mjs';
import { jsonLd, nodesOfType, plain, watchErrors } from './helpers.ts';

const ROOT = `${SITE.url}${SITE.base.replace(/\/$/, '')}`;
const EP1 = '/episodes/rendement-brut-ou-net/';
const EP2 = '/episodes/lmnp-2026-ce-qui-change/';

test('accueil : derniers épisodes et note « dernier épisode »', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ep-card')).toHaveCount(2);
  await expect(page.locator('.ep-card__title').first()).toHaveText('LMNP en 2026 : ce qui change vraiment pour les loueurs en meublé');
  await expect(page.locator('a.hero__note')).toHaveAttribute('href', EP2);
  await expect(page.locator('.empty-episodes')).toHaveCount(0);
});

test('page d’épisode : lecteur léger, tableau, points clés, chapitres, FAQ, sources, transcription, avertissements', async ({ page, baseURL }) => {
  const { errors } = watchErrors(page, baseURL);
  const response = await page.goto(EP1);
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Rendement brut ou net : le calcul que les annonces oublient');

  // Façade : aucune requête vers YouTube avant le clic.
  await expect(page.locator('[data-video] iframe')).toHaveCount(0);
  await expect(page.locator('[data-video-facade]')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=TIfixture01');

  await expect(page.locator('.takeaways li')).toHaveCount(4);
  const table = page.locator('.chalk-table');
  await expect(table.locator('caption')).toHaveText('Studio à 150 000 € : du brut au net');
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await expect(table.locator('td.is-key')).toHaveText('4,47 %');
  await expect(page.locator('.chapters li')).toHaveCount(7);
  await expect(page.locator('.faq__item')).toHaveCount(2);
  await expect(page.locator('.sources__list li')).toHaveCount(2);
  await expect(page.locator('details.transcript')).not.toHaveAttribute('open', '');
  await expect(page.locator('details.transcript .transcript__body')).toContainText('Six pour cent');
  await expect(page.locator('.episode__meta')).toContainText('Mis à jour le 15 octobre 2026');
  await expect(page.locator('.disclaimer .callout--warning')).toContainText('pas un conseil personnalisé');
  expect(plain(await page.locator('.disclaimer__ai').textContent())).toBe('Illustrations et voix générées avec l’aide de l’IA ; contenu vérifié et sourcé.');
  // Liens internes vers le lexique et les outils.
  await expect(page.locator('.episode__terms a')).toHaveCount(4);
  await expect(page.locator('.side-card a[href="/outils/rendement-locatif/"]')).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('données structurées : VideoObject, moments clés, FAQ, fil d’Ariane', async ({ page }) => {
  await page.goto(EP1);
  const graph = await jsonLd(page);
  const [video] = nodesOfType(graph, 'VideoObject');
  expect(video).toMatchObject({
    name: 'Rendement brut ou net : le calcul que les annonces oublient',
    uploadDate: '2026-10-08T16:00:00.000Z',
    duration: 'PT10M24S',
    embedUrl: expect.stringContaining('youtube-nocookie.com/embed/TIfixture01'),
    url: `${ROOT}${EP1}`,
    episodeNumber: 1,
    author: { '@id': `${ROOT}/#organisation` },
  });
  expect(video?.['@type']).toEqual(['VideoObject', 'Episode']);
  const thumbnail = (video?.thumbnailUrl as string[])[0] ?? '';
  expect(thumbnail).toMatch(new RegExp(`^${ROOT.replace(/[.]/g, '\\.')}/_astro/.+\\.jpg$`));
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', thumbnail);
  const clips = video?.hasPart as { startOffset: number; endOffset: number; url: string }[];
  expect(clips.map((clip) => clip.startOffset)).toEqual([0, 32, 125, 220, 310, 425, 560]);
  expect(clips.at(-1)?.endOffset).toBe(624);
  expect(clips[2]?.url).toBe(`${ROOT}${EP1}?t=125`);
  expect(nodesOfType(graph, 'FAQPage')).toHaveLength(1);
  expect(nodesOfType(graph, 'CreativeWorkSeries')).toHaveLength(1);
});

test('lecture : clic sur la vignette, chapitre, lien direct ?t=', async ({ page }) => {
  await page.goto(EP1);
  await page.locator('[data-video-facade]').click();
  await expect(page.locator('[data-video] iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/TIfixture01\?.*autoplay=1/);
  await page.locator('.chapters a', { hasText: 'Le vrai coût' }).click();
  await expect(page.locator('[data-video] iframe')).toHaveAttribute('src', /start=125/);
  await expect(page).toHaveURL(/\?t=125$/);
  await page.goto(`${EP1}?t=310`);
  await expect(page.locator('[data-video] iframe')).toHaveAttribute('src', /start=310/);
});

test('épisode publié par la synchro : chapitres repris de la description YouTube', async ({ page }) => {
  await page.goto(EP2);
  await expect(page.locator('.chapters li')).toHaveCount(5);
  await expect(page.locator('.chapters li').nth(1)).toContainText('0:28');
  await expect(page.locator('.chalk-table td.is-key').first()).toHaveText('18,6 %');
  // Emphase en ligne dans une cellule : « **réintégrés** dans la plus-value ».
  await expect(page.locator('.chalk-table td strong')).toHaveText('réintégrés');
  await expect(page.locator('.chalk-table')).not.toContainText('**');
});

test('liens croisés : thème, calculateur et terme du lexique montrent leurs épisodes', async ({ page }) => {
  await page.goto('/categories/fiscalite/');
  await expect(page.locator('.ep-card__title')).toHaveText(['LMNP en 2026 : ce qui change vraiment pour les loueurs en meublé']);
  await page.goto('/outils/rendement-locatif/');
  await expect(page.locator('.tool__episode .ep-card__link')).toHaveAttribute('href', EP1);
  await page.goto('/lexique/rendement-brut/');
  await expect(page.locator('.ep-card__link')).toHaveAttribute('href', EP1);
});

test('liste des épisodes, sitemap vidéo, RSS, llms.txt', async ({ page, request }) => {
  await page.goto('/episodes/');
  await expect(page.locator('.ep-card')).toHaveCount(2);
  const [list] = nodesOfType(await jsonLd(page), 'ItemList');
  expect((list?.itemListElement as unknown[]).length).toBe(2);

  const sitemap = await (await request.get('/video-sitemap.xml')).text();
  expect(sitemap).toContain(`<loc>${ROOT}${EP1}</loc>`);
  expect(sitemap).toContain('<video:duration>624</video:duration>');
  expect(await (await request.get('/robots.txt')).text()).toContain(`Sitemap: ${ROOT}/video-sitemap.xml`);

  const rss = await (await request.get('/rss.xml')).text();
  expect(rss).toContain('Épisode 2 : LMNP en 2026');
  const llms = plain(await (await request.get('/llms.txt')).text());
  expect(llms).toContain(`[Épisode 1 : Rendement brut ou net : le calcul que les annonces oublient](${ROOT}${EP1})`);
  const full = await (await request.get('/llms-full.txt')).text();
  expect(full).toContain('| Rendement net de charges | 7 234 ÷ 162 000 | **4,47 %** |');
});
