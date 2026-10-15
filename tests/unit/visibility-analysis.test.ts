import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { analyse, computeScore, evaluateExperiment, expectedCtr, freshnessOpportunities, significantWords, type AnalysisInput } from '../../scripts/visibility/analysis.ts';
import { renderReport } from '../../scripts/visibility/report.ts';
import { SNAPSHOT_VERSION, snapshotSchema, type Connectors, type Experiment, type SearchConsoleData, type Snapshot } from '../../scripts/visibility/schema.ts';
import { applyEvaluations, latestSnapshot, runStamp } from '../../scripts/visibility/storage.ts';

const SITE = 'https://tableauimmo.github.io';
const NOW = new Date('2026-11-20T10:00:00Z');

function row(cles: string[], impressions: number, position: number, clics = 0): SearchConsoleData['requetes'][number] {
  return { cles, clics, impressions, ctr: impressions === 0 ? 0 : clics / impressions, position };
}

function searchConsole(overrides: Partial<SearchConsoleData> = {}): SearchConsoleData {
  return {
    periode: { debut: '2026-10-20', fin: '2026-11-16' },
    periodePrecedente: { debut: '2026-09-22', fin: '2026-10-19' },
    totaux: { actuel: { clics: 40, impressions: 1000, ctr: 0.04, position: 9 }, precedent: { clics: 10, impressions: 300, ctr: 0.033, position: 14 } },
    requetes: [row(['calcul rendement locatif'], 120, 6.3, 4), row(['tableau immo'], 30, 1.2, 20), row(['rendement net studio'], 5, 12)],
    pages: [row([`${SITE}/`], 600, 3, 6), row([`${SITE}/outils/`], 50, 8, 1)],
    requetesPages: [row(['calcul rendement locatif', `${SITE}/`], 100, 6, 3), row(['calcul rendement locatif', `${SITE}/episodes/`], 20, 9, 1)],
    requetesPrecedentes: [],
    sitemaps: [],
    inspections: [
      { url: `${SITE}/`, verdict: 'PASS', etat: 'Envoyée et indexée', indexee: true, resultatsEnrichis: [] },
      { url: `${SITE}/episodes/rendement-brut-ou-net/`, verdict: 'NEUTRAL', etat: 'Détectée, actuellement non indexée', indexee: false, resultatsEnrichis: [] },
    ],
    ...overrides,
  };
}

function connectors(overrides: Partial<Connectors> = {}): Connectors {
  return {
    site: {
      statut: 'ok',
      dureeMs: 1000,
      donnees: {
        pages: [
          { url: `${SITE}/`, statut: 200, dureeMs: 50, titre: 'Tableau Immo — l’investissement immobilier expliqué au tableau', description: 'Calcul rendement locatif, crédit et fiscalité immobilière expliqués au tableau.', canonique: `${SITE}/`, h1: 1, mots: 500, jsonLd: ['Organization'], ogImage: true, indexable: true },
        ],
        problemes: [
          { severite: 'erreur', code: 'lien-casse', url: `${SITE}/outils/`, message: 'Lien cassé.' },
          { severite: 'avertissement', code: 'titre-long', url: `${SITE}/a/`, message: 'Titre long.' },
          { severite: 'avertissement', code: 'titre-long', url: `${SITE}/b/`, message: 'Titre long.' },
          { severite: 'info', code: 'lent', url: `${SITE}/c/`, message: 'Lent.' },
        ],
        fichiers: { robots: true, llms: true, rss: true, sitemapVideo: true },
        liensVerifies: 3,
      },
    },
    performance: { statut: 'ok', dureeMs: 30_000, donnees: [{ source: 'lighthouse-local', url: `${SITE}/`, scores: { performance: 90, seo: 100, accessibilite: 100, bonnesPratiques: 100 }, lcpMs: 2500, cls: 0, tbtMs: 0 }, { source: 'lighthouse-local', url: `${SITE}/outils/rendement-locatif/`, scores: { performance: 100, seo: 100, accessibilite: 100, bonnesPratiques: 100 }, lcpMs: 1500, cls: 0, tbtMs: 0 }] },
    searchConsole: { statut: 'ok', dureeMs: 2000, donnees: searchConsole() },
    youtube: {
      statut: 'ok',
      dureeMs: 500,
      donnees: {
        source: 'flux',
        chaine: {},
        videos: [
          { id: 'TIfixture01', titre: 'Rendement brut ou net | Tableau Immo', publieeLe: '2026-10-20T16:00:00.000Z', short: false, vues: 999, episode: 1, problemes: [{ code: 'lien-site-absent', message: 'Pas de lien.', correction: 'Ajouter le lien.' }] },
        ],
      },
    },
    suggestions: { statut: 'ok', dureeMs: 3000, donnees: { graines: [{ requete: 'calcul rendement locatif', google: ['calcul rendement locatif', 'calcul rendement locatif net'], youtube: ['calcul rendement locatif net', 'rendement locatif excel'] }], marque: { saisie: 'tableau imm', google: false, youtube: false } } },
    knowledgeGraph: { statut: 'absent', raison: 'GOOGLE_API_KEY absente', configuration: 'Ajouter la clé.' },
    indexNow: { statut: 'ok', dureeMs: 100, donnees: { cleServie: false, url: `${SITE}/cle.txt` } },
    ...overrides,
  };
}

