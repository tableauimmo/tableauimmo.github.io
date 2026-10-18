import type { APIRoute } from 'astro';
import { SITE } from '../../site.config.mjs';
import { CATEGORIES } from '../data/categories.ts';
import { episodeLabel } from '../lib/episode-label.ts';
import { episodePath, getPublishedEpisodes } from '../lib/episodes.ts';
import { absoluteUrl } from '../lib/url.ts';
import { xmlEscape, xmlResponse } from '../lib/xml.ts';

export const GET: APIRoute = async () => {
  const episodes = await getPublishedEpisodes();
  const items = episodes
    .map((episode) => {
      const url = absoluteUrl(episodePath(episode));
      return `    <item>
      <title>${xmlEscape(`${episodeLabel(episode.data)} : ${episode.data.title}`)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${episode.data.publishedAt.toUTCString()}</pubDate>
      <category>${xmlEscape(CATEGORIES[episode.data.category].label)}</category>
      <description>${xmlEscape(episode.data.summary)}</description>
    </item>`;
    })
    .join('\n');
  const lastBuild = episodes[0]?.data.publishedAt ?? new Date('2026-10-15T00:00:00Z');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(SITE.name)} — nouveaux épisodes</title>
    <link>${absoluteUrl('/')}</link>
    <atom:link href="${absoluteUrl('/rss.xml')}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(SITE.tagline)} Les nouveaux épisodes de ${xmlEscape(SITE.name)}.</description>
    <language>fr-FR</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return xmlResponse(body, 'application/rss+xml');
};
