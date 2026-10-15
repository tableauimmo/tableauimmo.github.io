// Analyse d'un passage de la routine : score de visibilité, évolution depuis le passage précédent,
// opportunités classées par priorité et évaluation des expériences en cours (boucle d'apprentissage).
import type {
  Analysis,
  Connectors,
  ContentPage,
  Evaluation,
  Experiment,
  GeoProbe,
  Metric,
  Opportunity,
  ScorePartName,
  SearchConsoleData,
  SearchRow,
  Snapshot,
  SnapshotEpisodes,
  Targets,
} from './schema.ts';

/** Poids de chaque partie du score (seules les parties mesurées comptent ; le total est ramené sur 100). */
export const SCORE_WEIGHTS: Record<ScorePartName, number> = { technique: 15, performance: 10, indexation: 20, google: 25, youtube: 15, geo: 15 };

const DAY_MS = 86_400_000;
const MAX_OPPORTUNITIES = 40;
/** Variation relative à partir de laquelle une expérience est jugée gagnante ou perdante (clics, impressions, CTR). */
const SIGNIFICANT_CHANGE = 0.1;
/** Gain de position Google à partir duquel une expérience est jugée gagnante (1 = une place). */
const SIGNIFICANT_POSITION = 1;
/** Taux de clic moyen observé selon la position dans Google (positions 1 à 10, puis au-delà). */
const EXPECTED_CTR = [0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02];
const EXPECTED_CTR_BEYOND = 0.01;
const STOPWORDS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'pour', 'en', 'et', 'a', 'au', 'aux', 'qui', 'que', 'sur', 'avec']);

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value);

export function expectedCtr(position: number): number {
  const rank = Math.max(1, Math.round(position));
  return EXPECTED_CTR[rank - 1] ?? EXPECTED_CTR_BEYOND;
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mots porteurs de sens, au singulier approximatif (« crédits immobiliers » ≈ « crédit immobilier »). */
export function significantWords(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((word) => (word.length > 1 || /\d/.test(word)) && !STOPWORDS.has(word))
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word));
}

function slug(text: string): string {
  return normalize(text).replace(/ /g, '-').slice(0, 80) || 'site';
}

// ── Score ──────────────────────────────────────────────────────────────────────────────────────────

function techniqueScore(connectors: Connectors): number | null {
  if (connectors.site.statut !== 'ok') return null;
  const issues = connectors.site.donnees.problemes;
  const errors = issues.filter((issue) => issue.severite === 'erreur').length;
  const warnings = issues.filter((issue) => issue.severite === 'avertissement').length;
  return clamp(100 - Math.min(60, errors * 10) - Math.min(40, warnings * 2));
}

