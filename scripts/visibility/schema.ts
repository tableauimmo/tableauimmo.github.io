// Données de la routine de visibilité (dossier visibilite/) : schémas validés à la lecture et à l'écriture,
// pour qu'un fichier abîmé (édition à la main, run interrompu) ne fausse jamais une analyse.
import { z } from 'astro/zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue : AAAA-MM-JJ');
const isoDateTime = z.iso.datetime();
const percent = z.number().min(0).max(100);

function uniqueBy<T>(items: T[], key: (item: T) => string, ctx: z.RefinementCtx, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) ctx.addIssue({ code: 'custom', message: `${label} en double : « ${value} »` });
    seen.add(value);
  }
}

// ── Configuration et données éditées par la routine ───────────────────────────────────────────────

export const configSchema = z.object({
  /** Propriété Search Console : « sc-domain:domaine » (propriété de domaine) ou URL avec « / » final. */
  searchConsoleProperty: z.string().regex(/^(sc-domain:[a-z0-9.-]+|https:\/\/[^\s]+\/)$/),
  /** Clé IndexNow publique, servie à la racine du site (public/<clé>.txt). */
  indexNowKey: z.string().regex(/^[a-f0-9]{32}$/),
  performancePaths: z.array(z.string().startsWith('/')).min(1).max(5),
  maxCrawlPages: z.number().int().min(1).max(5000),
  maxLinkChecks: z.number().int().min(0).max(5000),
  maxSuggestionSeeds: z.number().int().min(0).max(50),
  maxUrlInspections: z.number().int().min(0).max(500),
});
export type VisibilityConfig = z.infer<typeof configSchema>;

const priority = z.number().int().min(1).max(3);

export const targetsSchema = z
  .object({
    requetes: z.array(
      z.object({
        texte: z.string().min(2),
        priorite: priority,
        origine: z.enum(['graine', 'search-console', 'suggestion', 'geo']),
        ajouteeLe: isoDate,
      }),
    ),
    prompts: z.array(z.object({ texte: z.string().min(10), priorite: priority, ajouteeLe: isoDate })),
    concurrents: z.array(z.object({ nom: z.string().min(2), site: z.url().optional() })),
  })
  .superRefine((targets, ctx) => {
    uniqueBy(targets.requetes, (item) => item.texte.toLowerCase(), ctx, 'Requête');
    uniqueBy(targets.prompts, (item) => item.texte.toLowerCase(), ctx, 'Prompt');
    uniqueBy(targets.concurrents, (item) => item.nom.toLowerCase(), ctx, 'Concurrent');
  });
export type Targets = z.infer<typeof targetsSchema>;

export const METRICS = ['clics', 'impressions', 'ctr', 'position'] as const;
export type Metric = (typeof METRICS)[number];

export const experimentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  date: isoDate,
  type: z.enum(['titre', 'description', 'contenu', 'nouvelle-page', 'maillage', 'donnees-structurees', 'youtube', 'geo', 'technique']),
  cible: z.string().min(1),
  hypothese: z.string().min(10),
  changement: z.string().min(5),
  mesure: z.object({
    indicateur: z.enum(METRICS),
    page: z.url().optional(),
    requete: z.string().optional(),
  }),
  /** Valeur de l'indicateur au lancement (null si Search Console n'était pas encore connectée). */
  avant: z.number().nullable(),
  evaluerApresJours: z.number().int().min(7).max(90),
  statut: z.enum(['en-cours', 'gagnante', 'neutre', 'perdante', 'abandonnee']),
  resultat: z
    .object({ date: isoDate, apres: z.number().nullable(), variation: z.number().nullable(), commentaire: z.string().min(3) })
    .optional(),
});
export type Experiment = z.infer<typeof experimentSchema>;

export const experimentsSchema = z
  .object({ experiences: z.array(experimentSchema) })
  .superRefine((journal, ctx) => uniqueBy(journal.experiences, (item) => item.id, ctx, 'Expérience'));

export const GEO_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'google', 'recherche-web', 'claude'] as const;

export const geoSchema = z.object({
  date: isoDate,
  sondages: z
    .array(
      z.object({
        prompt: z.string().min(5),
        moteur: z.enum(GEO_ENGINES),
        /** Tableau Immo est nommé dans la réponse. */
        mentionne: z.boolean(),
        /** La réponse renvoie vers le site (ou la chaîne YouTube). */
        cite: z.boolean(),
        position: z.number().int().min(1).optional(),
        concurrents: z.array(z.string()).default([]),
        /** Court extrait de la réponse (citation brève uniquement). */
        extrait: z.string().max(400).optional(),
      }),
    )
    .min(1),
});
export type GeoProbe = z.infer<typeof geoSchema>;