function input(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    now: NOW,
    site: SITE,
    contenus: [],
    episodes: { publies: [{ numero: 1, titre: 'Rendement brut ou net', url: `${SITE}/episodes/rendement-brut-ou-net/`, youtubeId: 'TIfixture01', publieLe: '2026-10-20T16:00:00.000Z' }], aVenir: [] },
    connectors: connectors(),
    geo: { date: '2026-11-20', sondages: [{ prompt: 'Comment calculer un rendement locatif ?', moteur: 'perplexity', mentionne: false, cite: false, concurrents: ['ANIL'] }, { prompt: 'Qu’est-ce que Tableau Immo ?', moteur: 'recherche-web', mentionne: true, cite: true, concurrents: [] }] },
    targets: {
      requetes: [
        { texte: 'calcul rendement locatif', priorite: 1, origine: 'graine', ajouteeLe: '2026-10-14' },
        { texte: 'dispositif jeanbrun', priorite: 2, origine: 'graine', ajouteeLe: '2026-10-14' },
        { texte: 'viager occupé', priorite: 3, origine: 'graine', ajouteeLe: '2026-10-14' },
      ],
      prompts: [],
      concurrents: [],
    },
    experiments: [],
    previous: null,
    ...overrides,
  };
}

function snapshotOf(analysisInput: AnalysisInput): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    creeLe: analysisInput.now.toISOString(),
    site: SITE,
    episodes: analysisInput.episodes,
    contenus: analysisInput.contenus,
    connecteurs: analysisInput.connectors,
    geo: analysisInput.geo,
    analyse: analyse(analysisInput),
  };
}

const experiment = (overrides: Partial<Experiment> = {}): Experiment => ({
  id: 'titre-accueil',
  date: '2026-10-20',
  type: 'titre',
  cible: `${SITE}/`,
  hypothese: 'Un titre qui commence par la requête attire plus de clics.',
  changement: 'Avant : « A ». Après : « B ».',
  mesure: { indicateur: 'clics', page: `${SITE}/` },
  avant: 4,
  evaluerApresJours: 28,
  statut: 'en-cours',
  ...overrides,
});