function performanceScore(connectors: Connectors): number | null {
  if (connectors.performance.statut !== 'ok' || connectors.performance.donnees.length === 0) return null;
  const scores = connectors.performance.donnees.map((result) => result.scores.performance);
  return round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function indexationScore(connectors: Connectors): number | null {
  if (connectors.searchConsole.statut !== 'ok') return null;
  const inspections = connectors.searchConsole.donnees.inspections;
  if (inspections.length === 0) return null;
  return round((100 * inspections.filter((inspection) => inspection.indexee).length) / inspections.length);
}

/** Échelle logarithmique : 10 impressions ≈ 26, 100 ≈ 50, 1 000 ≈ 75, 10 000 et plus = 100. */
function googleScore(connectors: Connectors): number | null {
  if (connectors.searchConsole.statut !== 'ok') return null;
  return round(clamp(25 * Math.log10(1 + connectors.searchConsole.donnees.totaux.actuel.impressions)));
}

/** 70 % audience (100 000 vues = 100, échelle logarithmique) + 30 % vidéos sans problème de référencement. */
function youtubeScore(connectors: Connectors): number | null {
  if (connectors.youtube.statut !== 'ok') return null;
  const videos = connectors.youtube.donnees.videos;
  if (videos.length === 0) return null;
  const views = videos.reduce((sum, video) => sum + (video.vues ?? 0), 0);
  const audience = clamp(20 * Math.log10(1 + views));
  const compliant = (100 * videos.filter((video) => video.problemes.length === 0).length) / videos.length;
  return round(0.7 * audience + 0.3 * compliant);
}

/** Sondage GEO : être nommé par l'IA compte pour 60 %, être cité avec un lien pour 40 %. */
function geoScore(geo: GeoProbe | null): number | null {
  if (!geo || geo.sondages.length === 0) return null;
  const total = geo.sondages.reduce((sum, probe) => sum + (probe.mentionne ? 60 : 0) + (probe.cite ? 40 : 0), 0);
  return round(total / geo.sondages.length);
}

export function computeScore(connectors: Connectors, geo: GeoProbe | null): Analysis['score'] {
  const values: Record<ScorePartName, number | null> = {
    technique: techniqueScore(connectors),
    performance: performanceScore(connectors),
    indexation: indexationScore(connectors),
    google: googleScore(connectors),
    youtube: youtubeScore(connectors),
    geo: geoScore(geo),
  };
  const parties = (Object.keys(SCORE_WEIGHTS) as ScorePartName[]).map((nom) => ({ nom, valeur: values[nom], poids: SCORE_WEIGHTS[nom] }));
  const measured = parties.filter((part) => part.valeur !== null);
  const weight = measured.reduce((sum, part) => sum + part.poids, 0);
  const total = weight === 0 ? null : round(measured.reduce((sum, part) => sum + (part.valeur ?? 0) * part.poids, 0) / weight);
  const allWeights = parties.reduce((sum, part) => sum + part.poids, 0);
  return { total, couverture: round((100 * weight) / allWeights), parties };
}

// ── Évolution ──────────────────────────────────────────────────────────────────────────────────────

function youtubeViews(connectors: Connectors): number | null {
  return connectors.youtube.statut === 'ok' ? connectors.youtube.donnees.videos.reduce((sum, video) => sum + (video.vues ?? 0), 0) : null;
}

function issueCount(connectors: Connectors): number | null {
  return connectors.site.statut === 'ok' ? connectors.site.donnees.problemes.filter((issue) => issue.severite !== 'info').length : null;
}

function searchTotal(connectors: Connectors, key: 'clics' | 'impressions'): number | null {
  return connectors.searchConsole.statut === 'ok' ? connectors.searchConsole.donnees.totaux.actuel[key] : null;
}

const difference = (now: number | null, before: number | null) => (now === null || before === null ? null : now - before);

export function computeEvolution(score: Analysis['score'], connectors: Connectors, previous: Snapshot | null): Analysis['evolution'] {
  if (!previous) return { depuis: null, score: null, clics: null, impressions: null, vuesYoutube: null, problemes: null };
  return {
    depuis: previous.creeLe,
    // Deux scores ne se comparent que sur le même périmètre de mesure (mêmes sources connectées).
    score: previous.analyse.score.couverture === score.couverture ? difference(score.total, previous.analyse.score.total) : null,
    clics: difference(searchTotal(connectors, 'clics'), searchTotal(previous.connecteurs, 'clics')),
    impressions: difference(searchTotal(connectors, 'impressions'), searchTotal(previous.connecteurs, 'impressions')),
    vuesYoutube: difference(youtubeViews(connectors), youtubeViews(previous.connecteurs)),
    problemes: difference(issueCount(connectors), issueCount(previous.connecteurs)),
  };
}

// ── Expériences ────────────────────────────────────────────────────────────────────────────────────

function findRow(data: SearchConsoleData, page: string | undefined, query: string | undefined): SearchRow | undefined {
  if (page && query) return data.requetesPages.find((row) => row.cles[0] === query && row.cles[1] === page);
  if (page) return data.pages.find((row) => row.cles[0] === page);
  if (query) return data.requetes.find((row) => row.cles[0] === query);
  return undefined;
}

function metricValue(row: SearchRow | undefined, metric: Metric): number | null {
  // Sans ligne, la page n'a eu aucune impression : 0 clic et 0 impression, mais ni CTR ni position mesurables.
  if (!row) return metric === 'clics' || metric === 'impressions' ? 0 : null;
  return { clics: row.clics, impressions: row.impressions, ctr: row.ctr, position: row.position }[metric];
}

export function evaluateExperiment(experiment: Experiment, searchConsole: SearchConsoleData | null, now: Date): Evaluation {
  const base = { id: experiment.id, avant: experiment.avant };
  const due = new Date(`${experiment.date}T00:00:00Z`).getTime() + experiment.evaluerApresJours * DAY_MS;
  if (now.getTime() < due) {
    const days = Math.ceil((due - now.getTime()) / DAY_MS);
    return { ...base, verdict: 'trop-tot', apres: null, variation: null, commentaire: `À évaluer dans ${days} jour(s).` };
  }
  if (!searchConsole) return { ...base, verdict: 'sans-donnees', apres: null, variation: null, commentaire: 'Search Console non connectée : mesure impossible.' };
  const apres = metricValue(findRow(searchConsole, experiment.mesure.page, experiment.mesure.requete), experiment.mesure.indicateur);
  if (apres === null || experiment.avant === null) {
    return { ...base, verdict: 'sans-donnees', apres, variation: null, commentaire: 'Pas de valeur de référence ou de mesure actuelle.' };
  }
  if (experiment.mesure.indicateur === 'position') {
    const gain = experiment.avant - apres;
    const verdict = gain >= SIGNIFICANT_POSITION ? 'gagnante' : gain <= -SIGNIFICANT_POSITION ? 'perdante' : 'neutre';
    return { ...base, verdict, apres, variation: Number(gain.toFixed(2)), commentaire: `Position ${experiment.avant.toFixed(1)} → ${apres.toFixed(1)}.` };
  }
  const variation = experiment.avant === 0 ? (apres > 0 ? 1 : 0) : (apres - experiment.avant) / experiment.avant;
  const verdict = variation >= SIGNIFICANT_CHANGE ? 'gagnante' : variation <= -SIGNIFICANT_CHANGE ? 'perdante' : 'neutre';
  return {
    ...base,
    verdict,
    apres,
    variation: Number(variation.toFixed(3)),
    commentaire: `${experiment.mesure.indicateur} : ${experiment.avant} → ${apres} (${variation >= 0 ? '+' : ''}${Math.round(variation * 100)} %).`,
  };
}

// ── Opportunités ───────────────────────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  now: Date;
  site: string;
  episodes: SnapshotEpisodes;
  /** Pages datées (épisodes, lexique) pour le contrôle de fraîcheur */
  contenus: ContentPage[];
  connectors: Connectors;
  geo: GeoProbe | null;
  targets: Targets;
  experiments: Experiment[];
  previous: Snapshot | null;
}

