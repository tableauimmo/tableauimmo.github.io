// Collecte de la routine de visibilité : interroge toutes les sources connectées, calcule le score et les
// opportunités, met à jour le journal des expériences et écrit l'instantané + le rapport (dossier visibilite/).
//
//   npm run visibilite                          # toutes les sources
//   npm run visibilite -- --sans-performance    # sans la mesure de performance (plus rapide)
//   npm run visibilite -- --site https://…      # autre site (tests)
//
// Variables (fichier .env, jamais versionné — voir visibilite/README.md) :
//   GOOGLE_API_KEY         PageSpeed Insights, YouTube Data et Knowledge Graph (une seule clé Google Cloud)
//   GSC_CREDENTIALS_FILE   compte de service Search Console (défaut : .secrets/search-console.json)
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseArgs } from 'node:util';
import { SITE, YOUTUBE } from '../../site.config.mjs';
import { loadEpisodes } from '../lib/store.ts';
import { analyse } from './analysis.ts';
import { accessToken, readServiceAccount } from './google-auth.ts';
import { keyFileServed, keyFileUrl } from './indexnow.ts';
import { collectKnowledgeGraph } from './knowledge-graph.ts';
import { runLighthouseLocal, runPageSpeed } from './performance.ts';
import { renderReport } from './report.ts';
import { SNAPSHOT_VERSION, type ConnectorResult, type ContentPage, type Snapshot, type SnapshotEpisodes } from './schema.ts';
import { collectSearchConsole, SEARCH_CONSOLE_SCOPE, SearchConsoleClient } from './search-console.ts';
import { auditSite } from './site-audit.ts';
import { applyEvaluations, DATA_DIR, latestGeo, latestSnapshot, loadConfig, loadExperiments, loadTargets, runStamp, saveExperiments, saveRun } from './storage.ts';
import { collectSuggestions } from './suggestions.ts';
import { collectYouTube } from './youtube.ts';

const { values: args } = parseArgs({
  options: {
    site: { type: 'string' },
    dossier: { type: 'string' },
    'sans-performance': { type: 'boolean', default: false },
  },
});

const GOOGLE_KEY_SETUP =
  'Créer une clé API dans Google Cloud (APIs : PageSpeed Insights, YouTube Data v3, Knowledge Graph Search) et l’ajouter dans .env : GOOGLE_API_KEY=… (voir visibilite/README.md).';
const SEARCH_CONSOLE_SETUP =
  'Créer un compte de service Google Cloud (API Search Console activée), enregistrer sa clé JSON dans .secrets/search-console.json, puis l’ajouter comme utilisateur avec l’autorisation « Totale » sur la propriété du site dans Search Console (voir visibilite/README.md).';
const KEY_PAGES = ['/', '/episodes/', '/outils/', '/lexique/', '/categories/'];
const YOUTUBE_SETUP = 'Renseigner YOUTUBE.channelId (identifiant « UC… » de la chaîne) dans site.config.mjs.';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function timed<T>(task: () => Promise<T>): Promise<ConnectorResult<T>> {
  const started = performance.now();
  try {
    const donnees = await task();
    return { statut: 'ok', dureeMs: Math.round(performance.now() - started), donnees };
  } catch (error) {
    return { statut: 'erreur', dureeMs: Math.round(performance.now() - started), erreur: errorMessage(error) };
  }
}

const absent = (raison: string, configuration: string) => ({ statut: 'absent', raison, configuration }) as const;

async function siteEpisodes(site: string): Promise<SnapshotEpisodes> {
  const files = await loadEpisodes(path.resolve('src/content/episodes'));
  const publies: SnapshotEpisodes['publies'] = [];
  const aVenir: SnapshotEpisodes['aVenir'] = [];
  for (const { frontmatter } of files) {
    const numero = Number(frontmatter.number);
    const titre = String(frontmatter.title ?? '');
    const publishedAt = new Date(String(frontmatter.publishedAt ?? ''));
    if (frontmatter.status === 'published' && typeof frontmatter.youtubeId === 'string' && !Number.isNaN(publishedAt.getTime())) {
      publies.push({ numero, titre, url: `${site}/episodes/${String(frontmatter.slug)}/`, youtubeId: frontmatter.youtubeId, publieLe: publishedAt.toISOString() });
    } else {
      aVenir.push({ numero, titre });
    }
  }
  publies.sort((a, b) => b.publieLe.localeCompare(a.publieLe));
  aVenir.sort((a, b) => a.numero - b.numero);
  return { publies, aVenir };
}

