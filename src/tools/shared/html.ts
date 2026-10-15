// Petits gabarits HTML communs aux résultats des calculateurs (« le tableau » des résultats).
import { escapeHtml } from './numbers.ts';

export interface ResultRow {
  label: string;
  value: string;
  /** Ligne mise en avant (chiffre clé en jaune craie) */
  key?: boolean;
  /** Précision sous le libellé */
  hint?: string;
}

export function resultTable(caption: string, rows: ResultRow[]): string {
  const body = rows
    .map(
      (row) =>
        `<tr${row.key ? ' class="is-key"' : ''}><th scope="row">${escapeHtml(row.label)}${row.hint ? `<small>${escapeHtml(row.hint)}</small>` : ''}</th><td>${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  return `<table class="result-table"><caption>${escapeHtml(caption)}</caption><tbody>${body}</tbody></table>`;
}

/** Lignes de calcul « à la craie » : formule littérale puis valeurs substituées. */
export function formulaLines(title: string, lines: { formula: string; result?: string }[]): string {
  const items = lines
    .map((line) => `<li><span class="formula__expr">${escapeHtml(line.formula)}</span>${line.result ? ` <span class="formula__result">= ${escapeHtml(line.result)}</span>` : ''}</li>`)
    .join('');
  return `<div class="formula"><p class="formula__title">${escapeHtml(title)}</p><ol>${items}</ol></div>`;
}

export function plainExplanation(paragraphs: string[]): string {
  return `<div class="plain">${paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('')}</div>`;
}

export function warningBox(messages: string[]): string {
  if (!messages.length) return '';
  return `<div class="tool-warning" role="note"><p><strong>À noter</strong></p><ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul></div>`;
}
