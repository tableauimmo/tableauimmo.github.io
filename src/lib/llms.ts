// Textes pour les assistants et moteurs de réponse (llms.txt, llms-full.txt) : faits clairs, sourcés, datés.
import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE, SOCIAL, YOUTUBE } from '../../site.config.mjs';
import { CATEGORIES, CATEGORY_LIST, categoryPath } from '../data/categories.ts';
import { TOOL_LIST, toolPath } from '../data/tools.ts';
import { episodePath, getPublishedEpisodes, lastUpdated, type PublishedEpisode } from './episodes.ts';
import { collator, isoDay } from './format.ts';
import type { Tableau } from './schemas.ts';
import { absoluteUrl } from './url.ts';

export const PRESENTATION = `${SITE.name} est une chaîne vidéo pédagogique (YouTube, TikTok, Instagram, Facebook, LinkedIn, X) sur l’investissement immobilier en France : des épisodes d’une dizaine de minutes où chaque sujet (fiscalité, crédit, rendement, juridique, travaux, location, patrimoine) est posé au tableau, chiffré, sourcé et daté. Le site propose les pages des épisodes (tableau de chiffres, points clés, transcription, sources officielles), 4 calculateurs gratuits et un lexique. Contenu pédagogique, jamais de conseil personnalisé. Illustrations et voix générées avec l’aide de l’IA ; contenu vérifié et sourcé.`;

export async function sortedTerms(): Promise<CollectionEntry<'lexique'>[]> {
  return (await getCollection('lexique')).sort((a, b) => collator.compare(a.data.term, b.data.term));
}

/** Liens Markdown relatifs (« /lexique/lmnp/ ») rendus absolus. */
export function absoluteLinks(markdown: string): string {
  return markdown.replace(/\]\((\/[^)\s]*)\)/g, (_match, path: string) => `](${absoluteUrl(path)})`);
}

export function tableauMarkdown(tableau: Tableau): string {
  const clean = (cell: string) => cell.replace(/\|/g, '\\|');
  return [
    `**${tableau.caption}**`,
    '',
    `| ${tableau.columns.map(clean).join(' | ')} |`,
    `| ${tableau.columns.map(() => '---').join(' | ')} |`,
    ...tableau.rows.map((row) => `| ${row.map(clean).join(' | ')} |`),
    ...(tableau.note ? ['', `_${tableau.note}_`] : []),
  ].join('\n');
}

export function episodeLine(episode: PublishedEpisode): string {
  return `- [Épisode ${episode.data.number} : ${episode.data.title}](${absoluteUrl(episodePath(episode))}) (${CATEGORIES[episode.data.category].label}, publié le ${isoDay(episode.data.publishedAt)}) : ${episode.data.summary}`;
}

export async function llmsSummary(): Promise<string> {
  const [episodes, terms] = await Promise.all([getPublishedEpisodes(), sortedTerms()]);
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${PRESENTATION}`,
    '',
    `- Site : ${absoluteUrl('/')}`,
    `- Chaîne YouTube : ${YOUTUBE.channelUrl}`,
    `- Contact : ${SITE.contactEmail}`,
    `- Version complète de ce résumé : ${absoluteUrl('/llms-full.txt')}`,
    '',
    '## Épisodes',
    ...(episodes.length ? episodes.map(episodeLine) : [`- [Les épisodes](${absoluteUrl('/episodes/')}) : le premier épisode arrive bientôt.`]),
    '',
    '## Calculateurs gratuits',
    ...TOOL_LIST.map((tool) => `- [${tool.title}](${absoluteUrl(toolPath(tool.id))}) : ${tool.tagline} Formule : ${tool.formula}.`),
    '',
    '## Lexique',
    ...terms.map((term) => `- [${term.data.term}${term.data.expansion ? ` (${term.data.expansion})` : ''}](${absoluteUrl(`/lexique/${term.id}/`)}) : ${term.data.definition}`),
    '',
    '## Thèmes',
    ...CATEGORY_LIST.map((category) => `- [${category.title}](${absoluteUrl(categoryPath(category.key))}) : ${category.tagline}`),
    '',
    '## À propos',
    `- [Charte éditoriale](${absoluteUrl('/a-propos/')}) : pédagogie, sources officielles, indépendance, aucun conseil personnalisé, usage transparent de l’IA.`,
    `- [Méthode de calcul](${absoluteUrl('/methode/')}) : toutes les formules des calculateurs.`,
    `- Réseaux : ${SOCIAL.map((network) => `${network.label} ${network.url}`).join(' ; ')}`,
    '',
  ];
  return lines.join('\n');
}

export async function llmsFull(): Promise<string> {
  const [episodes, terms] = await Promise.all([getPublishedEpisodes(), sortedTerms()]);
  const parts: string[] = [`# ${SITE.name} — contenu complet`, '', `> ${PRESENTATION}`, '', `Source : ${absoluteUrl('/')} — contact : ${SITE.contactEmail}`, ''];

  parts.push('## Épisodes', '');
  if (!episodes.length) parts.push('Le premier épisode arrive bientôt.', '');
  for (const episode of episodes) {
    const { data } = episode;
    parts.push(
      `### Épisode ${data.number} : ${data.title}`,
      '',
      `URL : ${absoluteUrl(episodePath(episode))} — vidéo : https://www.youtube.com/watch?v=${data.youtubeId}`,
      `Thème : ${CATEGORIES[data.category].label} — publié le ${isoDay(data.publishedAt)} — mis à jour le ${isoDay(lastUpdated(episode))}`,
      '',
      data.summary,
      '',
      'En bref :',
      ...data.keyTakeaways.map((item) => `- ${item}`),
      '',
      tableauMarkdown(data.tableau),
      '',
      ...(data.faq.length ? ['Questions fréquentes :', ...data.faq.flatMap((item) => [`- ${item.q}`, `  ${item.a}`]), ''] : []),
      'Sources :',
      ...data.sources.map((source) => `- ${source.title} : ${source.url}`),
      '',
    );
  }

  parts.push('## Calculateurs', '');
  for (const tool of TOOL_LIST) {
    parts.push(`### ${tool.title}`, '', `URL : ${absoluteUrl(toolPath(tool.id))}`, '', `${tool.tagline} Formule : ${tool.formula}.`, '');
  }
  parts.push(`Toutes les formules détaillées : ${absoluteUrl('/methode/')}`, '');

  parts.push('## Lexique', '');
  for (const term of terms) {
    const { data } = term;
    parts.push(
      `### ${data.term}${data.expansion ? ` (${data.expansion})` : ''}`,
      '',
      `URL : ${absoluteUrl(`/lexique/${term.id}/`)} — vérifié le ${isoDay(data.updatedAt)}`,
      '',
      `**Définition :** ${data.definition}`,
      '',
      absoluteLinks((term.body ?? '').trim()),
      '',
      ...(data.watch ? [`**À surveiller (${isoDay(data.watch.date)}) :** ${data.watch.note}`, ''] : []),
      'Sources :',
      ...data.sources.map((source) => `- ${source.title} : ${source.url}`),
      '',
    );
  }
  parts.push('---', 'Contenu pédagogique, pas un conseil personnalisé. Tout investissement comporte des risques, dont la perte en capital.', '');
  return parts.join('\n');
}
