// Calculateur 3 : rendement locatif brut et net.
import type { FieldDef, ToolDefinition } from '../shared/fields.ts';
import { formulaLines, plainExplanation, resultTable, warningBox } from '../shared/html.ts';
import { formatEuro, formatNumber, formatPercent } from '../shared/numbers.ts';
import { computeYield, type YieldResult } from './logic.ts';

type Field = 'price' | 'fees' | 'works' | 'rent' | 'vacancyWeeks' | 'nonRecoverable' | 'propertyTax' | 'insurance' | 'management';

export const YIELD_FIELDS: readonly FieldDef<Field>[] = [
  { name: 'price', param: 'prix', label: 'Prix d’achat (net vendeur)', unit: '€', min: 1_000, max: 20_000_000, decimals: 0, default: 150_000 },
  { name: 'fees', param: 'frais', label: 'Frais d’achat (notaire, agence)', unit: '€', min: 0, max: 2_000_000, decimals: 0, default: 12_000, help: 'Dans l’ancien, les frais de notaire tournent autour de 7 à 8 % du prix.' },
  { name: 'works', param: 'travaux', label: 'Travaux et ameublement', unit: '€', min: 0, max: 10_000_000, decimals: 0, default: 0 },
  { name: 'rent', param: 'loyer', label: 'Loyer mensuel hors charges', unit: '€/mois', min: 1, max: 200_000, decimals: 0, default: 750 },
  { name: 'vacancyWeeks', param: 'vacance', label: 'Vacance locative', unit: 'semaines/an', min: 0, max: 26, decimals: 1, default: 2, help: 'Temps moyen sans locataire entre deux baux.' },
  { name: 'nonRecoverable', param: 'copro', label: 'Charges de copropriété non récupérables', unit: '€/an', min: 0, max: 200_000, decimals: 0, default: 400 },
  { name: 'propertyTax', param: 'tf', label: 'Taxe foncière', unit: '€/an', min: 0, max: 200_000, decimals: 0, default: 900 },
  { name: 'insurance', param: 'pno', label: 'Assurance propriétaire non occupant', unit: '€/an', min: 0, max: 50_000, decimals: 0, default: 120 },
  { name: 'management', param: 'gestion', label: 'Frais de gestion locative', unit: '%', min: 0, max: 30, decimals: 2, default: 0, help: 'En % des loyers encaissés (souvent 6 à 10 % TTC en agence). 0 si vous gérez vous-même.' },
];

export const yieldTool: ToolDefinition<Field, YieldResult> = {
  fields: YIELD_FIELDS,
  compute: (values) => computeYield(values),
  view(result, values) {
    const table = resultTable('Le tableau de votre rendement', [
      { label: 'Coût total de l’opération', value: formatEuro(result.totalCost), hint: 'prix + frais + travaux' },
      { label: 'Loyers annuels (12 mois)', value: formatEuro(result.annualRent) },
      { label: 'Rendement brut', value: formatPercent(result.gross), key: true, hint: 'sur le coût total' },
      { label: 'Loyers encaissés après vacance', value: formatEuro(result.collectedRent) },
      { label: 'Charges annuelles', value: formatEuro(result.charges), hint: 'copropriété, taxe foncière, assurance, gestion' },
      { label: 'Revenu net de charges', value: formatEuro(result.netIncome), hint: 'par an, avant impôt et crédit' },
      { label: 'Rendement net de charges', value: formatPercent(result.net), key: true },
    ]);
    const formula = formulaLines('Le calcul, ligne par ligne', [
      { formula: `Coût total = ${formatEuro(values.price)} + ${formatEuro(values.fees)} + ${formatEuro(values.works)}`, result: formatEuro(result.totalCost) },
      { formula: `Loyers annuels = ${formatEuro(values.rent)} × 12`, result: formatEuro(result.annualRent) },
      { formula: `Brut = ${formatEuro(result.annualRent)} ÷ ${formatEuro(result.totalCost)} × 100`, result: formatPercent(result.gross) },
      { formula: `Encaissés = ${formatEuro(result.annualRent)} × (1 − ${formatNumber(values.vacancyWeeks, 1)} ÷ 52)`, result: formatEuro(result.collectedRent) },
      {
        formula: `Charges = ${formatEuro(values.nonRecoverable)} + ${formatEuro(values.propertyTax)} + ${formatEuro(values.insurance)} + ${formatEuro(result.managementFees)}`,
        result: formatEuro(result.charges),
      },
      { formula: `Net = (${formatEuro(result.collectedRent)} − ${formatEuro(result.charges)}) ÷ ${formatEuro(result.totalCost)} × 100`, result: formatPercent(result.net) },
    ]);
    const warnings: string[] = [];
    if (result.netIncome < 0) warnings.push('Les charges dépassent les loyers encaissés : le bien perd de l’argent avant même le crédit et l’impôt.');
    const explanation = plainExplanation([
      `Pour ${formatEuro(result.totalCost)} investis, le bien rapporte ${formatEuro(result.annualRent)} de loyers par an : un rendement brut de ${formatPercent(result.gross)}. Calculé sur le seul prix d’achat, comme dans beaucoup d’annonces, il serait de ${formatPercent(result.grossOnPrice)} : c’est le chiffre le plus flatteur, pas le plus juste.`,
      `Une fois la vacance et les charges du propriétaire déduites, il reste ${formatEuro(result.netIncome)} par an, soit ${formatPercent(result.net)} net de charges. Ce rendement est calculé avant impôt et sans tenir compte du crédit : pour l’effet du prêt mois par mois, utilisez le calculateur de cash-flow.`,
    ]);
    return {
      summary: `Rendement brut : ${formatPercent(result.gross)}. Rendement net de charges : ${formatPercent(result.net)}.`,
      html: `${table}${warningBox(warnings)}${formula}${explanation}`,
    };
  },
};
