// Images de partage fixes (public/og/<nom>.jpg), générées par scripts/assets/build_og.py (npm run assets:og).
export const OG_IMAGES = ['default', 'episodes', 'outils', 'lexique', 'methode', 'credit', 'capacite', 'rendement', 'cashflow'] as const;
export type OgName = (typeof OG_IMAGES)[number];