function indexNowOpportunities(connectors: Connectors): Opportunity[] {
  if (connectors.indexNow.statut !== 'ok' || connectors.indexNow.donnees.cleServie) return [];
  return [
    {
      id: 'correction:indexnow-cle',
      type: 'correction',
      priorite: 85,
      titre: 'Le fichier de clé IndexNow n’est pas servi',
      detail: `${connectors.indexNow.donnees.url} doit renvoyer exactement la clé de visibilite/config.json (fichier public/<clé>.txt), sinon Bing et les autres moteurs rejettent les envois.`,
      cible: connectors.indexNow.donnees.url,
    },
  ];
}

function siteOpportunities(connectors: Connectors): Opportunity[] {
  if (connectors.site.statut !== 'ok') return [];
  const byCode = new Map<string, { severite: string; urls: string[]; message: string }>();
  for (const issue of connectors.site.donnees.problemes) {
    if (issue.severite === 'info') continue;
    const group = byCode.get(issue.code) ?? { severite: issue.severite, urls: [], message: issue.message };
    group.urls.push(issue.url);
    byCode.set(issue.code, group);
  }
  return [...byCode].map(([code, group]) => ({
    id: `correction:${code}`,
    type: 'correction',
    priorite: group.severite === 'erreur' ? 95 : 60,
    titre: `Corriger « ${code} » (${group.urls.length} page(s))`,
    detail: `${group.message} Pages : ${group.urls.slice(0, 5).join(', ')}${group.urls.length > 5 ? '…' : ''}`,
  }));
}

function episodeOpportunities(input: AnalysisInput): Opportunity[] {
  const known = new Set(input.previous?.episodes.publies.map((episode) => episode.youtubeId) ?? []);
  const inspections = input.connectors.searchConsole.statut === 'ok' ? input.connectors.searchConsole.donnees.inspections : [];
  return input.episodes.publies.flatMap((episode) => {
    const inspection = inspections.find((item) => item.url === episode.url);
    const isNew = !known.has(episode.youtubeId);
    const notIndexed = inspection !== undefined && !inspection.indexee;
    if (!isNew && !notIndexed) return [];
    return [
      {
        id: `nouvel-episode:${episode.youtubeId}`,
        type: 'nouvel-episode' as const,
        priorite: 90,
        titre: `Faire connaître l'épisode ${episode.numero} : ${episode.titre}`,
        detail: `${isNew ? 'Nouvel épisode publié.' : `Pas encore indexé par Google (${inspection?.etat ?? 'état inconnu'}).`} Envoyer la page à IndexNow, demander l'indexation dans Search Console, vérifier la description YouTube (lien vers la page, chapitres, sources) et le maillage interne (lexique, calculateurs, thème).`,
        cible: episode.url,
      },
    ];
  });
}

