// Calculateur 4 : cash-flow mensuel avant impôt.
import type { FieldDef, ToolDefinition } from '../shared/fields.ts';
import { formulaLines, plainExplanation, resultTable } from '../shared/html.ts';
import { formatEuro, formatNumber, formatSignedEuro } from '../shared/numbers.ts';
import { computeCashflow, type CashflowResult } from './logic.ts';

type Field = 'rent' | 'vacancyWeeks' | 'loanPayment' | 'coproCharges' | 'propertyTax' | 'insurance' | 'management' | 'maintenance';

export const CASHFLOW_FIELDS: readonly FieldDef<Field>[] = [
  { name: 'rent', param: 'loyer', label: 'Loyer mensuel hors charges', unit: '€/mois', min: 0, max: 200_000, decimals: 0, default: 750 },
  { name: 'vacancyWeeks', param: 'vacance', label: 'Vacance locative', unit: 'semaines/an', min: 0, max: 26, decimals: 1, default: 2 },
  {
    name: 'loanPayment',
    param: 'credit',
    label: 'Mensualité du crédit (assurance comprise)',
    unit: '€/mois',
    min: 0,
    max: 100_000,
    decimals: 2,
    default: 690,
    help: 'À calculer avec le calculateur de mensualité. 0 si vous achetez comptant.',
  },
  { name: 'coproCharges', param: 'copro', label: 'Charges de copropriété non récupérables', unit: '€/mois', min: 0, max: 20_000, decimals: 0, default: 35 },
  { name: 'propertyTax', param: 'tf', label: 'Taxe foncière', unit: '€/an', min: 0, max: 200_000, decimals: 0, default: 900 },
  { name: 'insurance', param: 'pno', label: 'Assurance propriétaire non occupant', unit: '€/an', min: 0, max: 50_000, decimals: 0, default: 120 },
  { name: 'management', param: 'gestion', label: 'Frais de gestion locative', unit: '%', min: 0, max: 30, decimals: 2, default: 0 },
  { name: 'maintenance', param: 'entretien', label: 'Provision entretien et petits travaux', unit: '€/mois', min: 0, max: 20_000, decimals: 0, default: 20 },
];

export const cashflowTool: ToolDefinition<Field, CashflowResult> = {
  fields: CASHFLOW_FIELDS,
  compute: (values) => computeCashflow(values),
  view(result, values) {
    const positive = result.monthly >= 0;
    const table = resultTable('Le tableau de votre cash-flow', [
      { label: 'Loyer encaissé (moyenne mensuelle)', value: formatEuro(result.collectedRent, 2), hint: 'vacance déduite' },
      { label: 'Mensualité du crédit', value: formatSignedEuro(-values.loanPayment, 2) },
      { label: 'Charges de copropriété', value: formatSignedEuro(-values.coproCharges, 2) },
      { label: 'Taxe foncière et assurance', value: formatSignedEuro(-result.annualChargesMonthly, 2), hint: 'montants annuels ÷ 12' },
      { label: 'Gestion locative', value: formatSignedEuro(-result.managementFees, 2) },
      { label: 'Provision entretien', value: formatSignedEuro(-values.maintenance, 2) },
      { label: 'Cash-flow mensuel avant impôt', value: formatSignedEuro(result.monthly, 2), key: true },
      { label: 'Sur un an', value: formatSignedEuro(result.annual) },
    ]);
    const formula = formulaLines('Le calcul, ligne par ligne', [
      { formula: `Loyer encaissé = ${formatEuro(values.rent)} × (1 − ${formatNumber(values.vacancyWeeks, 1)} ÷ 52)`, result: formatEuro(result.collectedRent, 2) },
      { formula: `Taxe foncière + assurance = (${formatEuro(values.propertyTax)} + ${formatEuro(values.insurance)}) ÷ 12`, result: formatEuro(result.annualChargesMonthly, 2) },
      { formula: `Gestion = ${formatEuro(result.collectedRent, 2)} × ${formatNumber(values.management, 2)} %`, result: formatEuro(result.managementFees, 2) },
      {
        formula: `Cash-flow = ${formatEuro(result.collectedRent, 2)} − ${formatEuro(values.loanPayment, 2)} − ${formatEuro(result.charges, 2)}`,
        result: formatSignedEuro(result.monthly, 2),
      },
    ]);
    const explanation = plainExplanation([
      positive
        ? `Chaque mois, en moyenne, le bien rapporte ${formatEuro(result.monthly, 2)} de plus qu’il ne coûte, avant impôt : il se finance seul et dégage ${formatEuro(result.annual)} par an.`
        : `Chaque mois, en moyenne, il manque ${formatEuro(-result.monthly, 2)} : c’est l’« effort d’épargne » à prévoir, soit ${formatEuro(-result.annual)} par an, avant impôt.`,
      'Ce cash-flow est calculé avant impôt : selon le régime fiscal (micro-foncier, réel, LMNP…), l’impôt et les prélèvements sociaux peuvent le réduire, ou presque rien lui retirer. Le remboursement du capital, compris dans la mensualité, constitue en revanche une épargne.',
    ]);
    return {
      summary: `Cash-flow mensuel avant impôt : ${formatSignedEuro(result.monthly, 2)}.`,
      html: `${table}${formula}${explanation}`,
    };
  },
};