const isoDay = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : undefined;
};

/** Pages datées (épisodes publiés, termes du lexique) pour le contrôle de fraîcheur. */
async function datedPages(site: string): Promise<ContentPage[]> {
  const pages: ContentPage[] = [];
  for (const { frontmatter } of await loadEpisodes(path.resolve('src/content/episodes'))) {
    if (frontmatter.status !== 'published') continue;
    const verifieLe = isoDay(frontmatter.updatedAt) ?? isoDay(frontmatter.publishedAt);
    if (!verifieLe) continue;
    pages.push({ url: `${site}/episodes/${String(frontmatter.slug)}/`, titre: String(frontmatter.title ?? ''), type: 'episode', theme: String(frontmatter.category ?? ''), verifieLe });
  }
  const lexiconDir = path.resolve('src/content/lexique');
  for (const file of (await readdir(lexiconDir)).filter((name) => name.endsWith('.md')).sort()) {
    const source = await readFile(path.join(lexiconDir, file), 'utf8');
    const data = parseYaml(source.split(/^---$/m)[1] ?? '') as Record<string, unknown> & { watch?: { date?: unknown } };
    const verifieLe = isoDay(data.updatedAt);
    if (!verifieLe) continue;
    const watch = isoDay(data.watch?.date);
    pages.push({
      url: `${site}/lexique/${file.replace(/\.md$/, '')}/`,
      titre: String(data.term ?? file),
      type: 'lexique',
      theme: String(data.category ?? ''),
      verifieLe,
      ...(watch ? { aSurveiller: watch } : {}),
    });
  }
  return pages;
}

