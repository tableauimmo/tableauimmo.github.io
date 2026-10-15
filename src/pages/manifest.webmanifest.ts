import type { APIRoute } from 'astro';
import { SITE } from '../../site.config.mjs';
import { href } from '../lib/url.ts';

export const GET: APIRoute = () => {
  const manifest = {
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.tagline,
    lang: SITE.language,
    start_url: href('/'),
    scope: href('/'),
    display: 'standalone',
    background_color: '#141516',
    theme_color: SITE.themeColor,
    categories: ['education', 'finance'],
    icons: [
      { src: href('/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: href('/icon-512.png'), sizes: '512x512', type: 'image/png' },
      { src: href('/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } });
};
