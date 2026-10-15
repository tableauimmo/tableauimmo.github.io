import { SITE } from '../../site.config.mjs';

const LONG_DATE = new Intl.DateTimeFormat(SITE.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const MONTH_YEAR = new Intl.DateTimeFormat(SITE.locale, { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

/** « 15 octobre 2026 », « 1er octobre 2026 » */
export function formatDate(date: Date): string {
  return LONG_DATE.format(date).replace(/^1 /, '1er ');
}

/** « octobre 2026 » */
export function formatMonth(date: Date): string {
  return MONTH_YEAR.format(date);
}

/** « 2026-10-15 » (attribut datetime, fuseau de Paris) */
export function isoDay(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(date);
}

/** Longueur au-delà de laquelle Google tronque généralement le titre. */
export const TITLE_MAX = 70;

/**
 * Titre de page : « Sujet | Tableau Immo ». La marque n'est ajoutée que si le titre reste lisible
 * en entier dans Google (sinon le sujet seul, la marque figurant déjà dans og:site_name).
 */
export function pageTitle(subject: string): string {
  if (subject.includes(SITE.name)) return subject;
  const branded = `${subject} | ${SITE.name}`;
  return branded.length <= TITLE_MAX ? branded : subject;
}

/** Première lettre d'un terme, sans accent (index alphabétique du lexique). */
export function initialOf(term: string): string {
  const letter = term.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : '#';
}

/** Comparaison alphabétique française (ignore accents et casse). */
export const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