// ── Résultats des connecteurs ──────────────────────────────────────────────────────────────────────

export const issueSchema = z.object({
  severite: z.enum(['erreur', 'avertissement', 'info']),
  code: z.string(),
  url: z.string(),
  message: z.string(),
});
export type Issue = z.infer<typeof issueSchema>;

export const pageAuditSchema = z.object({
  url: z.string(),
  statut: z.number().int(),
  dureeMs: z.number(),
  titre: z.string(),
  description: z.string(),
  canonique: z.string(),
  h1: z.number().int(),
  mots: z.number().int(),
  jsonLd: z.array(z.string()),
  ogImage: z.boolean(),
  indexable: z.boolean(),
});
export type PageAudit = z.infer<typeof pageAuditSchema>;

export const siteAuditSchema = z.object({
  pages: z.array(pageAuditSchema),
  problemes: z.array(issueSchema),
  fichiers: z.object({ robots: z.boolean(), llms: z.boolean(), rss: z.boolean(), sitemapVideo: z.boolean() }),
  liensVerifies: z.number().int(),
});
export type SiteAudit = z.infer<typeof siteAuditSchema>;

export const performanceSchema = z.array(
  z.object({
    source: z.enum(['pagespeed', 'lighthouse-local']),
    url: z.string(),
    scores: z.object({ performance: percent, seo: percent, accessibilite: percent, bonnesPratiques: percent }),
    lcpMs: z.number(),
    cls: z.number(),
    tbtMs: z.number(),
    /** Données réelles des visiteurs Chrome (CrUX), disponibles seulement via PageSpeed et avec assez de trafic. */
    terrain: z.object({ categorie: z.string(), lcpMs: z.number().optional(), inpMs: z.number().optional(), cls: z.number().optional() }).optional(),
  }),
);
export type PerformanceResult = z.infer<typeof performanceSchema>;

const searchRowSchema = z.object({
  cles: z.array(z.string()),
  clics: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});
export type SearchRow = z.infer<typeof searchRowSchema>;

const totalsSchema = z.object({ clics: z.number(), impressions: z.number(), ctr: z.number(), position: z.number() });
export type SearchTotals = z.infer<typeof totalsSchema>;

export const searchConsoleSchema = z.object({
  periode: z.object({ debut: isoDate, fin: isoDate }),
  periodePrecedente: z.object({ debut: isoDate, fin: isoDate }),
  totaux: z.object({ actuel: totalsSchema, precedent: totalsSchema }),
  requetes: z.array(searchRowSchema),
  pages: z.array(searchRowSchema),
  requetesPages: z.array(searchRowSchema),
  requetesPrecedentes: z.array(searchRowSchema),
  sitemaps: z.array(
    z.object({ chemin: z.string(), soumisLe: z.string().optional(), luLe: z.string().optional(), erreurs: z.number(), avertissements: z.number(), enAttente: z.boolean() }),
  ),
  inspections: z.array(
    z.object({
      url: z.string(),
      verdict: z.string(),
      etat: z.string(),
      indexee: z.boolean(),
      derniereExploration: z.string().optional(),
      canoniqueGoogle: z.string().optional(),
      resultatsEnrichis: z.array(z.string()),
    }),
  ),
});
export type SearchConsoleData = z.infer<typeof searchConsoleSchema>;

export const youtubeSchema = z.object({
  source: z.enum(['flux', 'api']),
  chaine: z.object({ abonnes: z.number().optional(), vues: z.number().optional(), videos: z.number().optional() }),
  videos: z.array(
    z.object({
      id: z.string(),
      titre: z.string(),
      publieeLe: isoDateTime,
      short: z.boolean(),
      vues: z.number().optional(),
      jaime: z.number().optional(),
      commentaires: z.number().optional(),
      episode: z.number().int().optional(),
      problemes: z.array(z.object({ code: z.string(), message: z.string(), correction: z.string() })),
    }),
  ),
});
export type YouTubeData = z.infer<typeof youtubeSchema>;

export const suggestionsSchema = z.object({
  graines: z.array(z.object({ requete: z.string(), google: z.array(z.string()), youtube: z.array(z.string()) })),
  marque: z.object({ saisie: z.string(), google: z.boolean(), youtube: z.boolean() }),
});
export type SuggestionsData = z.infer<typeof suggestionsSchema>;

