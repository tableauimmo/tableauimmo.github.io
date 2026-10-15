// Captures d'écran du site construit (contrôle visuel) : ordinateur (1440 px) et mobile (390 px).
//
//   npm run screens -- --base http://127.0.0.1:4321 --out .screens / /outils/rendement-locatif/
//
// Navigateur : Chromium de Playwright (PW_CHROMIUM_PATH ou /opt/pw-browsers/chromium s'il existe).
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: 'string', default: 'http://127.0.0.1:4321' },
    out: { type: 'string', default: '.screens' },
    prefix: { type: 'string', default: '' },
    full: { type: 'boolean', default: true },
  },
});

const LOCAL_CHROMIUM = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];

const paths = positionals.length ? positionals : ['/'];
const browser = await chromium.launch(existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {});
await mkdir(args.out, { recursive: true });
for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const pagePath of paths) {
    await page.goto(new URL(pagePath, args.base).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const slug = pagePath.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'accueil';
    const file = path.join(args.out, `${args.prefix}${slug}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: args.full });
    console.log(`${overflow > 0 ? '⚠︎ débordement horizontal de ' + overflow + ' px — ' : '✓ '}${file}`);
  }
  await context.close();
}
await browser.close();