describe('score de visibilité', () => {
  it('pondère les parties mesurées et ignore celles qui ne le sont pas', () => {
    const score = computeScore(connectors(), input().geo);
    const parts = Object.fromEntries(score.parties.map((part) => [part.nom, part.valeur]));
    // technique : 100 − 10 (1 erreur) − 4 (2 avertissements, l'info ne compte pas)
    // youtube : 70 % × 60 (999 vues) + 30 % × 0 (la seule vidéo a un problème)
    expect(parts).toEqual({ technique: 86, performance: 95, indexation: 50, google: 75, youtube: 42, geo: 50 });
    expect(score.total).toBe(Math.round((86 * 15 + 95 * 10 + 50 * 20 + 75 * 25 + 42 * 15 + 50 * 15) / 100));
    expect(score.couverture).toBe(100);

    const withoutSearch = computeScore(connectors({ searchConsole: { statut: 'absent', raison: 'x', configuration: 'y' } }), null);
    expect(withoutSearch.parties.filter((part) => part.valeur === null).map((part) => part.nom)).toEqual(['indexation', 'google', 'geo']);
    expect(withoutSearch.total).toBe(Math.round((86 * 15 + 95 * 10 + 42 * 15) / 40));
    expect(withoutSearch.couverture).toBe(40);
  });

  it('aucune partie mesurée : pas de score', () => {
    const none = connectors({
      site: { statut: 'erreur', dureeMs: 1, erreur: 'x' },
      performance: { statut: 'absent', raison: 'x', configuration: 'y' },
      searchConsole: { statut: 'absent', raison: 'x', configuration: 'y' },
      youtube: { statut: 'erreur', dureeMs: 1, erreur: 'x' },
    });
    expect(computeScore(none, null)).toMatchObject({ total: null, couverture: 0 });
  });
});

describe('expériences', () => {
  const data = searchConsole();

  it('attend la fin de la période de mesure', () => {
    expect(evaluateExperiment(experiment({ date: '2026-11-10' }), data, NOW)).toMatchObject({ verdict: 'trop-tot', commentaire: 'À évaluer dans 18 jour(s).' });
  });

  it('juge les clics, le CTR et la position', () => {
    expect(evaluateExperiment(experiment(), data, NOW)).toMatchObject({ verdict: 'gagnante', apres: 6, variation: 0.5 });
    expect(evaluateExperiment(experiment({ avant: 6 }), data, NOW)).toMatchObject({ verdict: 'neutre', variation: 0 });
    expect(evaluateExperiment(experiment({ mesure: { indicateur: 'position', page: `${SITE}/outils/` }, avant: 7.5 }), data, NOW)).toMatchObject({ verdict: 'neutre', variation: -0.5 });
    expect(evaluateExperiment(experiment({ mesure: { indicateur: 'position', requete: 'calcul rendement locatif', page: `${SITE}/` }, avant: 9 }), data, NOW)).toMatchObject({ verdict: 'gagnante', apres: 6, variation: 3 });
    expect(evaluateExperiment(experiment({ mesure: { indicateur: 'clics', page: `${SITE}/disparue/` }, avant: 5 }), data, NOW)).toMatchObject({ verdict: 'perdante', apres: 0 });
  });

  it('sans Search Console ou sans référence, pas de verdict', () => {
    expect(evaluateExperiment(experiment(), null, NOW).verdict).toBe('sans-donnees');
    expect(evaluateExperiment(experiment({ avant: null }), data, NOW).verdict).toBe('sans-donnees');
    expect(evaluateExperiment(experiment({ mesure: { indicateur: 'ctr', page: `${SITE}/disparue/` } }), data, NOW)).toMatchObject({ verdict: 'sans-donnees', apres: null });
  });

  it('reporte seulement les verdicts définitifs dans le journal', () => {
    const journal = [experiment(), experiment({ id: 'recente', date: '2026-11-15' }), experiment({ id: 'finie', statut: 'gagnante' })];
    const evaluations = journal.map((item) => evaluateExperiment(item, data, NOW));
    const updated = applyEvaluations(journal, evaluations, '2026-11-20');
    expect(updated.map((item) => item.statut)).toEqual(['gagnante', 'en-cours', 'gagnante']);
    expect(updated[0]?.resultat).toEqual({ date: '2026-11-20', apres: 6, variation: 0.5, commentaire: 'clics : 4 → 6 (+50 %).' });
    expect(updated[2]?.resultat).toBeUndefined();
  });
});

