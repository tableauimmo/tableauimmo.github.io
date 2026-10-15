// Champs des calculateurs : définition, valeurs par défaut et validation (messages en français).
import { decimalsOf, formatNumber, parseFrenchNumber } from './numbers.ts';

export interface FieldDef<K extends string = string> {
  name: K;
  label: string;
  unit: '€' | '€/mois' | '€/an' | '%' | 'ans' | 'semaines/an';
  min: number;
  max: number;
  /** Nombre maximal de décimales acceptées */
  decimals: number;
  default: number;
  help?: string;
  /** Paramètre court dans l'adresse (lien partageable) */
  param: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export type Values<K extends string> = Record<K, number>;

export type ParseResult<K extends string> = { ok: true; values: Values<K> } | { ok: false; errors: FieldError[] };

function unitSuffix(unit: FieldDef['unit']): string {
  return unit === 'ans' || unit === 'semaines/an' ? ` ${unit}` : ` ${unit}`;
}

/** Valide toutes les saisies (texte brut) d'un calculateur. */
export function parseFields<K extends string>(fields: readonly FieldDef<K>[], raw: Partial<Record<K, string>>): ParseResult<K> {
  const errors: FieldError[] = [];
  const values = {} as Values<K>;
  for (const field of fields) {
    const text = raw[field.name] ?? '';
    if (text.trim() === '') {
      errors.push({ field: field.name, message: 'Ce champ est obligatoire.' });
      continue;
    }
    const value = parseFrenchNumber(text);
    if (value === null) {
      errors.push({ field: field.name, message: 'Indiquez un nombre, par exemple 1 250 ou 3,5.' });
      continue;
    }
    if (decimalsOf(value) > field.decimals) {
      errors.push({
        field: field.name,
        message: field.decimals === 0 ? 'Indiquez un nombre entier.' : `${field.decimals} décimale${field.decimals > 1 ? 's' : ''} au maximum.`,
      });
      continue;
    }
    if (value < field.min) {
      errors.push({ field: field.name, message: `Minimum : ${formatNumber(field.min, decimalsOf(field.min))}${unitSuffix(field.unit)}.` });
      continue;
    }
    if (value > field.max) {
      errors.push({ field: field.name, message: `Maximum : ${formatNumber(field.max, decimalsOf(field.max))}${unitSuffix(field.unit)}.` });
      continue;
    }
    values[field.name] = value;
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

export function defaultValues<K extends string>(fields: readonly FieldDef<K>[]): Values<K> {
  return Object.fromEntries(fields.map((field) => [field.name, field.default])) as Values<K>;
}

/** Valeur affichée dans un champ (« 200 000 », « 3,5 »). */
export function displayValue(field: FieldDef, value: number): string {
  return formatNumber(value, Math.min(field.decimals, decimalsOf(value)));
}

export interface ToolResultView {
  /** Phrase courte annoncée aux lecteurs d'écran (zone aria-live) */
  summary: string;
  /** Tableau de résultats, formules et explication (HTML sûr : uniquement des nombres formatés et des textes fixes) */
  html: string;
}

export interface ToolDefinition<K extends string, R> {
  fields: readonly FieldDef<K>[];
  compute(values: Values<K>): R;
  /** Contrôles croisés entre champs (après la validation de chaque champ) */
  check?(values: Values<K>): FieldError[];
  view(result: R, values: Values<K>): ToolResultView;
}

/** Validation complète + calcul. */
export function runTool<K extends string, R>(tool: ToolDefinition<K, R>, raw: Partial<Record<K, string>>): { ok: true; result: R; values: Values<K> } | { ok: false; errors: FieldError[] } {
  const parsed = parseFields(tool.fields, raw);
  if (!parsed.ok) return parsed;
  const crossErrors = tool.check?.(parsed.values) ?? [];
  if (crossErrors.length) return { ok: false, errors: crossErrors };
  return { ok: true, values: parsed.values, result: tool.compute(parsed.values) };
}
