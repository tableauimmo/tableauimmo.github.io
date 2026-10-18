// Schémas de validation du contenu, partagés par le site (src/content.config.ts) et les scripts
// (ajout d'épisode depuis le studio, synchro YouTube). Aucun import « astro:* » : importable depuis Node.
import { z } from 'astro/zod';
import { SPECIAL_OFFSET } from './episode-label.ts';
import { CATEGORY_KEYS } from '../data/categories.ts';
import { TOOL_IDS } from '../data/tools.ts';
import { ISO_DURATION_PATTERN, TIMESTAMP_PATTERN, timestampToSeconds, YOUTUBE_ID_PATTERN } from './youtube.ts';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SUMMARY_MIN = 70;
export const SUMMARY_MAX = 160;

export const slugSchema = z.string().regex(SLUG_PATTERN, 'slug : minuscules, chiffres et tirets');

/** Source officielle citée (Légifrance, BOFiP, service-public.fr, Banque de France, INSEE, ANIL…). */
export const sourceSchema = z.object({
  title: z.string().min(3),
  url: z.url({ protocol: /^https$/ }),
  /** Date de consultation ou de publication (AAAA-MM-JJ) */
  date: z.coerce.date().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const faqItemSchema = z.object({
  q: z.string().min(8).max(200),
  a: z.string().min(20).max(1200),
});

/** « Le tableau de l'épisode » : un vrai tableau HTML, la signature de la marque. */
export const tableauSchema = z
  .object({
    caption: z.string().min(5).max(140),
    columns: z.array(z.string().min(1).max(60)).min(2).max(6),
    rows: z.array(z.array(z.coerce.string().max(80))).min(1).max(20),
    note: z.string().min(5).max(300).optional(),
  })
  .superRefine((tableau, ctx) => {
    tableau.rows.forEach((row, index) => {
      if (row.length !== tableau.columns.length) {
        ctx.addIssue({ code: 'custom', path: ['rows', index], message: `${row.length} cellules pour ${tableau.columns.length} colonnes` });
      }
    });
  });
export type Tableau = z.infer<typeof tableauSchema>;

export const chapterSchema = z.object({
  t: z.string().regex(TIMESTAMP_PATTERN, 'horodatage « m:ss » attendu'),
  title: z.string().min(2).max(100),
});

export const SHORT_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'x'] as const;

export const shortSchema = z.object({
  platform: z.enum(SHORT_PLATFORMS),
  url: z.url({ protocol: /^https$/ }),
  title: z.string().min(2).optional(),
});

/**
 * Champs d'un épisode. `thumbnail` est fourni par l'appelant : image() d'Astro pour le site,
 * simple chemin pour les scripts.
 */
export function episodeObject<T extends z.ZodType>(thumbnail: T) {
  return z.object({
    number: z.number().int().positive(),
    /** Numéro spécial (documentaire de ~30 min) : number = 100 + n (hs01 → 101), affiché « Numéro spécial n° n » */
    special: z.boolean().optional(),
    title: z.string().min(5).max(100),
    slug: slugSchema,
    status: z.enum(['upcoming', 'published']),
    youtubeId: z.string().regex(YOUTUBE_ID_PATTERN, 'identifiant YouTube invalide (11 caractères)').optional(),
    publishedAt: z.coerce.date().optional(),
    /** Dernière vérification du contenu (règles, chiffres, sources) */
    updatedAt: z.coerce.date().optional(),
    duration: z.string().regex(ISO_DURATION_PATTERN, 'durée ISO 8601 attendue, ex. PT10M32S').optional(),
    summary: z.string().min(SUMMARY_MIN, `résumé : ${SUMMARY_MIN} caractères minimum`).max(SUMMARY_MAX, `résumé : ${SUMMARY_MAX} caractères maximum`),
    teaser: z.string().min(20).max(240),
    category: z.enum(CATEGORY_KEYS),
    tags: z.array(z.string().min(2).max(40)).max(12).default([]),
    keyTakeaways: z.array(z.string().min(10).max(260)).min(3).max(7),
    tableau: tableauSchema,
    chapters: z.array(chapterSchema).default([]),
    faq: z.array(faqItemSchema).max(10).default([]),
    sources: z.array(sourceSchema).min(1),
    thumbnail: thumbnail.optional(),
    shorts: z.array(shortSchema).optional(),
    /** Calculateurs liés (lien « voir l'épisode lié » sur la page de l'outil) */
    tools: z.array(z.enum(TOOL_IDS)).default([]),
    /** Termes du lexique liés (identifiants de fichiers de src/content/lexique) */
    terms: z.array(slugSchema).default([]),
  });
}

type EpisodeShape = {
  number: number;
  special?: boolean | undefined;
  status: 'upcoming' | 'published';
  youtubeId?: string | undefined;
  publishedAt?: Date | undefined;
  updatedAt?: Date | undefined;
  chapters: { t: string; title: string }[];
};

/** Règles croisées : un épisode publié a sa vidéo et sa date ; chapitres valides et croissants. */
export function refineEpisode(episode: EpisodeShape, ctx: z.RefinementCtx): void {
  if (episode.special && episode.number <= SPECIAL_OFFSET) {
    ctx.addIssue({ code: 'custom', path: ['number'], message: `un numéro spécial a un numéro supérieur à ${SPECIAL_OFFSET} (hs01 → ${SPECIAL_OFFSET + 1})` });
  }
  if (!episode.special && episode.number > SPECIAL_OFFSET) {
    ctx.addIssue({ code: 'custom', path: ['special'], message: `numéro supérieur à ${SPECIAL_OFFSET} : réservé aux numéros spéciaux (special: true)` });
  }
  if (episode.status === 'published') {
    for (const field of ['youtubeId', 'publishedAt'] as const) {
      if (episode[field] === undefined) ctx.addIssue({ code: 'custom', path: [field], message: 'obligatoire pour un épisode publié' });
    }
  }
  if (episode.publishedAt && episode.updatedAt && episode.updatedAt < episode.publishedAt) {
    ctx.addIssue({ code: 'custom', path: ['updatedAt'], message: 'la mise à jour ne peut pas précéder la publication' });
  }
  if (episode.chapters.length > 0) {
    let previous = -1;
    episode.chapters.forEach((chapter, index) => {
      let seconds: number;
      try {
        seconds = timestampToSeconds(chapter.t);
      } catch (error) {
        ctx.addIssue({ code: 'custom', path: ['chapters', index, 't'], message: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (index === 0 && seconds !== 0) ctx.addIssue({ code: 'custom', path: ['chapters', 0, 't'], message: 'le premier chapitre commence à 0:00' });
      if (seconds <= previous) ctx.addIssue({ code: 'custom', path: ['chapters', index, 't'], message: 'les chapitres doivent être dans l’ordre croissant' });
      previous = seconds;
    });
  }
}

/** Version « scripts » du schéma d'épisode (vignette = chemin relatif). */
export const episodeFileSchema = episodeObject(z.string().min(1)).superRefine(refineEpisode);
export type EpisodeFrontmatter = z.infer<typeof episodeFileSchema>;

/** Terme du lexique. */
export function lexiconObject() {
  return z.object({
    term: z.string().min(2).max(60),
    /** Forme développée d'un sigle (« Loueur en meublé non professionnel ») */
    expansion: z.string().min(3).max(100).optional(),
    /** Définition en une phrase : description Google et DefinedTerm (70 à 160 caractères) */
    definition: z.string().min(SUMMARY_MIN).max(SUMMARY_MAX),
    category: z.enum(CATEGORY_KEYS),
    aliases: z.array(z.string().min(2)).default([]),
    sources: z.array(sourceSchema).min(1).max(3),
    updatedAt: z.coerce.date(),
    /** Règle en cours d'évolution (projet de loi…) : affichée dans un encadré « À surveiller » */
    watch: z.object({ date: z.coerce.date(), note: z.string().min(20).max(400) }).optional(),
    tools: z.array(z.enum(TOOL_IDS)).default([]),
  });
}
