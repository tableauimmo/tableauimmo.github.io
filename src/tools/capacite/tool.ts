// Calculateur 2 : capacité d'emprunt (règle des 35 % du HCSF).
import type { FieldDef, ToolDefinition } from '../shared/fields.ts';
import { formulaLines, plainExplanation, resultTable, warningBox } from '../shared/html.ts';
import { formatEuro, formatNumber, formatPercent } from '../shared/numbers.ts';
import { computeCapacity, RENT_RETAINED, type CapacityResult } from './logic.ts';

type Field = 'income' | 'rents' | 'otherLoans' | 'rate' | 'years' | 'insurance' | 'maxRatio';

export const CAPACITY_FIELDS: readonly FieldDef<Field>[] = [
  { name: 'income', param: 'revenus', label: 'Revenus nets mensuels du foyer (avant impôt)', unit: '€/mois', min: 0, max: 200_000, decimals: 0, default: 4_000, help: 'Salaires et revenus réguliers, nets de cotisations, avant prélèvement à la source.' },
  { name: 'rents', param: 'loyers', label: 'Loyers déjà perçus (bruts)', unit: '€/mois', min: 0, max: 200_000, decimals: 0, default: 0, help: `Retenus à ${RENT_RETAINED * 100} %, comme le font la plupart des banques.` },
  { name: 'otherLoans', param: 'credits', label: 'Mensualités des crédits en cours', unit: '€/mois', min: 0, max: 100_000, decimals: 0, default: 0 },
  { name: 'rate', param: 'taux', label: 'Taux nominal annuel du nouveau prêt', unit: '%', min: 0, max: 15, decimals: 3, default: 3.5 },
  { name: 'years', param: 'duree', label: 'Durée du nouveau prêt', unit: 'ans', min: 5, max: 27, decimals: 0, default: 25, help: '25 ans au plus selon le HCSF (27 ans avec un différé).' },
  { name: 'insurance', param: 'assurance', label: 'Assurance emprunteur (taux annuel)', unit: '%', min: 0, max: 2, decimals: 3, default: 0.3 },
  { name: 'maxRatio', param: 'endettement', label: 'Taux d’endettement maximal', unit: '%', min: 10, max: 50, decimals: 1, default: 35, help: '35 % assurance comprise : la règle du HCSF.' },
];

export const capacityTool: ToolDefinition<Field, CapacityResult> = {
  fields: CAPACITY_FIELDS,
  compute: (values) => computeCapacity(values),
  check(values) {
    return values.income + values.rents > 0 ? [] : [{ field: 'income', message: 'Indiquez des revenus pour calculer une capacité d’emprunt.' }];
  },
  view(result, values) {
    const table = resultTable('Le tableau de votre capacité', [
      { label: 'Revenus retenus', value: formatEuro(result.retainedIncome), hint: values.rents > 0 ? `revenus + ${RENT_RETAINED * 100} % des loyers` : 'par mois' },
      { label: `Mensualités maximales (${formatNumber(values.maxRatio, 1)} %)`, value: formatEuro(result.maxDebtService, 2) },
      { label: 'Disponible pour le nouveau prêt', value: formatEuro(result.availablePayment, 2), hint: 'assurance comprise, après crédits en cours' },
      { label: 'Capital empruntable', value: formatEuro(Math.floor(result.capital / 100) * 100), key: true, hint: 'arrondi à la centaine inférieure' },
      { label: 'Dont mensualité hors assurance', value: formatEuro(result.loanPayment, 2) },
      { label: 'Dont assurance', value: formatEuro(result.monthlyInsurance, 2) },
      { label: 'Coût total du crédit', value: formatEuro(result.totalCost), hint: 'intérêts + assurance' },
      { label: 'Reste à vivre', value: formatEuro(result.remainingIncome), hint: 'revenus retenus − toutes les mensualités' },
    ]);
    const formula = formulaLines('Le calcul, ligne par ligne', [
      {
        formula: values.rents > 0 ? `Revenus retenus = ${formatEuro(values.income)} + ${RENT_RETAINED * 100} % × ${formatEuro(values.rents)}` : `Revenus retenus = ${formatEuro(values.income)}`,
        result: formatEuro(result.retainedIncome),
      },
      { formula: `Mensualités max = ${formatEuro(result.retainedIncome)} × ${formatNumber(values.maxRatio, 1)} %`, result: formatEuro(result.maxDebtService, 2) },
      { formula: `Disponible = ${formatEuro(result.maxDebtService, 2)} − ${formatEuro(values.otherLoans)}`, result: formatEuro(result.availablePayment, 2) },
      {
        formula: `Capital = disponible ÷ (t ÷ (1 − (1 + t)^−${result.months}) + ${formatNumber(values.insurance, 3)} % ÷ 12)`,
        result: formatEuro(result.capital),
      },
    ]);
    const explanation = plainExplanation([
      result.capital > 0
        ? `Avec ces revenus, la règle des ${formatNumber(values.maxRatio, 1)} % laisse ${formatEuro(result.availablePayment, 2)} par mois pour un nouveau crédit, assurance comprise. Sur ${values.years} ans à ${formatPercent(values.rate, 2)}, cette mensualité finance environ ${formatEuro(Math.floor(result.capital / 100) * 100)}.`
        : 'Avec ces chiffres, la règle d’endettement ne laisse aucune place pour un nouveau crédit.',
      'C’est un plafond réglementaire, pas un montant accordé : la banque regarde aussi l’apport, le reste à vivre, la stabilité des revenus, la gestion des comptes et le projet lui-même.',
    ]);
    return {
      summary: `Capacité d’emprunt estimée : ${formatEuro(Math.floor(result.capital / 100) * 100)} pour une mensualité de ${formatEuro(result.availablePayment, 2)} assurance comprise.`,
      html: `${table}${warningBox(result.warnings)}${formula}${explanation}`,
    };
  },
};
