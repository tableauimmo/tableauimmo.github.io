// Crée (ou met à jour) la fiche d'un épisode à partir du fichier produit par le studio :
//
//   npm run episode:add -- studio/TableauImmo_Studio/episodes/ep01_mon-sujet/publication/site_episode.json
//   npm run episode:add -- <dossier de l'épisode du studio>          # cherche publication/site_episode.json
//
// Options :
//   --force                 remplace une fiche existante (même numéro ou même slug), en gardant ses infos YouTube
//   --youtube <lien|id>     publie tout de suite (sans attendre la synchro horaire) ; avec --date AAAA-MM-JJ
//   --episodes-dir <dir>    dossier des fiches (défaut : src/content/episodes)
//
// La fiche est créée avec le statut « upcoming » : l'épisode apparaît comme « Bientôt sur YouTube ».
// La synchronisation YouTube (toutes les heures) la publie dès que la vidéo sort.
import { existsSync } from 'node:fs';
import { copyFile, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parseYouTubeId } from '../src/lib/youtube.ts';
import { loadEpisodes, saveEpisode, THUMBNAIL_FILES } from './lib/store.ts';
import { parseStudioEpisode, studioToEpisodeFile, type Publication } from './lib/studio.ts';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    force: { type: 'boolean', default: false },
    youtube: { type: 'string' },
    date: { type: 'string' },
    'episodes-dir': { type: 'string' },
  },
});

async function resolveJson(input: string): Promise<string> {
  const resolved = path.resolve(input);
  if ((await stat(resolved)).isDirectory()) {
    for (const candidate of ['publication/site_episode.json', 'site_episode.json']) {
      const file = path.join(resolved, candidate);
      if (existsSync(file)) return file;
    }
    throw new Error(`Aucun site_episode.json dans ${input} (attendu : publication/site_episode.json)`);
  }
  return resolved;
}

function publication(): Publication | undefined {
  if (!args.youtube) return undefined;
  const youtubeId = parseYouTubeId(args.youtube);
  if (!youtubeId) throw new Error(`Lien YouTube non reconnu : ${args.youtube}`);
  const day = args.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Date invalide : ${day} (attendu AAAA-MM-JJ)`);
  return { youtubeId, publishedAt: new Date(`${day}T12:00:00Z`) };
}

async function main(): Promise<void> {
  const input = positionals[0];
  if (!input) throw new Error('Usage : npm run episode:add -- <site_episode.json | dossier de l’épisode du studio> [--force] [--youtube <lien> --date AAAA-MM-JJ]');
  const jsonFile = await resolveJson(input);
  const studio = parseStudioEpisode(JSON.parse(await readFile(jsonFile, 'utf8')), path.relative(process.cwd(), jsonFile));

  const episodesDir = path.resolve(args['episodes-dir'] ?? process.env.TI_EPISODES_DIR ?? 'src/content/episodes');
  const existing = (await loadEpisodes(episodesDir)).filter((episode) => episode.frontmatter.number === studio.number || episode.frontmatter.slug === studio.slug);
  if (existing.length && !args.force) {
    throw new Error(`Une fiche existe déjà (${existing.map((episode) => episode.folder).join(', ')}). Relancer avec --force pour la remplacer.`);
  }
  const previous = existing[0];

  const thumbnailSource = studio.thumbnail ? path.resolve(path.dirname(jsonFile), studio.thumbnail) : undefined;
  if (thumbnailSource && !existsSync(thumbnailSource)) throw new Error(`Miniature introuvable : ${thumbnailSource}`);
  const extension = thumbnailSource ? path.extname(thumbnailSource).toLowerCase() : '';
  if (thumbnailSource && !['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) throw new Error(`Miniature : format non pris en charge (${extension})`);
  const thumbnailName = thumbnailSource ? `thumbnail${extension === '.jpeg' ? '.jpg' : extension}` : undefined;

  // Une fiche déjà publiée garde sa vidéo et sa date, même si le studio la régénère.
  const keepPublished: Publication | undefined =
    previous?.frontmatter.status === 'published' && typeof previous.frontmatter.youtubeId === 'string'
      ? { youtubeId: previous.frontmatter.youtubeId, publishedAt: new Date(String(previous.frontmatter.publishedAt)) }
      : undefined;
  const file = studioToEpisodeFile(studio, episodesDir, { thumbnailName, publication: publication() ?? keepPublished });

  for (const old of existing) if (old.dir !== file.dir) await rm(old.dir, { recursive: true, force: true });
  await saveEpisode(file);
  if (thumbnailSource && thumbnailName) {
    for (const name of THUMBNAIL_FILES) if (name !== thumbnailName) await rm(path.join(file.dir, name), { force: true });
    await copyFile(thumbnailSource, path.join(file.dir, thumbnailName));
  }
  console.log(`✓ ${previous ? 'Fiche mise à jour' : 'Fiche créée'} : src/content/episodes/${file.folder}/index.md (${String(file.frontmatter.status)})`);
  console.log(file.frontmatter.status === 'upcoming' ? '  ↳ Publiée automatiquement par la synchro YouTube dès la sortie de la vidéo.' : '  ↳ Page publiée au prochain déploiement.');
  console.log('Étape suivante : npm run verify, puis commit et push (voir README).');
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