function youtubeOpportunities(connectors: Connectors): Opportunity[] {
  if (connectors.youtube.statut !== 'ok') return [];
  return connectors.youtube.donnees.videos.flatMap((video) =>
    video.problemes.map((problem) => ({
      id: `youtube:${video.id}:${problem.code}`,
      type: 'youtube' as const,
      priorite: problem.code === 'lien-site-absent' || problem.code === 'mention-ia-absente' ? 80 : 50,
      titre: `YouTube « ${video.titre} » : ${problem.message}`,
      detail: problem.correction,
      cible: `https://www.youtube.com/watch?v=${video.id}`,
    })),
  );
}

function searchOpportunities(connectors: Connectors): Opportunity[] {
  if (connectors.searchConsole.statut !== 'ok') return [];
  const data = connectors.searchConsole.donnees;
  const bestPage = (query: string) =>
    data.requetesPages.filter((row) => row.cles[0] === query).sort((a, b) => b.impressions - a.impressions)[0]?.cles[1];
  const nearTop = data.requetes
    .filter((row) => row.impressions >= 10 && row.position >= 4 && row.position <= 20)
    .map((row) => {
      const query = row.cles[0] ?? '';
      const page = bestPage(query);
      return {
        id: `requete-proche:${slug(query)}`,
        type: 'requete-proche' as const,
        priorite: Math.min(89, 70 + Math.round(row.impressions / 50)),
        titre: `« ${query} » : position ${row.position.toFixed(1)}, ${row.impressions} impressions`,
        detail: `Proche du haut de page. Renforcer ${page ?? 'la page la plus pertinente'} pour cette requête (titre, premier paragraphe, sous-titre, liens internes depuis les pages fortes).`,
        ...(page ? { cible: page } : {}),
      };
    });
  const lowCtr = data.pages
    .filter((row) => row.impressions >= 100 && row.ctr < 0.5 * expectedCtr(row.position))
    .map((row) => ({
      id: `ctr-faible:${slug(row.cles[0] ?? '')}`,
      type: 'ctr-faible' as const,
      priorite: 65,
      titre: `Peu de clics sur ${row.cles[0]} (${(row.ctr * 100).toFixed(1)} % pour la position ${row.position.toFixed(1)})`,
      detail: `Attendu vers ${(expectedCtr(row.position) * 100).toFixed(0)} %. Tester un titre et une description plus concrets pour un investisseur (chiffre clé, année, bénéfice ; une seule modification, mesurée sur 28 jours).`,
      ...(row.cles[0] ? { cible: row.cles[0] } : {}),
    }));
  return [...nearTop, ...lowCtr];
}

function contentOpportunities(input: AnalysisInput): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const pages = input.connectors.site.statut === 'ok' ? input.connectors.site.donnees.pages : [];
  if (pages.length > 0) {
    for (const target of input.targets.requetes.filter((item) => item.priorite <= 2)) {
      const words = significantWords(target.texte);
      const covered = pages.some((page) => {
        const haystack = new Set(significantWords(`${page.titre} ${page.description}`));
        return words.every((word) => haystack.has(word));
      });
      if (!covered) {
        opportunities.push({
          id: `contenu:${slug(target.texte)}`,
          type: 'contenu',
          priorite: target.priorite === 1 ? 55 : 40,
          titre: `Aucune page ne vise « ${target.texte} »`,
          detail: 'Créer ou adapter une page (épisode, terme du lexique, thème) dont le titre et la description répondent à cette recherche, avec un contenu chiffré, sourcé et daté.',
        });
      }
    }
  }
  if (input.connectors.suggestions.statut === 'ok') {
    const known = new Set(input.targets.requetes.map((item) => normalize(item.texte)));
    const ideas = new Map<string, number>();
    for (const seed of input.connectors.suggestions.donnees.graines) {
      for (const suggestion of [...seed.google, ...seed.youtube]) {
        const key = normalize(suggestion);
        if (!known.has(key) && key !== normalize(seed.requete)) ideas.set(suggestion, (ideas.get(suggestion) ?? 0) + 1);
      }
    }
    const top = [...ideas].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([idea]) => idea);
    if (top.length > 0) {
      opportunities.push({
        id: 'contenu:suggestions',
        type: 'contenu',
        priorite: 35,
        titre: `${ideas.size} recherches suggérées par Google et YouTube pas encore suivies`,
        detail: `À trier (pertinentes pour la chaîne ? sans détourner une autre marque) puis ajouter aux cibles : ${top.join(' · ')}`,
      });
    }
  }
  return opportunities;
}

