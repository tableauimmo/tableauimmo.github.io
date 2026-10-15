// Rapport lisible d'un passage de la routine (visibilite/rapports/AAAA-MM-JJ_HHMM.md).
import type { Connectors, Snapshot } from './schema.ts';

const CONNECTOR_LABELS: Record<keyof Connectors, string> = {
  site: 'Audit du site',
  performance: 'Performance mobile',
  searchConsole: 'Google Search Console',
  youtube: 'Chaîne YouTube',
  suggestions: 'Suggestions Google et YouTube',
  knowledgeGraph: 'Google Knowledge Graph',
  indexNow: 'IndexNow (Bing, Copilot, ChatGPT…)',
};

const PART_LABELS: Record<string, string> = {
  technique: 'Technique du site',
  performance: 'Performance',
  indexation: 'Indexation Google',
  google: 'Audience Google',
  youtube: 'YouTube',
  geo: 'Réponses des IA (GEO)',
};

const signed = (value: number | null, unit = '') => (value === null ? '—' : `${value > 0 ? '+' : ''}${value}${unit}`);
const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
const escapeCell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function scoreEvolution(evolution: Snapshot['analyse']['evolution']): string {
  if (!evolution.depuis) return ' (premier passage : point de départ)';
  const since = evolution.depuis.slice(0, 10);
  if (evolution.score === null) return ` (sources mesurées différentes du passage du ${since} : score non comparable)`;
  return ` (${signed(evolution.score)} depuis le ${since})`;
}

function connectorLine(name: keyof Connectors, result: Connectors[keyof Connectors]): string {
  const state = result.statut === 'ok' ? `✅ ok (${Math.round(result.dureeMs / 100) / 10} s)` : result.statut === 'absent' ? `⚪ non connecté — ${result.raison}` : `❌ erreur — ${result.erreur}`;
  return `| ${CONNECTOR_LABELS[name]} | ${escapeCell(state)} |`;
}

function searchConsoleSection(connectors: Connectors): string[] {
  if (connectors.searchConsole.statut !== 'ok') return ['## Google (Search Console)', '', '_Non connectée : voir « À configurer »._', ''];
  const data = connectors.searchConsole.donnees;
  const { actuel, precedent } = data.totaux;
  const lines = [
    '## Google (Search Console)',
    '',
    `Période ${data.periode.debut} → ${data.periode.fin} (comparée aux 28 jours précédents).`,
    '',
    '| | 28 derniers jours | Avant |',
    '|---|---|---|',
    `| Clics | ${actuel.clics} | ${precedent.clics} |`,
    `| Impressions | ${actuel.impressions} | ${precedent.impressions} |`,
    `| CTR | ${percent(actuel.ctr)} | ${percent(precedent.ctr)} |`,
    `| Position moyenne | ${actuel.position.toFixed(1)} | ${precedent.position.toFixed(1)} |`,
    '',
  ];
  const queries = [...data.requetes].sort((a, b) => b.impressions - a.impressions).slice(0, 15);
  if (queries.length > 0) {
    lines.push('Requêtes principales :', '', '| Requête | Impressions | Clics | Position |', '|---|---|---|---|');
    for (const row of queries) lines.push(`| ${escapeCell(row.cles[0] ?? '')} | ${row.impressions} | ${row.clics} | ${row.position.toFixed(1)} |`);
    lines.push('');
  }
  if (data.inspections.length > 0) {
    const indexed = data.inspections.filter((inspection) => inspection.indexee).length;
    lines.push(`Indexation : ${indexed}/${data.inspections.length} pages inspectées sont dans Google.`, '');
    for (const inspection of data.inspections.filter((item) => !item.indexee)) lines.push(`- ${inspection.url} : ${inspection.etat}`);
    lines.push('');
  }
  for (const sitemap of data.sitemaps) {
    lines.push(`- Sitemap ${sitemap.chemin} : ${sitemap.erreurs} erreur(s), ${sitemap.avertissements} avertissement(s)${sitemap.luLe ? `, lu le ${sitemap.luLe.slice(0, 10)}` : ''}`);
  }
  lines.push('');
  return lines;
}

