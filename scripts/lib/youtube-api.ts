// Détails des vidéos via l'API YouTube Data v3 (facultatif : nécessite YOUTUBE_API_KEY).
// Apporte la durée exacte et la description complète, que le flux public ne fournit pas.
import { fetchWithRetry } from './http.ts';

export interface VideoDetails {
  youtubeId: string;
  title: string;
  description: string;
  publishedAt: Date;
  duration: string;
}

interface ApiItem {
  id?: string;
  snippet?: { title?: string; description?: string; publishedAt?: string };
  contentDetails?: { duration?: string };
}

const BATCH_SIZE = 50;

export async function fetchVideoDetails(ids: string[], apiKey: string): Promise<Map<string, VideoDetails>> {
  const details = new Map<string, VideoDetails>();
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = ids.slice(start, start + BATCH_SIZE);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('key', apiKey);
    const response = await fetchWithRetry(url.href);
    const payload: { items?: ApiItem[] } = await response.json();
    for (const item of payload.items ?? []) {
      const publishedAt = new Date(item.snippet?.publishedAt ?? '');
      const duration = item.contentDetails?.duration ?? '';
      if (!item.id || Number.isNaN(publishedAt.getTime()) || !/^PT/.test(duration)) {
        throw new Error(`Réponse inattendue de l'API YouTube pour la vidéo ${item.id ?? '?'}`);
      }
      // Les vidéos de plus de 24 h (P1DT…) n'existent pas ici : le schéma n'accepte que PT…
      details.set(item.id, {
        youtubeId: item.id,
        title: item.snippet?.title ?? '',
        description: item.snippet?.description ?? '',
        publishedAt,
        duration,
      });
    }
  }
  return details;
}
