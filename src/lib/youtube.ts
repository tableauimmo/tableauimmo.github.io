// Utilitaires YouTube partagés par le site et les scripts de synchronisation.
// Ce module ne dépend d'aucune API Astro : il doit rester importable depuis Node.

export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface Chapter {
  /** Horodatage affiché « m:ss » ou « h:mm:ss » */
  t: string;
  title: string;
}

const ID_FROM_PATH = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/;

/** Extrait l'identifiant d'une URL YouTube (watch, youtu.be, shorts, embed, live) ou d'un identifiant brut. */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (YOUTUBE_ID_PATTERN.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(?:www\.|m\.|music\.)/, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? '';
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  const fromQuery = url.searchParams.get('v');
  if (fromQuery && YOUTUBE_ID_PATTERN.test(fromQuery)) return fromQuery;
  return url.pathname.match(ID_FROM_PATH)?.[1] ?? null;
}

export function isShortUrl(url: string): boolean {
  return /youtube\.com\/shorts\//.test(url);
}

/** Lecteur « sans cookies » (youtube-nocookie.com). */
export function embedUrl(id: string, options: { start?: number; autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (options.start && options.start > 0) params.set('start', String(Math.floor(options.start)));
  if (options.autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function watchUrl(id: string, start?: number): string {
  const base = `https://www.youtube.com/watch?v=${id}`;
  return start && start > 0 ? `${base}&t=${Math.floor(start)}s` : base;
}

/** Miniature publique de YouTube (repli quand l'épisode n'a pas encore sa miniature locale). */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** « Titre | Tableau Immo » -> « Titre » ; retire aussi les hashtags et emoji de fin. */
export function cleanVideoTitle(title: string): string {
  const head = title.split(/\s[|•–—]\s/)[0] ?? title;
  return head
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Forme normalisée pour comparer deux titres (minuscules, sans accents ni ponctuation). */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(text: string): string {
  return normalizeForMatch(text).replace(/\s+/g, '-');
}

export const TIMESTAMP_PATTERN = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;
const TIMESTAMP_LINE = /^\s*(?:[-•▶︎►]\s*)?\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:|]?\s*(.+?)\s*$/;

/** « 1:05 » → 65 ; « 1:02:03 » → 3723 */
export function timestampToSeconds(stamp: string): number {
  if (!TIMESTAMP_PATTERN.test(stamp)) throw new Error(`Horodatage invalide : « ${stamp} » (attendu m:ss)`);
  const parts = stamp.split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60)) throw new Error(`Horodatage invalide : « ${stamp} »`);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** 65 → « 1:05 » ; 3723 → « 1:02:03 » */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/**
 * Chapitres d'une description YouTube, selon les règles de YouTube :
 * au moins 3 horodatages, le premier à 0:00, dans l'ordre croissant.
 * Si ces règles ne sont pas respectées, YouTube n'affiche pas de chapitres : on renvoie [].
 */
export function parseChapters(description: string): Chapter[] {
  const chapters: { start: number; title: string; t: string }[] = [];
  for (const line of description.split(/\r?\n/)) {
    const match = line.match(TIMESTAMP_LINE);
    if (!match?.[1] || !match[2]) continue;
    let start: number;
    try {
      start = timestampToSeconds(match[1]);
    } catch {
      continue;
    }
    chapters.push({ start, t: match[1], title: match[2] });
  }
  if (chapters.length < 3 || chapters[0]?.start !== 0) return [];
  const ascending = chapters.every((chapter, index) => index === 0 || chapter.start > (chapters[index - 1]?.start ?? 0));
  return ascending ? chapters.map(({ t, title }) => ({ t, title })) : [];
}

export const ISO_DURATION_PATTERN = /^PT(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

export function durationToSeconds(iso: string): number {
  const match = iso.match(ISO_DURATION_PATTERN);
  if (!match) throw new Error(`Durée ISO 8601 invalide : ${iso}`);
  const [, hours = '0', minutes = '0', seconds = '0'] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** « 10 min 32 s », « 1 h 02 min » */
export function formatDuration(iso: string): string {
  const total = durationToSeconds(iso);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes) return seconds ? `${minutes} min ${String(seconds).padStart(2, '0')} s` : `${minutes} min`;
  return `${seconds} s`;
}

/** Durée arrondie à la minute pour les cartes : « 10 min » */
export function formatDurationShort(iso: string): string {
  return `${Math.max(1, Math.round(durationToSeconds(iso) / 60))} min`;
}