describe('opportunités', () => {
  it('classe les actions par priorité : erreurs, épisodes, YouTube, requêtes proches, contenus, IA, connecteurs', () => {
    const { opportunites } = analyse(input());
    const ids = opportunites.map((item) => item.id);
    expect(ids.slice(0, 4)).toEqual(['correction:lien-casse', 'nouvel-episode:TIfixture01', 'correction:indexnow-cle', 'youtube:TIfixture01:lien-site-absent']);
    expect(ids).toEqual(
      expect.arrayContaining([
        'requete-proche:calcul-rendement-locatif',
        'correction:titre-long',
        'ctr-faible:https-tableauimmo-github-io',
        'contenu:dispositif-jeanbrun',
        'contenu:suggestions',
        'geo:perplexity:comment-calculer-un-rendement-locatif',
        'connecteur:knowledgeGraph',
      ]),
    );
    // La requête la mieux servie par l'accueil est proposée pour renforcer l'accueil.
    expect(opportunites.find((item) => item.id === 'requete-proche:calcul-rendement-locatif')?.cible).toBe(`${SITE}/`);
    // Priorité 3 et requêtes déjà couvertes : pas d'opportunité de contenu.
    expect(ids).not.toContain('contenu:viager-occupe');
    expect(ids).not.toContain('contenu:calcul-rendement-locatif');
    expect(opportunites.find((item) => item.id === 'contenu:suggestions')?.detail).toContain('calcul rendement locatif net');
    expect(ids.indexOf('connecteur:knowledgeGraph')).toBe(ids.length - 1);
  });

  it('un épisode déjà connu et indexé ne demande plus d’action', () => {
    const indexed = searchConsole({ inspections: [{ url: `${SITE}/episodes/rendement-brut-ou-net/`, verdict: 'PASS', etat: 'Indexée', indexee: true, resultatsEnrichis: ['Videos'] }] });
    const previous = snapshotOf(input());
    const { opportunites } = analyse(input({ connectors: connectors({ searchConsole: { statut: 'ok', dureeMs: 1, donnees: indexed } }), previous }));
    expect(opportunites.some((item) => item.type === 'nouvel-episode')).toBe(false);
  });
});

describe('fraîcheur des contenus financiers', () => {
  const page = (verifieLe: string, extra: { aSurveiller?: string; theme?: string } = {}) => ({
    url: `${SITE}/lexique/lmnp/`,
    titre: 'LMNP',
    type: 'lexique' as const,
    theme: extra.theme ?? 'fiscalite',
    verifieLe,
    ...(extra.aSurveiller ? { aSurveiller: extra.aSurveiller } : {}),
  });

  it('demande de revérifier une page fiscale trop ancienne et une règle « à surveiller » échue', () => {
    const items = freshnessOpportunities([page('2026-06-01', { aSurveiller: '2026-10-01' })], NOW);
    expect(items.map((item) => item.id)).toEqual(['fraicheur:https-tableauimmo-github-io-lexique-lmnp', 'fraicheur:surveiller:https-tableauimmo-github-io-lexique-lmnp']);
    expect(items[0]?.titre).toContain('172 jours');
    expect(items.every((item) => item.type === 'fraicheur' && item.cible === `${SITE}/lexique/lmnp/`)).toBe(true);
  });

  it('une page récente, ou d’un thème moins volatil, ne demande rien', () => {
    expect(freshnessOpportunities([page('2026-11-01'), page('2026-06-01', { theme: 'strategie' })], NOW)).toEqual([]);
  });

  it('les opportunités de fraîcheur passent avant les expériences', () => {
    const { opportunites } = analyse(input({ contenus: [page('2026-01-10')] }));
    const ids = opportunites.map((item) => item.id);
    expect(ids.indexOf('fraicheur:https-tableauimmo-github-io-lexique-lmnp')).toBeLessThan(ids.indexOf('requete-proche:calcul-rendement-locatif'));
  });
});

