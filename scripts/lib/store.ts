// Lecture / écriture des fiches d'épisodes (src/content/episodes/<dossier>/index.md + thumbnail.jpg).
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { normalizeForMatch, parseChapters } from '../../src/lib/youtube.ts';
import { fetchWithRetry } from './http.ts';

export type Frontmatter = Record<string, unknown>;

export interface EpisodeFile {
  dir: string;
  folder: string;
  frontmatter: Frontmatter;
  body: string;
}

export interface VideoInfo {
  youtubeId: string;
  title: string;
  description: string;
  publishedAt: Date;
  duration?: string | undefined;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
export const THUMBNAIL_FILES = ['thumbnail.jpg', 'thumbnail.png', 'thumbnail.webp'];

export function parseEpisodeFile(source: string, folder: string, dir: string): EpisodeFile {
  const match = source.match(FRONTMATTER);
  if (!match) throw new Error(`${folder}/index.md : en-tête YAML (---) introuvable`);
  const frontmatter: unknown = parseYaml(match[1] ?? '');
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error(`${folder}/index.md : en-tête YAML invalide`);
  }
  return { dir, folder, frontmatter: frontmatter as Frontmatter, body: match[2] ?? '' };
}

export function serializeEpisode(file: Pick<EpisodeFile, 'frontmatter' | 'body'>): string {
  const yaml = stringifyYaml(file.frontmatter, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n${file.body.startsWith('\n') ? file.body : `\n${file.body}`}`;
}

/** Toutes les fiches d'un dossier (dossier absent ou vide : aucune fiche). */
export async function loadEpisodes(episodesDir: string): Promise<EpisodeFile[]> {
  if (!existsSync(episodesDir)) return [];
  const folders = (await readdir(episodesDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const files: EpisodeFile[] = [];
  for (const folder of folders.sort()) {
    const indexPath = path.join(episodesDir, folder, 'index.md');
    if (!existsSync(indexPath)) continue;
    files.push(parseEpisodeFile(await readFile(indexPath, 'utf8'), folder, path.join(episodesDir, folder)));
  }
  return files;
}

export async function saveEpisode(file: EpisodeFile): Promise<void> {
  await mkdir(file.dir, { recursive: true });
  await writeFile(path.join(file.dir, 'index.md'), serializeEpisode(file), 'utf8');
}

/** Dossier d'un épisode : « ep07-mon-titre ». */
export function episodeFolder(number: number, slug: string): string {
  return `ep${String(number).padStart(2, '0')}-${slug}`.slice(0, 80);
}

// Pas de \b : il ne reconnaît pas les lettres accentuées (« Épisode »).
const EPISODE_NUMBER = /(?<![\p{L}\p{N}])(?:épisode|episode|ep\.?)\s*(?:n°\s*)?0*(\d{1,3})(?!\p{N})/iu;

/** Numéro d'épisode écrit dans un titre ou une description (« Épisode 3 », « EP03 »). */
export function episodeNumberIn(text: string): number | null {
  const match = text.match(EPISODE_NUMBER);
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Retrouve la fiche préparée (statut « upcoming ») correspondant à une vidéo, par ordre de fiabilité :
 * 1. la description contient le lien de la page de l'épisode (/episodes/<slug>/) ;
 * 2. le titre YouTube contient le titre de la fiche ;
 * 3. le même numéro d'épisode (« Épisode 3 », « EP03 ») figure dans le titre ou la description.
 * Plusieurs fiches possibles au même niveau : erreur (on ne devine jamais).
 */
export function matchUpcoming(video: VideoInfo, episodes: EpisodeFile[]): EpisodeFile | null {
  const upcoming = episodes.filter((episode) => episode.frontmatter.status === 'upcoming');
  const byLink = upcoming.filter((episode) => video.description.includes(`/episodes/${String(episode.frontmatter.slug)}/`));
  const videoTitle = normalizeForMatch(video.title);
  const byTitle = upcoming.filter((episode) => {
    const title = normalizeForMatch(String(episode.frontmatter.title ?? ''));
    return title.length > 0 && videoTitle.includes(title);
  });
  const videoNumber = episodeNumberIn(`${video.title}\n${video.description}`);
  const byNumber = videoNumber === null ? [] : upcoming.filter((episode) => episode.frontmatter.number === videoNumber);
  for (const matches of [byLink, byTitle, byNumber]) {
    if (matches.length > 1) {
      throw new Error(`La vidéo « ${video.title} » correspond à plusieurs fiches : ${matches.map((match) => match.folder).join(', ')}`);
    }
    if (matches[0]) return matches[0];
  }
  return null;
}

const THUMBNAIL_SIZES = ['maxresdefault', 'sddefault', 'hqdefault'] as const;

/** Télécharge la meilleure miniature YouTube disponible dans <dossier>/thumbnail.jpg. */
export async function downloadThumbnail(youtubeId: string, dir: string): Promise<string> {
  for (const size of THUMBNAIL_SIZES) {
    const url = `https://i.ytimg.com/vi/${youtubeId}/${size}.jpg`;
    const response = await fetchWithRetry(url, { acceptStatus: [404] });
    if (response.status === 404) continue;
    const type = response.headers.get('content-type') ?? '';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!type.startsWith('image/') || bytes.length < 2048) continue;
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'thumbnail.jpg'), bytes);
    return size;
  }
  throw new Error(`Aucune miniature disponible pour la vidéo ${youtubeId}`);
}

/** Miniature locale déjà présente dans le dossier de l'épisode (fournie par le studio), s'il y en a une. */
export function localThumbnail(dir: string): string | null {
  return THUMBNAIL_FILES.find((name) => existsSync(path.join(dir, name))) ?? null;
}

/** Publie une fiche préparée : on garde tout le contenu éditorial, on ajoute les informations YouTube. */
export function publishUpcoming(file: EpisodeFile, video: VideoInfo): EpisodeFile {
  const frontmatter: Frontmatter = { ...file.frontmatter };
  frontmatter.status = 'published';
  frontmatter.youtubeId = video.youtubeId;
  frontmatter.publishedAt = video.publishedAt.toISOString();
  if (video.duration) frontmatter.duration = video.duration;
  const existingChapters = Array.isArray(frontmatter.chapters) ? frontmatter.chapters : [];
  const chapters = parseChapters(video.description);
  if (existingChapters.length === 0 && chapters.length > 0) frontmatter.chapters = chapters;
  // La date de mise à jour ne peut pas précéder la publication.
  if (typeof frontmatter.updatedAt === 'string' && new Date(frontmatter.updatedAt) < video.publishedAt) delete frontmatter.updatedAt;
  return { ...file, frontmatter };
}
