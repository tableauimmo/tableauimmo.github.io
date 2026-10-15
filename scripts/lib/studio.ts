// Conversion du fichier produit par le studio (episodes/epNN_slug/publication/site_episode.json)
// en fiche d'épisode du site (src/content/episodes/epNN-slug/index.md). Format documenté dans le README.
import path from 'node:path';
import { z } from 'astro/zod';
import { chapterSchema, episodeFileSchema, faqItemSchema, shortSchema, slugSchema, sourceSchema, SUMMARY_MAX, SUMMARY_MIN, tableauSchema } from '../../src/lib/schemas.ts';
import { CATEGORY_KEYS } from '../../src/data/categories.ts';
import { TOOL_IDS } from '../../src/data/tools.ts';
import { ISO_DURATION_PATTERN } from '../../src/lib/youtube.ts';
import { episodeFolder, type EpisodeFile, type Frontmatter } from './store.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue : AAAA-MM-JJ');

export const studioEpisodeSchema = z.object({
  number: z.number().int().positive(),
  slug: slugSchema,
  title: z.string().min(5).max(100),
  summary: z.string().min(SUMMARY_MIN).max(SUMMARY_MAX),
  teaser: z.string().min(20).max(240),
  category: z.enum(CATEGORY_KEYS),
  tags: z.array(z.string()).default([]),
  keyTakeaways: z.array(z.string()).min(3).max(7),
  tableau: tableauSchema,
  chapters: z.array(chapterSchema).default([]),
  faq: z.array(faqItemSchema).default([]),
  sources: z.array(sourceSchema.extend({ date: isoDate.optional() })).min(1),
  tools: z.array(z.enum(TOOL_IDS)).default([]),
  terms: z.array(slugSchema).default([]),
  duration: z.string().regex(ISO_DURATION_PATTERN).optional(),
  updatedAt: isoDate.optional(),
  /** Miniature, chemin relatif au fichier JSON (ex. « miniature.jpg ») */
  thumbnail: z.string().min(1).optional(),
  shorts: z.array(shortSchema).optional(),
  /** Article (Markdown) affiché sous le tableau */
  article: z.string().min(50),
  /** Transcription intégrale (texte ou Markdown), repliée dans la page */
  transcript: z.string().min(50),
});
export type StudioEpisode = z.infer<typeof studioEpisodeSchema>;

function issues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`).join('\n  ');
}

/** Valide le JSON du studio ; message d'erreur lisible (un problème par ligne). */
export function parseStudioEpisode(json: unknown, source = 'site_episode.json'): StudioEpisode {
  const parsed = studioEpisodeSchema.safeParse(json);
  if (!parsed.success) throw new Error(`${source} invalide :\n  ${issues(parsed.error)}`);
  return parsed.data;
}

export interface Publication {
  youtubeId: string;
  publishedAt: Date;
}

/** Construit la fiche Markdown (frontmatter + article + transcription). */
export function studioToEpisodeFile(studio: StudioEpisode, episodesDir: string, options: { thumbnailName?: string | undefined; publication?: Publication | undefined } = {}): EpisodeFile {
  const frontmatter: Frontmatter = {
    number: studio.number,
    title: studio.title,
    slug: studio.slug,
    status: options.publication ? 'published' : 'upcoming',
    ...(options.publication ? { youtubeId: options.publication.youtubeId, publishedAt: options.publication.publishedAt.toISOString() } : {}),
    // La date de mise à jour ne peut pas précéder la publication.
    ...(studio.updatedAt && (!options.publication || new Date(studio.updatedAt) >= options.publication.publishedAt) ? { updatedAt: studio.updatedAt } : {}),
    ...(studio.duration ? { duration: studio.duration } : {}),
    summary: studio.summary,
    teaser: studio.teaser,
    category: studio.category,
    tags: studio.tags,
    keyTakeaways: studio.keyTakeaways,
    tableau: studio.tableau,
    chapters: studio.chapters,
    faq: studio.faq,
    sources: studio.sources.map((source) => ({ title: source.title, url: source.url, ...(source.date ? { date: source.date } : {}) })),
    tools: studio.tools,
    terms: studio.terms,
    ...(options.thumbnailName ? { thumbnail: `./${options.thumbnailName}` } : {}),
    ...(studio.shorts?.length ? { shorts: studio.shorts } : {}),
  };
  const transcript = studio.transcript.trim().replace(/^#{1,2}\s*Transcription[^\n]*\n+/i, '');
  const body = `\n${studio.article.trim()}\n\n## Transcription\n\n${transcript}\n`;
  const checked = episodeFileSchema.safeParse(frontmatter);
  if (!checked.success) throw new Error(`Fiche générée invalide :\n  ${issues(checked.error)}`);
  const folder = episodeFolder(studio.number, studio.slug);
  return { dir: path.join(episodesDir, folder), folder, frontmatter, body };
}