describe('outils d’analyse', () => {
  it('CTR attendu selon la position', () => {
    expect(expectedCtr(1)).toBe(0.28);
    expect(expectedCtr(3.4)).toBe(0.11);
    expect(expectedCtr(25)).toBe(0.01);
  });

  it('mots significatifs sans accents ni mots outils', () => {
    expect(significantWords('Crédits immobiliers pour les primo-accédants de 30 ans')).toEqual(['credit', 'immobilier', 'primo', 'accedant', '30', 'ans']);
  });

  it('horodatage des fichiers en UTC', () => {
    expect(runStamp(new Date('2026-10-14T07:05:09Z'))).toBe('2026-10-14_0705');
  });
});

describe('instantané et rapport', () => {
  const snapshot = snapshotOf(input());
  const analysis = snapshot.analyse;

  it('l’instantané respecte son schéma', () => {
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('le rapport contient le score, les sources, les opportunités et la place pour les actions', () => {
    const report = renderReport(snapshot);
    expect(report).toContain(`**Score de visibilité : ${analysis.score.total}/100** (premier passage : point de départ)`);
    expect(report).toContain('| Google Knowledge Graph | ⚪ non connecté — GOOGLE_API_KEY absente |');
    expect(report).toContain('| calcul rendement locatif | 120 | 4 | 6.3 |');
    expect(report).toContain('## Opportunités (par priorité)');
    expect(report).toContain('## À configurer');
    expect(report).toContain('_Complété par la routine à la fin du passage._');
  });

  it('compare au passage précédent', () => {
    const later = analyse(input({ previous: snapshot, connectors: connectors({ searchConsole: { statut: 'ok', dureeMs: 1, donnees: searchConsole({ totaux: { actuel: { clics: 55, impressions: 1500, ctr: 0.037, position: 8 }, precedent: { clics: 40, impressions: 1000, ctr: 0.04, position: 9 } } }) } }) }));
    expect(later.evolution).toMatchObject({ depuis: NOW.toISOString(), clics: 15, impressions: 500, vuesYoutube: 0, problemes: 0 });
    expect(later.evolution.score).toBe(later.score.total === null || analysis.score.total === null ? null : later.score.total - analysis.score.total);
  });

  it('ne compare pas deux scores mesurés sur des sources différentes', () => {
    const withoutPerformance = analyse(input({ previous: snapshot, connectors: connectors({ performance: { statut: 'absent', raison: 'x', configuration: 'y' } }) }));
    expect(withoutPerformance.score.couverture).toBe(90);
    expect(withoutPerformance.evolution.score).toBeNull();
    const later: Snapshot = { ...snapshot, analyse: withoutPerformance };
    expect(renderReport(later)).toContain('score non comparable');
  });
});

describe('historique des passages', () => {
  async function historyWith(name: string, content: unknown): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'visibilite-'));
    await mkdir(path.join(dir, 'historique'));
    await writeFile(path.join(dir, 'historique', name), JSON.stringify(content));
    return dir;
  }

  it('relit le dernier passage au format actuel', async () => {
    const snapshot = snapshotOf(input());
    const dir = await historyWith('2026-11-20_1000.json', snapshot);
    await expect(latestSnapshot(dir)).resolves.toEqual(snapshot);
  });

  it('ignore un passage d’un ancien format au lieu de bloquer la routine', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const dir = await historyWith('2026-11-20_1000.json', { version: 0, ancien: true });
    await expect(latestSnapshot(dir)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('pas de comparaison'));
    warn.mockRestore();
  });

  it('un passage au format actuel mais abîmé arrête la routine', async () => {
    const dir = await historyWith('2026-11-20_1000.json', { version: SNAPSHOT_VERSION });
    await expect(latestSnapshot(dir)).rejects.toThrow(/invalide/);
  });
});
