// Chaîne YouTube : vues des vidéos (flux public) et, avec une clé Google, abonnés, mentions « j'aime »,
// mots-clés et réglage d'audience. Chaque vidéo d'épisode est contrôlée pour le référencement et la transparence.
import { z } from 'astro/zod';
import { parseFeed, type FeedVideo } from '../lib/feed.ts';
import { fetchWithRetry } from '../lib/http.ts';
import type { YouTubeData } from './schema.ts';

const TITLE_MAX = 70;
const HASHTAGS_IGNORED_ABOVE = 15;
const API_BATCH = 50;
const BRAND = 'tableau immo';

export interface EpisodeLink {
  numero: number;
  url: string;
  youtubeId: string;
}

export interface VideoFacts {
  title: string;
  description: string;
  isShort: boolean;
  tags?: string[] | undefined;
  madeForKids?: boolean | undefined;
}

type Problem = YouTubeData['videos'][number]['problemes'][number];

/** Contrôles de référencement d'une vidéo (le titre et la description sont ce que lisent YouTube et Google). */
export function auditVideo(video: VideoFacts, episode: EpisodeLink | undefined): Problem[] {
  const problems: Problem[] = [];
  const add = (code: string, message: string, correction: string) => problems.push({ code, message, correction });
  if (!video.title.toLowerCase().includes(BRAND)) {
    add('titre-sans-marque', 'Le titre ne contient pas « Tableau Immo ».', 'Finir le titre par « | Tableau Immo » pour que la marque soit associée à chaque vidéo.');
  }
  if (video.title.length > TITLE_MAX) {
    add('titre-long', `Titre de ${video.title.length} caractères (coupé dans les résultats).`, `Garder l'essentiel dans les ${TITLE_MAX} premiers caractères.`);
  }
  if (video.madeForKids === true) {
    add('audience-enfants', 'Vidéo déclarée « conçue pour les enfants » : commentaires, notifications et annonces personnalisées sont désactivés.', 'YouTube Studio → Détails → Audience : « Non, elle n’est pas conçue pour les enfants » (contenu financier pour adultes).');
  }
  if (video.isShort) return problems;
  const hashtags = video.description.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (hashtags.length === 0) add('hashtags-absents', 'Aucun hashtag.', 'Ajouter 3 hashtags en fin de description : #immobilier #investissementlocatif #tableauimmo.');
  if (hashtags.length > HASHTAGS_IGNORED_ABOVE) add('hashtags-excessifs', `${hashtags.length} hashtags : YouTube les ignore tous au-delà de ${HASHTAGS_IGNORED_ABOVE}.`, 'Garder 3 à 5 hashtags.');
  if (video.tags !== undefined && video.tags.length === 0) add('tags-absents', 'Aucun mot-clé (tags).', 'Ajouter des mots-clés : Tableau Immo, investissement immobilier, le sujet de l’épisode (LMNP, crédit…).');
  if (!/\bIA\b|intelligence artificielle/i.test(video.description)) {
    add('mention-ia-absente', 'La description ne signale pas l’usage de l’IA.', 'Ajouter la ligne : « Illustrations et voix générées avec l’aide de l’IA ; contenu vérifié et sourcé. »');
  }
  if (episode) {
    if (!video.description.includes(episode.url)) {
      add('lien-site-absent', 'La description ne renvoie pas vers la page de l’épisode sur le site.', `Ajouter en 2e ligne de la description : « ▶ Le tableau, les sources et la transcription : ${episode.url} »`);
    }
    if (!/^\s*0?0:00\b/m.test(video.description)) {
      add('chapitres-absents', 'Pas de chapitres dans la description.', 'Ajouter les chapitres (une ligne « 0:00 Titre » par moment, au moins 3) : Google les affiche comme moments clés.');
    }
  }
  return problems;
}

const apiVideoSchema = z.object({
  id: z.string(),
  snippet: z.object({ tags: z.array(z.string()).optional() }).optional(),
  statistics: z.object({ viewCount: z.string().optional(), likeCount: z.string().optional(), commentCount: z.string().optional() }).optional(),
  status: z.object({ madeForKids: z.boolean().optional() }).optional(),
});
type ApiVideo = z.infer<typeof apiVideoSchema>;

const toCount = (value: string | undefined) => (value === undefined ? undefined : Number(value));

async function apiVideos(ids: string[], apiKey: string): Promise<Map<string, ApiVideo>> {
  const videos = new Map<string, ApiVideo>();
  for (let start = 0; start < ids.length; start += API_BATCH) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,statistics,status');
    url.searchParams.set('id', ids.slice(start, start + API_BATCH).join(','));
    url.searchParams.set('key', apiKey);
    const payload = z.object({ items: z.array(apiVideoSchema).default([]) }).parse(await (await fetchWithRetry(url.href)).json());
    for (const item of payload.items) videos.set(item.id, item);
  }
  return videos;
}

async function apiChannel(channelId: string, apiKey: string): Promise<YouTubeData['chaine']> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'statistics');
  url.searchParams.set('id', channelId);
  url.searchParams.set('key', apiKey);
  const payload = z
    .object({ items: z.array(z.object({ statistics: z.object({ subscriberCount: z.string().optional(), viewCount: z.string().optional(), videoCount: z.string().optional() }) })).default([]) })
    .parse(await (await fetchWithRetry(url.href)).json());
  const statistics = payload.items[0]?.statistics;
  if (!statistics) throw new Error(`Chaîne YouTube introuvable : ${channelId}`);
  return {
    ...(statistics.subscriberCount ? { abonnes: Number(statistics.subscriberCount) } : {}),
    ...(statistics.viewCount ? { vues: Number(statistics.viewCount) } : {}),
    ...(statistics.videoCount ? { videos: Number(statistics.videoCount) } : {}),
  };
}

export function videoEntry(video: FeedVideo, api: ApiVideo | undefined, episode: EpisodeLink | undefined): YouTubeData['videos'][number] {
  const views = toCount(api?.statistics?.viewCount) ?? video.views;
  const likes = toCount(api?.statistics?.likeCount);
  const comments = toCount(api?.statistics?.commentCount);
  return {
    id: video.youtubeId,
    titre: video.title,
    publieeLe: video.publishedAt.toISOString(),
    short: video.isShort,
    ...(views === undefined ? {} : { vues: views }),
    ...(likes === undefined ? {} : { jaime: likes }),
    ...(comments === undefined ? {} : { commentaires: comments }),
    ...(episode ? { episode: episode.numero } : {}),
    problemes: auditVideo(
      { title: video.title, description: video.description, isShort: video.isShort, tags: api ? (api.snippet?.tags ?? []) : undefined, madeForKids: api?.status?.madeForKids },
      episode,
    ),
  };
}

export async function collectYouTube(feedUrl: string, channelId: string, episodes: EpisodeLink[], apiKey: string | undefined): Promise<YouTubeData> {
  const feed = parseFeed(await (await fetchWithRetry(feedUrl)).text());
  const byVideo = new Map(episodes.map((episode) => [episode.youtubeId, episode]));
  const api = apiKey ? await apiVideos(feed.map((video) => video.youtubeId), apiKey) : new Map<string, ApiVideo>();
  return {
    source: apiKey ? 'api' : 'flux',
    chaine: apiKey ? await apiChannel(channelId, apiKey) : {},
    videos: feed.map((video) => videoEntry(video, api.get(video.youtubeId), byVideo.get(video.youtubeId))),
  };
}
