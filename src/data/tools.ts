// Les 4 calculateurs. Clé stable (ToolId) = valeur du champ « tools » des épisodes.
export const TOOL_IDS = ['credit', 'capacite', 'rendement', 'cashflow'] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolInfo {
  id: ToolId;
  slug: string;
  /** Nom court (cartes, menus) */
  name: string;
  /** Titre de la page (H1) */
  title: string;
  /** Description pour Google (70 à 160 caractères) */
  description: string;
  tagline: string;
  /** Formule résumée (cartes) */
  formula: string;
  icon: string;
  ogImage: string;
}

export const TOOLS: Record<ToolId, ToolInfo> = {
  credit: {
    id: 'credit',
    slug: 'mensualite-credit-immobilier',
    name: 'Mensualité de crédit',
    title: 'Calculateur de mensualité de crédit immobilier',
    description: 'Calculez la mensualité d’un crédit immobilier, son coût total (intérêts et assurance) et le tableau d’amortissement année par année. Gratuit, sans inscription.',
    tagline: 'Mensualité, coût total et tableau d’amortissement.',
    formula: 'M = C × t ÷ (1 − (1 + t)⁻ⁿ)',
    icon: 'calculator',
    ogImage: 'credit',
  },
  capacite: {
    id: 'capacite',
    slug: 'capacite-emprunt',
    name: 'Capacité d’emprunt',
    title: 'Calculateur de capacité d’emprunt (règle des 35 %)',
    description: 'Estimez combien vous pouvez emprunter avec la règle du HCSF : 35 % d’endettement maximum assurance incluse, sur 25 ans au plus. Calcul détaillé et expliqué.',
    tagline: 'Le montant empruntable avec la règle des 35 %.',
    formula: 'Mensualité max = 35 % × revenus − crédits en cours',
    icon: 'bank',
    ogImage: 'capacite',
  },
  rendement: {
    id: 'rendement',
    slug: 'rendement-locatif',
    name: 'Rendement locatif',
    title: 'Calculateur de rendement locatif brut et net',
    description: 'Calculez le rendement locatif brut et net d’un bien : loyers, frais d’achat, travaux, charges, taxe foncière, vacance et gestion. Formules affichées.',
    tagline: 'Rendement brut et net de charges, formules à l’appui.',
    formula: 'Brut = loyers annuels ÷ coût total × 100',
    icon: 'percent',
    ogImage: 'rendement',
  },
  cashflow: {
    id: 'cashflow',
    slug: 'cash-flow-immobilier',
    name: 'Cash-flow mensuel',
    title: 'Calculateur de cash-flow immobilier (avant impôt)',
    description: 'Calculez le cash-flow mensuel d’un investissement locatif avant impôt : loyer, vacance, mensualité de crédit, charges, taxe foncière et gestion.',
    tagline: 'Ce qui reste (ou manque) chaque mois, avant impôt.',
    formula: 'Cash-flow = loyer encaissé − crédit − charges',
    icon: 'coins',
    ogImage: 'cashflow',
  },
};

export const TOOL_LIST: ToolInfo[] = TOOL_IDS.map((id) => TOOLS[id]);

export function toolPath(id: ToolId): string {
  return `/outils/${TOOLS[id].slug}/`;
}
