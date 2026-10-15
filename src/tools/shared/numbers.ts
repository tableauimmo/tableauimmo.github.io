// Nombres « à la française » : lecture tolérante des saisies et affichage normalisé.
// Séparateur de milliers : espace fine insécable (U+202F) ; virgule décimale ; espace insécable avant € et %.

const NBSP = ' ';

const formatters = new Map<number, Intl.NumberFormat>();

function formatter(decimals: number): Intl.NumberFormat {
  let format = formatters.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, format);
  }
  return format;
}

/** 1159.916 → « 1 159,92 » (2 décimales) ; −0 est affiché « 0 ». */
export function formatNumber(value: number, decimals = 0): string {
  const rounded = Number(value.toFixed(decimals));
  return formatter(decimals).format(Object.is(rounded, -0) ? 0 : rounded);
}

/** « 1 159,92 € » */
export function formatEuro(value: number, decimals = 0): string {
  return `${formatNumber(value, decimals)}${NBSP}€`;
}

/** Montant signé : « +15 € », « −120 € » (vrai signe moins). */
export function formatSignedEuro(value: number, decimals = 0): string {
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return formatEuro(0, decimals);
  return `${rounded > 0 ? '+' : '−'}${formatEuro(Math.abs(rounded), decimals)}`;
}

/** 5.5555 → « 5,56 % » (valeur déjà exprimée en pourcentage). */
export function formatPercent(value: number, decimals = 2): string {
  return `${formatNumber(value, decimals)}${NBSP}%`;
}

/** Remplace les espaces typographiques par des espaces simples (comparaisons, tests). */
export function plainSpaces(text: string): string {
  return text.replace(/[   ]/g, ' ');
}

/**
 * Lit un nombre saisi : « 200 000 », « 200000 », « 3,5 », « 3.5 », « 1 200,50 € », « 3,5 % », « 1.200,50 ».
 * Renvoie null si la saisie n'est pas un nombre.
 */
export function parseFrenchNumber(input: string): number | null {
  let text = input.trim().replace(/[\s   ]/g, '').replace(/[€%]$/, '').replace(/^\+/, '');
  text = text.replace(/^[−–]/, '-');
  if (text === '' || text === '-') return null;
  if (text.includes(',')) {
    // Virgule décimale : les points éventuels sont des séparateurs de milliers.
    if ((text.match(/,/g) ?? []).length > 1) return null;
    text = text.replace(/\./g, '').replace(',', '.');
  } else if ((text.match(/\./g) ?? []).length > 1) {
    // « 1.200.000 » : points de milliers.
    text = text.replace(/\./g, '');
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Nombre de décimales d'une valeur saisie (après lecture). */
export function decimalsOf(value: number): number {
  const text = String(value);
  if (text.includes('e-')) return Number(text.split('e-')[1]);
  return text.includes('.') ? (text.split('.')[1]?.length ?? 0) : 0;
}

/** Échappement HTML (les résultats des calculateurs sont insérés en HTML). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
