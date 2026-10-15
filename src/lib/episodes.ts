// Accès aux épisodes (collection de contenu) avec les règles de publication du site.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { CategoryKey } from '../data/categories.ts';
import type { ToolId } from '../data/tools.ts';

export type Episode = CollectionEntry<'episodes'>;
export type PublishedEpisode = Episode & {
  data: Episode['data'] & { youtubeId: string; publishedAt: Date };
};

export function isPublished(episode: Episode): episode is PublishedEpisode {
  return episode.data.status === 'published' && episode.data.youtubeId !== undefined && episode.data.publishedAt !== undefined;
}

export function episodePath(episode: Episode): string {
  return `/episodes/${episode.data.slug}/`;
}

/** Date de dernière vérification affichée (« Mis à jour le ») : updatedAt, sinon la date de publication. */
export function lastUpdated(episode: PublishedEpisode): Date {
  return episode.data.updatedAt ?? episode.data.publishedAt;
}

function assertUnique(episodes: Episode[]): void {
  const slugs = new Map<string, string>();
  const numbers = new Map<number, string>();
  for (const episode of episodes) {
    const sameSlug = slugs.get(episode.data.slug);
    if (sameSlug) throw new Error(`Slug d'épisode en double « ${episode.data.slug} » : ${sameSlug} et ${episode.id}`);
    slugs.set(episode.data.slug, episode.id);
    const sameNumber = numbers.get(episode.data.number);
    if (sameNumber) throw new Error(`Numéro d'épisode en double (${episode.data.number}) : ${sameNumber} et ${episode.id}`);
    numbers.set(episode.data.number, episode.id);
  }
}

let cache: Promise<Episode[]> | undefined;

/** Lecture unique par build (le contenu ne change pas pendant un build ; en dev, relu à chaque appel). */
async function loadEpisodes(): Promise<Episode[]> {
  if (cache && import.meta.env.PROD) return cache;
  cache = getCollection('episodes').then((episodes) => {
    assertUnique(episodes);
    return episodes;
  });
  return cache;
}

/** Épisodes publiés, du plus récent au plus ancien. */
export async function getPublishedEpisodes(): Promise<PublishedEpisode[]> {
  const episodes = await loadEpisodes();
  return episodes
    .filter(isPublished)
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime() || b.data.number - a.data.number);
}

/** Épisodes annoncés (pas encore sur YouTube), dans l'ordre de sortie. */
export async function getUpcomingEpisodes(): Promise<Episode[]> {
  const episodes = await loadEpisodes();
  return episodes.filter((episode) => !isPublished(episode)).sort((a, b) => a.data.number - b.data.number);
}

export function inCategory(list: PublishedEpisode[], category: CategoryKey): PublishedEpisode[] {
  return list.filter((episode) => episode.data.category === category);
}

export function forTool(list: PublishedEpisode[], tool: ToolId): PublishedEpisode[] {
  return list.filter((episode) => episode.data.tools.includes(tool));
}

export function forTerm(list: PublishedEpisode[], term: string): PublishedEpisode[] {
  return list.filter((episode) => episode.data.terms.includes(term));
}

/** Épisodes à suggérer : même thème d'abord, puis les plus récents. */
export function relatedEpisodes(list: PublishedEpisode[], current: PublishedEpisode, count = 3): PublishedEpisode[] {
  const others = list.filter((episode) => episode.id !== current.id);
  const sameCategory = others.filter((episode) => episode.data.category === current.data.category);
  const rest = others.filter((episode) => episode.data.category !== current.data.category);
  return [...sameCategory, ...rest].slice(0, count);
}

/** Épisode précédent / suivant dans l'ordre de la série (par numéro). */
export function neighbours(list: PublishedEpisode[], current: PublishedEpisode): { previous?: PublishedEpisode; next?: PublishedEpisode } {
  const ordered = [...list].sort((a, b) => a.data.number - b.data.number);
  const index = ordered.findIndex((episode) => episode.id === current.id);
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;
  return { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
}
