// Site réel (dist/) : doit fonctionner quel que soit l'état du contenu (zéro épisode ou plusieurs).
import { expect, test } from '@playwright/test';
import { SOCIAL } from '../../site.config.mjs';
import { horizontalOverflow, plain, sitemapPaths, watchErrors } from './helpers.ts';

test('accueil : promesse, abonnement aux 6 réseaux, épisodes ou état « bientôt », outils, lexique', async ({ page, baseURL }) => {
  const { errors } = watchErrors(page, baseURL);
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('expliqué au tableau');
  for (const network of SOCIAL) await expect(page.locator(`.hero a[data-network="${network.id}"]`)).toHaveAttribute('href', network.url);
  const cards = await page.locator('.ep-card').count();
  if (cards === 0) await expect(page.locator('.empty-episodes')).toContainText('Premier épisode bientôt');
  else await expect(page.locator('.empty-episodes')).toHaveCount(0);
  await expect(page.locator('.tool-card')).toHaveCount(4);
  await expect(page.locator('.cat-card')).toHaveCount(8);
  await expect(page.locator('.term-note')).toHaveCount(6);
  // Le cas d'école de l'accueil est calculé avec les formules des calculateurs.
  await expect(page.locator('.hero__table')).toContainText('6,4');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('navigation principale (menu mobile compris)', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.locator('.site-menu__toggle').click();
    await page.locator('.site-menu__panel a', { hasText: 'Lexique' }).click();
  } else {
    await page.locator('.site-nav a', { hasText: 'Lexique' }).click();
  }
  await expect(page).toHaveURL(/\/lexique\/$/);
  await expect(page.locator('h1')).toHaveText('Le lexique');
  await expect(page.locator('.site-nav a[aria-current="page"], .site-menu__panel a[aria-current="page"]').first()).toHaveText('Lexique');
});

test('toutes les pages du sitemap : 200, un seul h1, aucun débordement horizontal', async ({ page }) => {
  test.setTimeout(180_000);
  const paths = await sitemapPaths(page);
  expect(paths.length).toBeGreaterThanOrEqual(50);
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('h1'), path).toHaveCount(1);
    expect(await horizontalOverflow(page), `${path} déborde`).toBeLessThanOrEqual(0);
  }
});

test('chaque page du lexique affiche sa définition, son texte, sa date et ses sources', async ({ page }) => {
  test.setTimeout(120_000);
  const paths = (await sitemapPaths(page)).filter((path) => /^\/lexique\/[a-z0-9-]+\/$/.test(path));
  expect(paths).toHaveLength(30);
  for (const path of paths) {
    await page.goto(path);
    expect(plain(await page.locator('.term__definition').textContent()).length, path).toBeGreaterThanOrEqual(70);
    // Un rendu Markdown en échec donnerait un corps vide sans faire échouer le build.
    expect(plain(await page.locator('.content-main .prose').first().textContent()).length, path).toBeGreaterThan(300);
    await expect(page.locator('.term__updated'), path).toContainText('Définition vérifiée le');
    expect(await page.locator('.sources__list li').count(), path).toBeGreaterThan(0);
  }
});

test('le filtre du lexique trouve un terme par sigle ou par mot', async ({ page }) => {
  await page.goto('/lexique/');
  const filter = page.locator('[data-lexicon-filter]');
  await filter.fill('meublé');
  await expect(page.locator('[data-lexicon-item]:visible dt a')).toContainText(['LMNP', 'LMP']);
  await filter.fill('zzzz');
  await expect(page.locator('[data-lexicon-empty]')).toBeVisible();
});

test('page d’épisode absente : vraie erreur 404, page utile', async ({ page }) => {
  const response = await page.goto('/episodes/cet-episode-n-existe-pas/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('effacée du tableau');
  await expect(page.locator('main a[href="/outils/"]')).toBeVisible();
});

test('pages légales et charte : signées Tableau Immo, contact, IA déclarée', async ({ page }) => {
  await page.goto('/mentions-legales/');
  await expect(page.locator('main')).toContainText('article 1-1');
  await expect(page.locator('main')).toContainText('GitHub');
  await expect(page.locator('main')).toContainText('tableauimmo@gmail.com');
  await page.goto('/a-propos/');
  await expect(page.locator('main')).toContainText('conseil personnalisé');
  await expect(page.locator('main')).toContainText('voix de synthèse');
  await page.goto('/contact/');
  await expect(page.locator('main a[href^="mailto:tableauimmo@gmail.com"]').first()).toBeVisible();
});