export const knowledgeGraphSchema = z.object({
  reconnu: z.boolean(),
  entites: z.array(z.object({ nom: z.string(), types: z.array(z.string()), score: z.number(), description: z.string().optional() })),
});
export type KnowledgeGraphData = z.infer<typeof knowledgeGraphSchema>;

export const indexNowSchema = z.object({ cleServie: z.boolean(), url: z.string() });

function connectorResult<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('statut', [
    z.object({ statut: z.literal('ok'), dureeMs: z.number(), donnees: data }),
    z.object({ statut: z.literal('absent'), raison: z.string(), configuration: z.string() }),
    z.object({ statut: z.literal('erreur'), dureeMs: z.number(), erreur: z.string() }),
  ]);
}

export type ConnectorResult<T> =
  | { statut: 'ok'; dureeMs: number; donnees: T }
  | { statut: 'absent'; raison: string; configuration: string }
  | { statut: 'erreur'; dureeMs: number; erreur: string };

// ── Analyse et instantané ──────────────────────────────────────────────────────────────────────────

export const SCORE_PARTS = ['technique', 'performance', 'indexation', 'google', 'youtube', 'geo'] as const;
export type ScorePartName = (typeof SCORE_PARTS)[number];

export const opportunitySchema = z.object({
  id: z.string(),
  type: z.enum(['correction', 'nouvel-episode', 'fraicheur', 'youtube', 'requete-proche', 'ctr-faible', 'contenu', 'geo', 'connecteur']),
  priorite: z.number().int().min(1).max(100),
  titre: z.string(),
  detail: z.string(),
  cible: z.string().optional(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

export const evaluationSchema = z.object({
  id: z.string(),
  verdict: z.enum(['gagnante', 'neutre', 'perdante', 'trop-tot', 'sans-donnees']),
  avant: z.number().nullable(),
  apres: z.number().nullable(),
  variation: z.number().nullable(),
  commentaire: z.string(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const analysisSchema = z.object({
  score: z.object({
    total: percent.nullable(),
    /** Part des critères réellement mesurés (poids cumulés) : un score sur 25 % des critères reste provisoire. */
    couverture: percent,
    parties: z.array(z.object({ nom: z.enum(SCORE_PARTS), valeur: percent.nullable(), poids: z.number() })),
  }),
  evolution: z.object({
    depuis: isoDateTime.nullable(),
    score: z.number().nullable(),
    clics: z.number().nullable(),
    impressions: z.number().nullable(),
    vuesYoutube: z.number().nullable(),
    problemes: z.number().nullable(),
  }),
  opportunites: z.array(opportunitySchema),
  evaluations: z.array(evaluationSchema),
});
export type Analysis = z.infer<typeof analysisSchema>;

/**
 * Version du format des instantanés. À incrémenter à chaque changement de `snapshotSchema` qui rend les
 * anciens fichiers illisibles : les instantanés d'une autre version sont alors ignorés pour la comparaison.
 */
export const SNAPSHOT_VERSION = 1;

/** Page dont le contenu est daté (épisode, terme du lexique) : suivi de la fraîcheur (YMYL). */
export const contentPageSchema = z.object({
  url: z.string(),
  titre: z.string(),
  type: z.enum(['episode', 'lexique']),
  theme: z.string(),
  verifieLe: isoDate,
  /** Règle en discussion signalée sur la page (« À surveiller »), avec sa date */
  aSurveiller: isoDate.optional(),
});
export type ContentPage = z.infer<typeof contentPageSchema>;

export const snapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  creeLe: isoDateTime,
  site: z.url(),
  episodes: z.object({
    publies: z.array(z.object({ numero: z.number().int(), titre: z.string(), url: z.string(), youtubeId: z.string(), publieLe: isoDateTime })),
    aVenir: z.array(z.object({ numero: z.number().int(), titre: z.string() })),
  }),
  contenus: z.array(contentPageSchema),
  connecteurs: z.object({
    site: connectorResult(siteAuditSchema),
    performance: connectorResult(performanceSchema),
    searchConsole: connectorResult(searchConsoleSchema),
    youtube: connectorResult(youtubeSchema),
    suggestions: connectorResult(suggestionsSchema),
    knowledgeGraph: connectorResult(knowledgeGraphSchema),
    indexNow: connectorResult(indexNowSchema),
  }),
  geo: geoSchema.nullable(),
  analyse: analysisSchema,
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Connectors = Snapshot['connecteurs'];
export type SnapshotEpisodes = Snapshot['episodes'];
