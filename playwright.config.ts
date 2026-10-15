import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Deux sites testés :
//  - « site »     : le build réel (dist/), qui doit fonctionner avec zéro épisode ;
//  - « episodes » : le build de démonstration (dist-fixture/), avec les épisodes de tests/fixtures publiés par la synchro.
// Construire avant : npm run build && npm run build:fixture (fait par npm run test:e2e).
// E2E_BASE_URL=https://… : teste le site en ligne (projets « site » uniquement, sans serveur local).
const REMOTE = process.env.E2E_BASE_URL?.replace(/\/$/, '');
const SITE_PORT = 4321;
const FIXTURE_PORT = 4322;
const SITE_URL = REMOTE ?? `http://127.0.0.1:${SITE_PORT}`;

// Chromium préinstallé (conteneurs sans « playwright install ») ; sinon celui de Playwright (CI).
const LOCAL_CHROMIUM = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const launchOptions = existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  timeout: 45_000,
  workers: REMOTE ? 4 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [
    { name: 'site-desktop', testMatch: /(site|tools|seo)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: SITE_URL, launchOptions } },
    { name: 'site-mobile', testMatch: /(site|tools)\.spec\.ts/, use: { ...devices['Pixel 7'], baseURL: SITE_URL, launchOptions } },
    ...(REMOTE ? [] : [{ name: 'episodes', testMatch: /episodes\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${FIXTURE_PORT}`, launchOptions } }]),
  ],
  webServer: REMOTE
    ? []
    : [
        {
          command: `npx astro preview --port ${SITE_PORT} --host 127.0.0.1`,
          url: `http://127.0.0.1:${SITE_PORT}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: `npx astro preview --outDir dist-fixture --port ${FIXTURE_PORT} --host 127.0.0.1`,
          url: `http://127.0.0.1:${FIXTURE_PORT}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
