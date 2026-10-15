// Les 4 calculateurs : valeurs connues, validation, lien partageable, rendu sans JavaScript.
import { expect, test, type Page } from '@playwright/test';
import { plain } from './helpers.ts';

async function fill(page: Page, values: Record<string, string>): Promise<void> {
  for (const [name, value] of Object.entries(values)) await page.locator(`input[name="${name}"]`).fill(value);
  await page.locator('form[data-tool] button[type="submit"]').click();
}

const summary = (page: Page) => page.locator('[data-tool-summary]');

test('mensualité : 200 000 € sur 20 ans à 3,5 % → 1 159,92 € hors assurance', async ({ page }) => {
  await page.goto('/outils/mensualite-credit-immobilier/');
  await fill(page, { capital: '200000', rate: '3,5', years: '20', insurance: '0,3' });
  await expect.poll(async () => plain(await summary(page).textContent())).toBe('Mensualité assurance comprise : 1 209,92 € par mois. Coût total du crédit : 90 381 €.');
  expect(plain(await page.locator('.result-table tr', { hasText: 'Mensualité hors assurance' }).locator('td').textContent())).toBe('1 159,92 €');
  await expect(page.locator('.schedule__table tbody tr')).toHaveCount(20);
  // Valeurs d'exemple : l'adresse reste propre (seules les valeurs modifiées y figurent).
  expect(new URL(page.url()).search).toBe('');
});

test('mensualité : recalcul à la saisie, durée changée', async ({ page }) => {
  await page.goto('/outils/mensualite-credit-immobilier/');
  await page.locator('input[name="years"]').fill('25');
  await expect.poll(async () => page.locator('.schedule__table tbody tr').count()).toBe(25);
  await expect(page).toHaveURL(/duree=25/);
});

test('capacité d’emprunt : 4 000 € de revenus → 1 400 € et environ 266 300 €', async ({ page }) => {
  await page.goto('/outils/capacite-emprunt/');
  await fill(page, { income: '4 000', rents: '0', otherLoans: '0', rate: '3,5', years: '25', insurance: '0,3', maxRatio: '35' });
  await expect.poll(async () => plain(await summary(page).textContent())).toBe('Capacité d’emprunt estimée : 266 300 € pour une mensualité de 1 400,00 € assurance comprise.');
});

test('rendement : 5,56 % brut et 4,47 % net sur l’exemple, puis loyer modifié', async ({ page }) => {
  await page.goto('/outils/rendement-locatif/');
  await expect(summary(page)).toHaveText(/5,56\s%.*4,47\s%/);
  await fill(page, { rent: '800' });
  await expect.poll(async () => plain(await summary(page).textContent())).toBe('Rendement brut : 5,93 %. Rendement net de charges : 4,82 %.');
});

test('cash-flow : effort d’épargne puis cash-flow positif', async ({ page }) => {
  await page.goto('/outils/cash-flow-immobilier/');
  await expect.poll(async () => plain(await summary(page).textContent())).toBe('Cash-flow mensuel avant impôt : −108,85 €.');
  await fill(page, { rent: '800', vacancyWeeks: '0', loanPayment: '650', coproCharges: '50', propertyTax: '900', insurance: '120', management: '0', maintenance: '0' });
  await expect.poll(async () => plain(await summary(page).textContent())).toBe('Cash-flow mensuel avant impôt : +15,00 €.');
});

test('une saisie invalide est signalée sur le champ, en français', async ({ page }) => {
  await page.goto('/outils/mensualite-credit-immobilier/');
  await fill(page, { rate: 'trois' });
  const field = page.locator('[data-field="rate"]');
  await expect(field.locator('.field__error')).toHaveText('Indiquez un nombre, par exemple 1 250 ou 3,5.');
  await expect(page.locator('input[name="rate"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(summary(page)).toContainText('corrigez les champs signalés');
  await fill(page, { rate: '3,5' });
  await expect(field.locator('.field__error')).toHaveText('');
});

test('lien partageable : les valeurs de l’adresse sont reprises et calculées', async ({ page }) => {
  await page.goto('/outils/mensualite-credit-immobilier/?montant=120000&taux=0&duree=10&assurance=0');
  await expect(page.locator('input[name="capital"]')).toHaveValue(/120\s000/);
  await expect.poll(async () => plain(await summary(page).textContent())).toContain('1 000,00 € par mois');
});

test('sans JavaScript, l’exemple calculé est déjà dans la page', async ({ request }) => {
  const html = plain(await (await request.get('/outils/rendement-locatif/')).text());
  expect(html).toContain('Rendement brut : 5,56 %. Rendement net de charges : 4,47 %.');
  expect(html).toContain('Le calcul, ligne par ligne');
});