function youtubeSection(connectors: Connectors): string[] {
  if (connectors.youtube.statut !== 'ok') return [];
  const data = connectors.youtube.donnees;
  const lines = ['## YouTube', ''];
  const { abonnes, vues, videos } = data.chaine;
  if (abonnes !== undefined || vues !== undefined) lines.push(`Chaîne : ${abonnes ?? '?'} abonnés, ${vues ?? '?'} vues, ${videos ?? '?'} vidéos.`, '');
  if (data.videos.length === 0) return [...lines, '_Aucune vidéo publiée pour l’instant._', ''];
  lines.push('| Vidéo | Publiée | Vues | Problèmes |', '|---|---|---|---|');
  for (const video of data.videos) {
    lines.push(`| ${escapeCell(video.titre)}${video.short ? ' (Short)' : ''} | ${video.publieeLe.slice(0, 10)} | ${video.vues ?? '—'} | ${video.problemes.length === 0 ? '✅' : escapeCell(video.problemes.map((problem) => problem.code).join(', '))} |`);
  }
  return [...lines, ''];
}

function performanceSection(connectors: Connectors): string[] {
  if (connectors.performance.statut !== 'ok') return [];
  const lines = ['## Performance mobile', '', '| Page | Source | Perf. | SEO | Access. | LCP | CLS | Terrain (vrais visiteurs) |', '|---|---|---|---|---|---|---|---|'];
  for (const result of connectors.performance.donnees) {
    const field = result.terrain ? `${result.terrain.categorie}${result.terrain.inpMs !== undefined ? `, INP ${result.terrain.inpMs} ms` : ''}` : '—';
    lines.push(`| ${result.url} | ${result.source} | ${result.scores.performance} | ${result.scores.seo} | ${result.scores.accessibilite} | ${(result.lcpMs / 1000).toFixed(1)} s | ${result.cls} | ${field} |`);
  }
  return [...lines, ''];
}

function siteSection(connectors: Connectors): string[] {
  if (connectors.site.statut !== 'ok') return [];
  const data = connectors.site.donnees;
  const errors = data.problemes.filter((issue) => issue.severite === 'erreur');
  const warnings = data.problemes.filter((issue) => issue.severite === 'avertissement');
  const lines = ['## Site', '', `${data.pages.length} pages auditées, ${data.liensVerifies} liens internes vérifiés : ${errors.length} erreur(s), ${warnings.length} avertissement(s).`, ''];
  for (const issue of [...errors, ...warnings].slice(0, 25)) lines.push(`- ${issue.severite === 'erreur' ? '❌' : '⚠️'} ${issue.code} — ${issue.message} (${issue.url})`);
  return [...lines, ''];
}

function suggestionsSection(connectors: Connectors): string[] {
  if (connectors.suggestions.statut !== 'ok') return [];
  const data = connectors.suggestions.donnees;
  const lines = [
    '## Ce que tapent les investisseurs (suggestions)',
    '',
    `Marque : en tapant « ${data.marque.saisie} », Google ${data.marque.google ? 'propose' : 'ne propose pas encore'} « tableau immo », YouTube ${data.marque.youtube ? 'le propose' : 'ne le propose pas encore'}.`,
    '',
  ];
  for (const seed of data.graines) lines.push(`- **${seed.requete}** — Google : ${seed.google.slice(0, 6).join(' · ') || '—'} | YouTube : ${seed.youtube.slice(0, 6).join(' · ') || '—'}`);
  return [...lines, ''];
}

