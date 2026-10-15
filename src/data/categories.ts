// Les 8 thèmes du site. Clé stable = segment d'URL (/categories/<clé>/) et valeur du champ « category ».
// Aucune dépendance Astro : importé aussi par les scripts (ajout d'épisode).

export const CATEGORY_KEYS = ['financement', 'fiscalite', 'strategie', 'marche', 'juridique', 'travaux', 'location', 'patrimoine'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface Category {
  key: CategoryKey;
  /** Nom court (menus, étiquettes) */
  label: string;
  /** Titre de la page de thème (H1) */
  title: string;
  /** Description pour Google (70 à 160 caractères) */
  description: string;
  /** Une phrase d'accroche (cartes) */
  tagline: string;
  /** Paragraphe d'introduction de la page de thème */
  intro: string;
  icon: string;
}

export const CATEGORIES: Record<CategoryKey, Category> = {
  financement: {
    key: 'financement',
    label: 'Financement',
    title: 'Financer un investissement immobilier',
    description: 'Crédit immobilier, taux, assurance, apport, capacité d’emprunt et règles du HCSF : comprendre comment se finance un achat locatif en France.',
    tagline: 'Crédit, taux, assurance, apport et règles des banques.',
    intro:
      'Le crédit est le moteur de la plupart des investissements locatifs. Ces épisodes décortiquent la mensualité, le coût total d’un prêt, l’assurance emprunteur, l’apport et les règles du Haut Conseil de stabilité financière (35 % d’endettement, 25 ans) qui encadrent ce que les banques peuvent accorder.',
    icon: 'bank',
  },
  fiscalite: {
    key: 'fiscalite',
    label: 'Fiscalité',
    title: 'La fiscalité de l’investissement locatif',
    description: 'Micro-foncier, régime réel, LMNP, déficit foncier, prélèvements sociaux, plus-values : la fiscalité immobilière française expliquée simplement.',
    tagline: 'Location nue ou meublée, régimes, plus-values.',
    intro:
      'Deux biens identiques peuvent rapporter très différemment selon leur régime fiscal. On compare ici location nue et meublée, micro et réel, amortissement et déficit foncier, avec les règles en vigueur et leurs dates : la fiscalité change souvent, chaque page indique quand elle a été vérifiée.',
    icon: 'receipt',
  },
  strategie: {
    key: 'strategie',
    label: 'Stratégie',
    title: 'Stratégies d’investissement immobilier',
    description: 'Rendement, cash-flow, effet de levier, colocation, immeuble de rapport : les grandes stratégies d’investissement locatif, leurs chiffres et leurs risques.',
    tagline: 'Rendement, cash-flow, levier et choix du bien.',
    intro:
      'Chercher du rendement, du cash-flow ou de la valorisation ne mène pas aux mêmes biens. Ces épisodes posent les chiffres au tableau pour comparer les stratégies (studio, colocation, immeuble de rapport, location meublée) sans jamais oublier les risques.',
    icon: 'target',
  },
  marche: {
    key: 'marche',
    label: 'Marché',
    title: 'Le marché immobilier en France',
    description: 'Prix, taux, loyers et transactions : lire le marché immobilier français avec les données publiques (INSEE, notaires, Banque de France), sans prédiction.',
    tagline: 'Prix, loyers, taux : lire les données publiques.',
    intro:
      'Pas de boule de cristal ici : on lit les séries publiques (indices de prix de l’INSEE et des notaires, taux de crédit de la Banque de France, loyers) pour comprendre où en est le marché et ce que ces chiffres veulent dire, et ne veulent pas dire.',
    icon: 'chart',
  },
  juridique: {
    key: 'juridique',
    label: 'Juridique',
    title: 'Le juridique de l’investisseur immobilier',
    description: 'Compromis de vente, bail, SCI, démembrement, copropriété : les règles juridiques à connaître avant d’acheter et de louer un bien immobilier en France.',
    tagline: 'Compromis, bail, SCI, démembrement.',
    intro:
      'Un investissement se joue aussi dans les contrats : avant-contrat, bail, statuts de SCI, règlement de copropriété. Ces épisodes expliquent les règles et les délais à connaître, à partir des textes officiels, pour savoir quelles questions poser à son notaire.',
    icon: 'scale',
  },
  travaux: {
    key: 'travaux',
    label: 'Travaux',
    title: 'Travaux, rénovation et DPE',
    description: 'DPE, passoires thermiques, rénovation énergétique, budget travaux et aides : ce que les travaux changent pour un investissement locatif en France.',
    tagline: 'DPE, rénovation énergétique, budget travaux.',
    intro:
      'Depuis le DPE opposable et le calendrier des passoires thermiques, les travaux ne sont plus une option pour beaucoup de bailleurs. On chiffre ici les rénovations, leur effet sur la location et sur l’impôt, et les pièges d’un budget sous-estimé.',
    icon: 'hammer',
  },
  location: {
    key: 'location',
    label: 'Location',
    title: 'Louer son bien : gestion et règles',
    description: 'Location nue ou meublée, colocation, meublé de tourisme, vacance et gestion locative : les règles et les chiffres pour louer un bien immobilier.',
    tagline: 'Nue, meublée, colocation, courte durée.',
    intro:
      'Le rendement d’un bien dépend de la façon dont il est loué. Ces épisodes comparent location vide, meublée, colocation et location de courte durée, avec leurs contraintes (bail, décence, encadrement, loi Le Meur) et leur effet sur la vacance et les charges.',
    icon: 'key',
  },
  patrimoine: {
    key: 'patrimoine',
    label: 'Patrimoine',
    title: 'L’immobilier dans un patrimoine',
    description: 'SCI, démembrement, nue-propriété, viager, transmission : la place de l’immobilier dans un patrimoine et les outils juridiques pour l’organiser.',
    tagline: 'Transmission, SCI, nue-propriété, viager.',
    intro:
      'Acheter, c’est aussi préparer la suite : détention en société, démembrement de propriété, nue-propriété, viager. Ces épisodes expliquent ces outils, ce qu’ils coûtent et ce qu’ils permettent, sans jamais remplacer le conseil d’un notaire.',
    icon: 'landmark',
  },
};

export const CATEGORY_LIST: Category[] = CATEGORY_KEYS.map((key) => CATEGORIES[key]);

export function categoryPath(key: CategoryKey): string {
  return `/categories/${key}/`;
}