function geoOpportunities(geo: GeoProbe | null): Opportunity[] {
  if (!geo) return [];
  return geo.sondages
    .filter((probe) => !probe.mentionne)
    .map((probe) => ({
      id: `geo:${probe.moteur}:${slug(probe.prompt)}`,
      type: 'geo' as const,
      priorite: 55,
      titre: `${probe.moteur} ne cite pas Tableau Immo pour « ${probe.prompt} »`,
      detail: `${probe.concurrents.length > 0 ? `Cités à la place : ${probe.concurrents.join(', ')}. ` : ''}Renforcer la réponse à cette question sur le site (FAQ, llms.txt, page dédiée) et la cohérence de la marque sur les profils publics.`,
    }));
}

/** Délai au-delà duquel une page datée doit être revérifiée (la fiscalité change au moins une fois par an). */
export const FRESHNESS_DAYS: Record<string, number> = { fiscalite: 120, financement: 120, juridique: 180, location: 180, travaux: 180, patrimoine: 240, strategie: 365, marche: 90 };
/** Une règle « À surveiller » doit être revue au plus tard après ce délai (vote d'une loi, décret…). */
export const WATCH_DAYS = 30;

/** Contenus financiers (YMYL) : pages à revérifier, dates à mettre à jour, règles en discussion à suivre. */
export function freshnessOpportunities(contenus: ContentPage[], now: Date): Opportunity[] {
  const age = (day: string) => Math.floor((now.getTime() - new Date(`${day}T00:00:00Z`).getTime()) / DAY_MS);
  return contenus.flatMap((page) => {
    const opportunities: Opportunity[] = [];
    const limit = FRESHNESS_DAYS[page.theme] ?? 180;
    const days = age(page.verifieLe);
    if (days > limit) {
      opportunities.push({
        id: `fraicheur:${slug(page.url)}`,
        type: 'fraicheur',
        priorite: page.theme === 'fiscalite' || page.theme === 'financement' ? 75 : 55,
        titre: `Revérifier « ${page.titre} » (vérifié il y a ${days} jours)`,
        detail: `Contrôler chaque règle et chiffre sur les sources officielles (Légifrance, BOFiP, impots.gouv.fr, service-public.fr), corriger si besoin, puis mettre à jour la date (updatedAt) et soumettre la page à IndexNow.`,
        cible: page.url,
      });
    }
    if (page.aSurveiller && age(page.aSurveiller) > WATCH_DAYS) {
      opportunities.push({
        id: `fraicheur:surveiller:${slug(page.url)}`,
        type: 'fraicheur',
        priorite: 80,
        titre: `Règle « à surveiller » à revoir : ${page.titre}`,
        detail: `L'encadré « À surveiller » date du ${page.aSurveiller}. Vérifier où en est le texte (vote, promulgation, abandon) et mettre à jour la page et sa date.`,
        cible: page.url,
      });
    }
    return opportunities;
  });
}

function connectorOpportunities(connectors: Connectors): Opportunity[] {
  const importance: Record<keyof Connectors, number> = { searchConsole: 45, performance: 25, youtube: 30, knowledgeGraph: 20, site: 90, suggestions: 15, indexNow: 40 };
  return (Object.entries(connectors) as [keyof Connectors, Connectors[keyof Connectors]][]).flatMap(([name, result]) => {
    if (result.statut === 'ok') return [];
    return [
      {
        id: `connecteur:${name}`,
        type: 'connecteur' as const,
        priorite: importance[name],
        titre: result.statut === 'absent' ? `Connecter ${name} : ${result.raison}` : `Connecteur ${name} en erreur`,
        detail: result.statut === 'absent' ? result.configuration : result.erreur,
      },
    ];
  });
}

export function analyse(input: AnalysisInput): Analysis {
  const score = computeScore(input.connectors, input.geo);
  const searchConsole = input.connectors.searchConsole.statut === 'ok' ? input.connectors.searchConsole.donnees : null;
  const opportunites = [
    ...siteOpportunities(input.connectors),
    ...indexNowOpportunities(input.connectors),
    ...episodeOpportunities(input),
    ...freshnessOpportunities(input.contenus, input.now),
    ...youtubeOpportunities(input.connectors),
    ...searchOpportunities(input.connectors),
    ...contentOpportunities(input),
    ...geoOpportunities(input.geo),
    ...connectorOpportunities(input.connectors),
  ]
    .sort((a, b) => b.priorite - a.priorite || a.id.localeCompare(b.id))
    .slice(0, MAX_OPPORTUNITIES);
  return {
    score,
    evolution: computeEvolution(score, input.connectors, input.previous),
    opportunites,
    evaluations: input.experiments.filter((experiment) => experiment.statut === 'en-cours').map((experiment) => evaluateExperiment(experiment, searchConsole, input.now)),
  };
}
