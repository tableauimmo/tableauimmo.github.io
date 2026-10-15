// Données structurées schema.org (JSON-LD) pour Google et les moteurs de réponse (GEO).
// Toutes les URL passées ici doivent être absolues. Auteur et éditeur : l'organisation « Tableau Immo »
// (aucune personne nommée, nulle part).
import { SITE, SOCIAL, YOUTUBE } from '../../site.config.mjs';
import { absoluteUrl } from './url.ts';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonLdNode = { [key: string]: JsonValue };

export const ORGANIZATION_ID = absoluteUrl('/#organisation');
export const WEBSITE_ID = absoluteUrl('/#site');
export const SERIES_ID = absoluteUrl('/episodes/#serie');
export const LEXICON_ID = absoluteUrl('/lexique/#lexique');

const ORG_REF: JsonLdNode = { '@id': ORGANIZATION_ID };

/** Profils publics déclarés aux moteurs : seulement les comptes confirmés (site.config.mjs → SOCIAL). */
export function sameAs(): string[] {
  const urls = SOCIAL.filter((network) => network.verified).map((network) => network.url.replace(/\?.*$/, ''));
  if (YOUTUBE.channelId) urls.push(YOUTUBE.channelUrl);
  return [...new Set(urls)];
}

export function organizationNode(logoUrl: string): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE.name,
    url: absoluteUrl('/'),
    description: `${SITE.name} : chaîne vidéo pédagogique sur l’investissement immobilier en France (fiscalité, crédit, rendement, juridique), avec calculateurs et lexique.`,
    logo: { '@type': 'ImageObject', url: logoUrl, width: 512, height: 512 },
    email: SITE.contactEmail,
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: SITE.contactEmail, availableLanguage: ['French'] },
    knowsAbout: ['Investissement immobilier', 'Fiscalité immobilière', 'Crédit immobilier', 'Location meublée', 'Rendement locatif'],
    sameAs: sameAs(),
  };
}

export function websiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    alternateName: 'Tableau Immo — l’investissement immobilier expliqué au tableau',
    url: absoluteUrl('/'),
    inLanguage: SITE.locale,
    publisher: ORG_REF,
  };
}

export function seriesNode(input: { description: string; episodeCount: number }): JsonLdNode {
  return {
    '@type': 'CreativeWorkSeries',
    '@id': SERIES_ID,
    name: SITE.name,
    description: input.description,
    url: absoluteUrl('/episodes/'),
    inLanguage: SITE.locale,
    genre: ['Éducation financière', 'Immobilier'],
    isAccessibleForFree: true,
    author: ORG_REF,
    publisher: ORG_REF,
    ...(input.episodeCount > 0 ? { numberOfEpisodes: input.episodeCount } : {}),
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbNode(crumbs: Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export interface VideoInput {
  name: string;
  description: string;
  pageUrl: string;
  thumbnailUrl: string;
  uploadDate: Date;
  dateModified: Date;
  youtubeId: string;
  embedUrl: string;
  duration: string | undefined;
  episodeNumber: number;
  keywords: string[];
  about: string;
  chapters: { start: number; end: number; title: string; url: string }[];
}

/** VideoObject (résultats vidéo Google) et épisode de la série, avec les moments clés (Clip). */
export function videoNode(video: VideoInput): JsonLdNode {
  const node: JsonLdNode = {
    '@type': ['VideoObject', 'Episode'],
    '@id': `${video.pageUrl}#video`,
    name: video.name,
    description: video.description,
    url: video.pageUrl,
    thumbnailUrl: [video.thumbnailUrl],
    uploadDate: video.uploadDate.toISOString(),
    datePublished: video.uploadDate.toISOString(),
    dateModified: video.dateModified.toISOString(),
    embedUrl: video.embedUrl,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
    inLanguage: SITE.locale,
    isAccessibleForFree: true,
    episodeNumber: video.episodeNumber,
    partOfSeries: { '@id': SERIES_ID },
    author: ORG_REF,
    publisher: ORG_REF,
    about: video.about,
    keywords: video.keywords.join(', '),
  };
  if (video.duration) node.duration = video.duration;
  if (video.chapters.length) {
    node.hasPart = video.chapters.map((chapter) => ({
      '@type': 'Clip',
      name: chapter.title,
      startOffset: chapter.start,
      endOffset: chapter.end,
      url: chapter.url,
    }));
  }
  return node;
}

export function faqNode(items: { q: string; a: string }[], pageUrl: string): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function itemListNode(items: { name: string; url: string }[]): JsonLdNode {
  return {
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: item.url })),
  };
}

export interface WebPageInput {
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage';
  name: string;
  description: string;
  pageUrl: string;
  dateModified?: Date | undefined;
  about?: JsonValue;
}

export function webPageNode(page: WebPageInput): JsonLdNode {
  return {
    '@type': page.type ?? 'WebPage',
    '@id': `${page.pageUrl}#page`,
    name: page.name,
    description: page.description,
    url: page.pageUrl,
    inLanguage: SITE.locale,
    isPartOf: { '@id': WEBSITE_ID },
    author: ORG_REF,
    publisher: ORG_REF,
    ...(page.dateModified ? { dateModified: page.dateModified.toISOString() } : {}),
    ...(page.about !== undefined ? { about: page.about } : {}),
  };
}

export interface TermInput {
  term: string;
  expansion?: string | undefined;
  definition: string;
  pageUrl: string;
  aliases: string[];
}

export function definedTermNode(term: TermInput): JsonLdNode {
  return {
    '@type': 'DefinedTerm',
    '@id': `${term.pageUrl}#terme`,
    name: term.term,
    ...(term.expansion || term.aliases.length ? { alternateName: [...(term.expansion ? [term.expansion] : []), ...term.aliases] } : {}),
    description: term.definition,
    url: term.pageUrl,
    inLanguage: SITE.locale,
    inDefinedTermSet: { '@id': LEXICON_ID },
  };
}

export function definedTermSetNode(terms: TermInput[], description: string): JsonLdNode {
  return {
    '@type': 'DefinedTermSet',
    '@id': LEXICON_ID,
    name: `Le lexique de l’investissement immobilier — ${SITE.name}`,
    description,
    url: absoluteUrl('/lexique/'),
    inLanguage: SITE.locale,
    publisher: ORG_REF,
    hasDefinedTerm: terms.map((term) => ({ '@type': 'DefinedTerm', '@id': `${term.pageUrl}#terme`, name: term.term, url: term.pageUrl, description: term.definition })),
  };
}

/** Sérialise un graphe JSON-LD pour une balise <script type="application/ld+json"> (échappe « < »). */
export function serializeGraph(nodes: JsonLdNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}
