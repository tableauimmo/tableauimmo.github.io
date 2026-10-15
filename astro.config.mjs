// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { SITE } from './site.config.mjs';
import { rehypeBaseLinks, rehypeScrollableTables, rehypeTranscript } from './src/lib/markdown-plugins.mjs';
import { frenchTypography } from './src/lib/french-typography.mjs';

// Pages exclues du sitemap (pas de valeur pour les moteurs de recherche).
const SITEMAP_EXCLUDED = ['/404/'];

// Cache de contenu séparé quand le site est construit avec les épisodes de démonstration (tests) :
// ils ne peuvent jamais se mélanger au contenu réel.
const CACHE_DIR = process.env.TI_EPISODES_DIR ? './node_modules/.astro-fixture' : './node_modules/.astro';

export default defineConfig({
  site: SITE.url,
  base: SITE.base,
  cacheDir: CACHE_DIR,
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr'],
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    // Aucun bloc de code sur le site : pas de coloration syntaxique.
    syntaxHighlight: false,
    // Processeur unified (remark/rehype) pour les plugins du site : liens avec chemin de base,
    // tableaux défilants sur mobile, transcription repliable des épisodes.
    processor: unified({
      rehypePlugins: [[rehypeBaseLinks, { base: SITE.base }], rehypeScrollableTables, rehypeTranscript],
    }),
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  image: {
    responsiveStyles: true,
  },
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://i.ytimg.com",
        "font-src 'self'",
        "frame-src https://www.youtube-nocookie.com",
        "connect-src 'self'",
        "media-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // Scripts : uniquement ceux du site (empreintes calculées par Astro). Aucun pistage.
      scriptDirective: {
        resources: ["'self'"],
      },
      // Site statique sans contenu saisi par les visiteurs : le style en ligne ne crée pas de surface d'injection.
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
  integrations: [
    frenchTypography(),
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDED.some((path) => new URL(page).pathname.endsWith(path)),
    }),
  ],
});
