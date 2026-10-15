// robots.txt : tous les robots sont admis, y compris — explicitement — les robots de recherche des moteurs IA.
import type { APIRoute } from 'astro';
import { hasVideoSitemap, VIDEO_SITEMAP_PATH } from '../lib/sitemaps.ts';
import { absoluteUrl } from '../lib/url.ts';

/** Robots de recherche et d'assistants IA explicitement autorisés (GEO). */
export const ALLOWED_BOTS = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Claude-SearchBot', 'Applebot'];

export const GET: APIRoute = async () => {
  const sitemaps = [absoluteUrl('/sitemap-index.xml')];
  if (await hasVideoSitemap()) sitemaps.push(absoluteUrl(VIDEO_SITEMAP_PATH));
  const groups = ALLOWED_BOTS.map((bot) => `User-agent: ${bot}\nAllow: /`).join('\n\n');
  const body = `# Tableau Immo — tous les robots sont les bienvenus.
${groups}

User-agent: *
Allow: /

${sitemaps.map((url) => `Sitemap: ${url}`).join('\n')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
