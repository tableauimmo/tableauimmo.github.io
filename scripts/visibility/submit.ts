// Soumission des pages aux moteurs de recherche.
//
//   npm run visibilite:soumettre -- indexnow --toutes            # toutes les pages du sitemap
//   npm run visibilite:soumettre -- indexnow <url> [<url>…]      # pages nouvelles ou modifiées
//   npm run visibilite:soumettre -- sitemaps                     # Search Console : (re)soumet les sitemaps
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SITE } from '../../site.config.mjs';
import { fetchWithRetry } from '../lib/http.ts';
import { accessToken, readServiceAccount } from './google-auth.ts';
import { INDEXNOW_MAX_URLS, indexNowPayload, submitIndexNow } from './indexnow.ts';
import { SEARCH_CONSOLE_SCOPE, SearchConsoleClient } from './search-console.ts';
import { sitemapPages } from './site-audit.ts';
import { DATA_DIR, loadConfig } from './storage.ts';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { toutes: { type: 'boolean', default: false }, site: { type: 'string' } },
});

async function main(): Promise<void> {
  const [command, ...urls] = positionals;
  const site = (args.site ?? new URL(SITE.base, SITE.url).href).replace(/\/$/, '');
  const config = await loadConfig(path.resolve(DATA_DIR));

  if (command === 'indexnow') {
    const list = args.toutes ? await sitemapPages(site, INDEXNOW_MAX_URLS) : urls;
    const payload = indexNowPayload(site, config.indexNowKey, list);
    const status = await submitIndexNow(payload);
    console.log(`✓ IndexNow : ${payload.urlList.length} adresse(s) envoyée(s) — HTTP ${status}${status === 202 ? ' (clé en cours de vérification par les moteurs)' : ''}`);
    return;
  }

  if (command === 'sitemaps') {
    const credentialsFile = path.resolve(process.env.GSC_CREDENTIALS_FILE?.trim() || '.secrets/search-console.json');
    if (!existsSync(credentialsFile)) throw new Error(`Compte de service Search Console absent (${credentialsFile}) : voir visibilite/README.md`);
    const client = new SearchConsoleClient(await accessToken(await readServiceAccount(credentialsFile), SEARCH_CONSOLE_SCOPE), config.searchConsoleProperty);
    const candidates = [`${site}/sitemap-index.xml`, `${site}/video-sitemap.xml`];
    for (const sitemap of candidates) {
      const exists = (await fetchWithRetry(sitemap, { acceptStatus: [404], retries: 1 })).status === 200;
      if (!exists) {
        console.log(`· ${sitemap} absent (normal tant qu'aucun épisode n'est publié pour le sitemap vidéo)`);
        continue;
      }
      await client.submitSitemap(sitemap);
      console.log(`✓ Search Console : ${sitemap} soumis`);
    }
    return;
  }

  throw new Error('Commande attendue : « indexnow --toutes », « indexnow <url…> » ou « sitemaps »');
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
