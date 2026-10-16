// Synchronise le site avec la chaîne YouTube : quand une vidéo est publiée, la fiche d'épisode préparée
// (statut « upcoming », créée par npm run episode:add) passe en « published ».
//
//   npm run sync:youtube                         # flux public de la chaîne (site.config.mjs → YOUTUBE.channelId)
//   npm run sync:youtube -- --feed fichier.xml   # flux local (tests)
//   npm run sync:youtube -- --dry-run            # affiche ce qui serait fait, sans rien écrire
//
// Tant que YOUTUBE.channelId est vide, le script s'arrête proprement (code 0).
// Une vidéo sans fiche préparée n'est pas publiée automatiquement : un contenu financier doit être
// relu et sourcé avant d'avoir sa page (créer la fiche avec npm run episode:add, puis relancer).
//
// Variables d'environnement facultatives :
//   YOUTUBE_API_KEY  durée exacte et description complète des vidéos
//   TI_EPISODES_DIR  dossier des épisodes (défaut : src/content/episodes)
//   GITHUB_OUTPUT    (CI) reçoit « changed=true|false »
//   TI_SANS_CHAINE   (tests) fait comme si YOUTUBE.channelId était vide
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { YOUTUBE } from '../site.config.mjs';
import { parseFeed, type FeedVideo } from './lib/feed.ts';
import { fetchWithRetry } from './lib/http.ts';
import { downloadThumbnail, loadEpisodes, localThumbnail, matchUpcoming, publishUpcoming, saveEpisode, type VideoInfo } from './lib/store.ts';
import { fetchVideoDetails } from './lib/youtube-api.ts';

const { values: args } = parseArgs({
  options: {
    feed: { type: 'string' },
    'episodes-dir': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const episodesDir = path.resolve(args['episodes-dir'] ?? process.env.TI_EPISODES_DIR ?? 'src/content/episodes');
const dryRun = args['dry-run'] ?? false;

async function reportChanged(changed: boolean): Promise<void> {
  const output = process.env.GITHUB_OUTPUT;
  if (output) await appendFile(output, `changed=${changed}\n`);
}

async function readFeed(source: string): Promise<string> {
  if (/^https?:\/\//.test(source)) return (await fetchWithRetry(source)).text();
  return readFile(source, 'utf8');
}

async function enrich(videos: FeedVideo[]): Promise<VideoInfo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey || videos.length === 0) {
    if (!apiKey) console.log('ℹ︎ YOUTUBE_API_KEY absente : durée des vidéos non renseignée (facultatif).');
    return videos;
  }
  const details = await fetchVideoDetails(
    videos.map((video) => video.youtubeId),
    apiKey,
  );
  return videos.map((video) => {
    const detail = details.get(video.youtubeId);
    return detail ? { ...video, description: detail.description || video.description, duration: detail.duration } : video;
  });
}

async function main(): Promise<void> {
  // TI_SANS_CHAINE=1 simule une chaîne non configurée (tests).
  const source = args.feed ?? (process.env.TI_SANS_CHAINE ? null : YOUTUBE.feedUrl);
  if (!source) {
    console.log('ℹ︎ Synchronisation YouTube désactivée : YOUTUBE.channelId est vide dans site.config.mjs. Rien à faire.');
    await reportChanged(false);
    return;
  }
  console.log(`Flux : ${source}`);
  console.log(`Épisodes : ${episodesDir}${dryRun ? ' (simulation)' : ''}`);

  const videos = parseFeed(await readFeed(source));
  const episodes = await loadEpisodes(episodesDir);
  const known = new Set(episodes.map((episode) => episode.frontmatter.youtubeId).filter(Boolean));

  const fresh: FeedVideo[] = [];
  for (const video of videos) {
    if (video.isShort) {
      console.log(`↷ Short ignoré : ${video.title} (${video.youtubeId})`);
      continue;
    }
    if (!known.has(video.youtubeId)) fresh.push(video);
  }
  if (fresh.length === 0) {
    console.log(`✓ Aucune nouvelle vidéo (${videos.length} dans le flux).`);
    await reportChanged(false);
    return;
  }

  let changed = false;
  // Du plus ancien au plus récent.
  const ordered = (await enrich(fresh)).sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  for (const video of ordered) {
    const prepared = matchUpcoming(video, episodes);
    if (!prepared) {
      console.log(`⚠︎ Vidéo sans fiche préparée, non publiée sur le site : « ${video.title} » (${video.youtubeId})`);
      console.log('  ↳ Créer la fiche : npm run episode:add -- <studio>/publication/site_episode.json --youtube ' + video.youtubeId);
      continue;
    }
    const file = publishUpcoming(prepared, video);
    console.log(`★ Fiche publiée : ${file.folder} ← « ${video.title} » (${video.youtubeId})`);
    if (dryRun) continue;
    const thumbnail = localThumbnail(file.dir);
    if (thumbnail) {
      file.frontmatter.thumbnail = `./${thumbnail}`;
      console.log(`  ↳ Miniature du studio conservée (${thumbnail}).`);
    } else {
      const size = await downloadThumbnail(video.youtubeId, file.dir);
      file.frontmatter.thumbnail = './thumbnail.jpg';
      console.log(`  ↳ Miniature YouTube ${size}.jpg enregistrée.`);
    }
    await saveEpisode(file);
    changed = true;
    const index = episodes.findIndex((episode) => episode.folder === file.folder);
    if (index >= 0) episodes[index] = file;
  }
  await reportChanged(changed);
}

main().catch((error: unknown) => {
  console.error(`✗ Synchronisation impossible : ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
