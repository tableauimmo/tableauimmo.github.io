// Sitemaps annoncés aux moteurs de recherche (robots.txt) en plus de celui des pages (@astrojs/sitemap).
import { getPublishedEpisodes } from './episodes.ts';

export const VIDEO_SITEMAP_NAME = 'video-sitemap';
export const VIDEO_SITEMAP_PATH = `/${VIDEO_SITEMAP_NAME}.xml`;

/**
 * Le sitemap vidéo n'existe qu'à partir du premier épisode publié :
 * Google refuse un <urlset> sans aucune <url>.
 */
export async function hasVideoSitemap(): Promise<boolean> {
  return (await getPublishedEpisodes()).length > 0;
}
