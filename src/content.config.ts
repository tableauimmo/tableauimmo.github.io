import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { episodeObject, lexiconObject, refineEpisode } from './lib/schemas.ts';

/**
 * Dossier des épisodes : un sous-dossier par épisode (index.md + thumbnail.jpg).
 * TI_EPISODES_DIR permet de construire le site à partir d'un autre dossier
 * (tests de bout en bout avec les épisodes de démonstration de tests/fixtures).
 * Un contenu invalide fait échouer le build.
 */
const EPISODES_DIR = process.env.TI_EPISODES_DIR?.trim() || './src/content/episodes';

const episodes = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: EPISODES_DIR,
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) => episodeObject(image()).superRefine(refineEpisode),
});

const lexique = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/lexique' }),
  schema: lexiconObject().extend({
    related: z.array(reference('lexique')).max(6).default([]),
  }),
});

export const collections = { episodes, lexique };