function geoSection(snapshot: Snapshot): string[] {
  if (!snapshot.geo) return ['## Réponses des IA (GEO)', '', '_Aucun sondage enregistré : la routine le fait à chaque passage (étape GEO)._', ''];
  const lines = ['## Réponses des IA (GEO)', '', `Sondage du ${snapshot.geo.date} :`, '', '| Moteur | Question | Nommés | Cités | Cités à la place |', '|---|---|---|---|---|'];
  for (const probe of snapshot.geo.sondages) {
    lines.push(`| ${probe.moteur} | ${escapeCell(probe.prompt)} | ${probe.mentionne ? '✅' : '—'} | ${probe.cite ? '✅' : '—'} | ${escapeCell(probe.concurrents.join(', ')) || '—'} |`);
  }
  return [...lines, ''];
}

export function renderReport(snapshot: Snapshot): string {
  const { analyse, connecteurs } = snapshot;
  const lines = [
    `# Visibilité de Tableau Immo — ${snapshot.creeLe.slice(0, 16).replace('T', ' ')} UTC`,
    '',
    `**Score de visibilité : ${analyse.score.total ?? '—'}/100**${scoreEvolution(analyse.evolution)}`,
    '',
    ...(analyse.score.couverture < 100
      ? [`_Score provisoire : ${analyse.score.couverture} % des critères sont mesurés. Les sources non connectées (voir « À configurer ») ne comptent pas encore._`, '']
      : []),
    '| Partie | Score | Poids |',
    '|---|---|---|',
    ...analyse.score.parties.map((part) => `| ${PART_LABELS[part.nom] ?? part.nom} | ${part.valeur ?? 'non mesuré'} | ${part.poids} |`),
    '',
  ];
  if (analyse.evolution.depuis) {
    lines.push(
      `Évolution : clics Google ${signed(analyse.evolution.clics)}, impressions ${signed(analyse.evolution.impressions)}, vues YouTube ${signed(analyse.evolution.vuesYoutube)}, problèmes du site ${signed(analyse.evolution.problemes)}.`,
      '',
    );
  }
  lines.push('## Connecteurs', '', '| Source | État |', '|---|---|');
  for (const name of Object.keys(CONNECTOR_LABELS) as (keyof Connectors)[]) lines.push(connectorLine(name, connecteurs[name]));
  lines.push('', '## Épisodes', '');
  lines.push(
    snapshot.episodes.publies.length === 0
      ? `Aucun épisode publié. À venir : ${snapshot.episodes.aVenir.map((episode) => `${episode.numero}. ${episode.titre}`).join(', ') || '—'}.`
      : snapshot.episodes.publies.map((episode) => `- Épisode ${episode.numero} : [${episode.titre}](${episode.url}) — publié le ${episode.publieLe.slice(0, 10)}`).join('\n'),
    '',
  );
  const stale = analyse.opportunites.filter((item) => item.type === 'fraicheur');
  lines.push('## Fraîcheur des contenus', '', `${snapshot.contenus.length} pages datées suivies (épisodes, lexique) : ${stale.length === 0 ? 'toutes à jour.' : `${stale.length} à revoir (voir les opportunités « fraicheur »).`}`, '');
  lines.push(...searchConsoleSection(connecteurs), ...youtubeSection(connecteurs), ...performanceSection(connecteurs), ...siteSection(connecteurs), ...suggestionsSection(connecteurs), ...geoSection(snapshot));
  if (analyse.evaluations.length > 0) {
    lines.push('## Expériences en cours', '');
    for (const evaluation of analyse.evaluations) lines.push(`- ${evaluation.id} : **${evaluation.verdict}** — ${evaluation.commentaire}`);
    lines.push('');
  }
  lines.push('## Opportunités (par priorité)', '');
  for (const opportunity of analyse.opportunites.filter((item) => item.type !== 'connecteur').slice(0, 20)) {
    lines.push(`1. **[${opportunity.priorite}] ${opportunity.titre}** — ${opportunity.detail}`);
  }
  const setup = analyse.opportunites.filter((item) => item.type === 'connecteur');
  if (setup.length > 0) {
    lines.push('', '## À configurer', '');
    for (const item of setup) lines.push(`- **${item.titre}** — ${item.detail}`);
  }
  lines.push('', '## Actions réalisées par la routine', '', '_Complété par la routine à la fin du passage._', '');
  return lines.join('\n');
}
