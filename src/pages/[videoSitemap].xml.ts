// Sitemap vidéo pour Google (/video-sitemap.xml) : une entrée par épisode publié.
// Route paramétrée pour n'être générée qu'à partir du premier épisode publié (voir lib/sitemaps.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { episodePath, getPublishedEpisodes } from '../lib/episodes.ts';
import { hasVideoSitemap, VIDEO_SITEMAP_NAME } from '../lib/sitemaps.ts';
import { thumbnailImage } from '../lib/social.ts';
import { absoluteUrl } from '../lib/url.ts';
import { durationToSeconds, embedUrl, youtubeThumbnailUrl } from '../lib/youtube.ts';
import { xmlEscape, xmlResponse } from '../lib/xml.ts';

export const getStaticPaths = (async () => ((await hasVideoSitemap()) ? [{ params: { videoSitemap: VIDEO_SITEMAP_NAME } }] : [])) satisfies GetStaticPaths;

export const GET: APIRoute = async () => {
  const episodes = await getPublishedEpisodes();
  const entries = await Promise.all(
    episodes.map(async (episode) => {
      const { data } = episode;
      const thumbnail = data.thumbnail ? absoluteUrl((await thumbnailImage(data.thumbnail, data.title)).url) : youtubeThumbnailUrl(data.youtubeId);
      const duration = data.duration ? `\n      <video:duration>${durationToSeconds(data.duration)}</video:duration>` : '';
      return `  <url>
    <loc>${absoluteUrl(episodePath(episode))}</loc>
    <video:video>
      <video:thumbnail_loc>${xmlEscape(thumbnail)}</video:thumbnail_loc>
      <video:title>${xmlEscape(data.title)}</video:title>
      <video:description>${xmlEscape(data.summary)}</video:description>
      <video:player_loc>${xmlEscape(embedUrl(data.youtubeId))}</video:player_loc>${duration}
      <video:publication_date>${data.publishedAt.toISOString()}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>`;
    }),
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.join('\n')}
</urlset>
`;
  return xmlResponse(body);
};