async function main(): Promise<void> {
  const dir = path.resolve(args.dossier ?? DATA_DIR);
  const site = (args.site ?? new URL(SITE.base, SITE.url).href).replace(/\/$/, '');
  const now = new Date();
  const [config, targets, experiments, geo, previous, episodes, contenus] = await Promise.all([
    loadConfig(dir),
    loadTargets(dir),
    loadExperiments(dir),
    latestGeo(dir),
    latestSnapshot(dir),
    siteEpisodes(site),
    datedPages(site),
  ]);
  const googleKey = process.env.GOOGLE_API_KEY?.trim() || undefined;
  const youtubeKey = process.env.YOUTUBE_API_KEY?.trim() || googleKey;
  const credentialsFile = path.resolve(process.env.GSC_CREDENTIALS_FILE?.trim() || '.secrets/search-console.json');

  console.log(`Routine de visibilité — ${site}`);
  console.log(`Épisodes publiés : ${episodes.publies.length}, à venir : ${episodes.aVenir.length}`);

  const inspectUrls = [...KEY_PAGES.map((page) => `${site}${page}`), ...episodes.publies.map((episode) => episode.url)].slice(0, config.maxUrlInspections);
  const seeds = [...targets.requetes].sort((a, b) => a.priorite - b.priorite).slice(0, config.maxSuggestionSeeds).map((item) => item.texte);

  const [siteResult, searchConsole, youtube, suggestions, knowledgeGraph, indexNow] = await Promise.all([
    timed(() => auditSite(site, config, episodes.publies.length)),
    existsSync(credentialsFile)
      ? timed(async () => {
          const token = await accessToken(await readServiceAccount(credentialsFile), SEARCH_CONSOLE_SCOPE);
          return collectSearchConsole(new SearchConsoleClient(token, config.searchConsoleProperty), inspectUrls, now);
        })
      : Promise.resolve(absent(`compte de service absent (${path.relative(process.cwd(), credentialsFile)})`, SEARCH_CONSOLE_SETUP)),
    YOUTUBE.feedUrl
      ? timed(() => collectYouTube(YOUTUBE.feedUrl ?? '', YOUTUBE.channelId, episodes.publies.map((episode) => ({ numero: episode.numero, url: episode.url, youtubeId: episode.youtubeId })), youtubeKey))
      : Promise.resolve(absent('identifiant de chaîne YouTube non renseigné', YOUTUBE_SETUP)),
    seeds.length > 0 ? timed(() => collectSuggestions(seeds)) : Promise.resolve(absent('aucune requête cible', 'Ajouter des requêtes dans visibilite/cibles.json.')),
    googleKey ? timed(() => collectKnowledgeGraph(SITE.name, 'tableau immo', googleKey)) : Promise.resolve(absent('GOOGLE_API_KEY absente', GOOGLE_KEY_SETUP)),
    timed(async () => ({ cleServie: await keyFileServed(site, config.indexNowKey), url: keyFileUrl(site, config.indexNowKey) })),
  ]);

  // Mesurée après les autres sources : le navigateur de mesure ne partage pas la connexion avec l'audit.
  const performanceUrls = [...config.performancePaths.map((page) => `${site}${page}`), ...episodes.publies.slice(0, 1).map((episode) => episode.url)].slice(0, 5);
  const performanceResult = args['sans-performance']
    ? absent('mesure désactivée pour ce passage (--sans-performance)', 'Relancer sans --sans-performance.')
    : await timed(() => (googleKey ? runPageSpeed(performanceUrls, googleKey) : runLighthouseLocal(performanceUrls)));

  const connecteurs: Snapshot['connecteurs'] = { site: siteResult, performance: performanceResult, searchConsole, youtube, suggestions, knowledgeGraph, indexNow };
  console.log('');
  for (const [name, result] of Object.entries(connecteurs)) {
    console.log(`  ${result.statut === 'ok' ? '✓' : result.statut === 'absent' ? '·' : '✗'} ${name}${result.statut === 'ok' ? '' : ` — ${result.statut === 'absent' ? result.raison : result.erreur}`}`);
  }
  // Sans le site, le passage n'a pas de sens : rien n'est enregistré (l'historique ne garde que des passages comparables).
  if (siteResult.statut !== 'ok') {
    console.error(`\n✗ Site injoignable ou illisible, passage non enregistré : ${siteResult.statut === 'erreur' ? siteResult.erreur : siteResult.raison}`);
    process.exitCode = 1;
    return;
  }

  const analysis = analyse({ now, site, episodes, contenus, connectors: connecteurs, geo, targets, experiments, previous });
  const snapshot: Snapshot = { version: SNAPSHOT_VERSION, creeLe: now.toISOString(), site, episodes, contenus, connecteurs, geo, analyse: analysis };

  const updatedExperiments = applyEvaluations(experiments, analysis.evaluations, now.toISOString().slice(0, 10));
  if (JSON.stringify(updatedExperiments) !== JSON.stringify(experiments)) await saveExperiments(dir, updatedExperiments);
  const { snapshotFile, reportFile } = await saveRun(dir, runStamp(now), snapshot, renderReport(snapshot));

  const evolution = analysis.evolution.score === null ? '' : ` (${analysis.evolution.score >= 0 ? '+' : ''}${analysis.evolution.score})`;
  console.log(`\nScore de visibilité : ${analysis.score.total ?? '—'}/100${evolution} — ${analysis.score.couverture} % des critères mesurés`);
  for (const part of analysis.score.parties) console.log(`  ${part.nom.padEnd(12)} ${part.valeur ?? 'non mesuré'}`);
  console.log('\nOpportunités principales :');
  for (const opportunity of analysis.opportunites.slice(0, 10)) console.log(`  [${opportunity.priorite}] ${opportunity.titre}`);
  console.log(`\nRapport : ${path.relative(process.cwd(), reportFile)}\nInstantané : ${path.relative(process.cwd(), snapshotFile)}`);
}

main().catch((error: unknown) => {
  console.error(`✗ Routine de visibilité interrompue : ${errorMessage(error)}`);
  process.exitCode = 1;
});
