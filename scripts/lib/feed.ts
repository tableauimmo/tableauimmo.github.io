// Lecture du flux Atom public d'une chaîne YouTube (15 dernières vidéos).
import { XMLParser } from 'fast-xml-parser';
import { isShortUrl, YOUTUBE_ID_PATTERN } from '../../src/lib/youtube.ts';

export interface FeedVideo {
  youtubeId: string;
  title: string;
  description: string;
  publishedAt: Date;
  url: string;
  isShort: boolean;
  /** Nombre de vues publié dans le flux (absent si YouTube ne le fournit pas). */
  views?: number;
}

interface RawLink {
  '@_rel'?: string;
  '@_href'?: string;
}

interface RawEntry {
  'yt:videoId'?: string;
  title?: string;
  published?: string;
  link?: RawLink | RawLink[];
  'media:group'?: {
    'media:description'?: string;
    'media:community'?: { 'media:statistics'?: { '@_views'?: string } };
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'entry',
  parseTagValue: false,
  trimValues: true,
});

function asText(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

export function parseFeed(xml: string): FeedVideo[] {
  const document: { feed?: { entry?: RawEntry[] } } = parser.parse(xml);
  if (!document.feed) throw new Error('Flux YouTube invalide : élément <feed> absent');
  const entries = document.feed.entry ?? [];
  return entries.map((entry, index) => {
    const youtubeId = asText(entry['yt:videoId']);
    if (!YOUTUBE_ID_PATTERN.test(youtubeId)) throw new Error(`Entrée ${index} du flux : identifiant vidéo invalide « ${youtubeId} »`);
    const publishedAt = new Date(asText(entry.published));
    if (Number.isNaN(publishedAt.getTime())) throw new Error(`Vidéo ${youtubeId} : date de publication invalide`);
    const links = Array.isArray(entry.link) ? entry.link : entry.link ? [entry.link] : [];
    const url = links.find((link) => link['@_rel'] === 'alternate')?.['@_href'] ?? `https://www.youtube.com/watch?v=${youtubeId}`;
    const views = Number(entry['media:group']?.['media:community']?.['media:statistics']?.['@_views']);
    return {
      youtubeId,
      title: asText(entry.title),
      description: asText(entry['media:group']?.['media:description']),
      publishedAt,
      url,
      isShort: isShortUrl(url),
      ...(Number.isInteger(views) && views >= 0 ? { views } : {}),
    };
  });
}
