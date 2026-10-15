// Calculateur 1 : mensualité, coût total et tableau d'amortissement annuel.
import type { FieldDef, ToolDefinition } from '../shared/fields.ts';
import { formulaLines, plainExplanation, resultTable } from '../shared/html.ts';
import { formatEuro, formatNumber, formatPercent } from '../shared/numbers.ts';
import { computeLoan, type LoanResult } from './logic.ts';

type Field = 'capital' | 'rate' | 'years' | 'insurance';

export const CREDIT_FIELDS: readonly FieldDef<Field>[] = [
  { name: 'capital', param: 'montant', label: 'Montant emprunté', unit: '€', min: 1_000, max: 5_000_000, decimals: 0, default: 200_000 },
  { name: 'rate', param: 'taux', label: 'Taux nominal annuel (hors assurance)', unit: '%', min: 0, max: 15, decimals: 3, default: 3.5, help: 'Le taux du prêt, sans l’assurance (TAEG non compris).' },
  { name: 'years', param: 'duree', label: 'Durée du prêt', unit: 'ans', min: 1, max: 30, decimals: 0, default: 20 },
  {
    name: 'insurance',
    param: 'assurance',
    label: 'Assurance emprunteur (taux annuel)',
    unit: '%',
    min: 0,
    max: 2,
    decimals: 3,
    default: 0.3,
    help: 'En % du capital emprunté par an (ex. 0,30). Mettez 0 pour l’ignorer.',
  },
];

function scheduleTable(result: LoanResult): string {
  const rows = result.schedule
    .map(
      (year) =>
        `<tr><th scope="row">${year.year}</th><td>${formatEuro(year.interest)}</td><td>${formatEuro(year.principal)}</td><td>${formatEuro(year.insurance)}</td><td>${formatEuro(year.remaining)}</td></tr>`,
    )
    .join('');
  return `<div class="schedule">
  <h3 class="schedule__title" id="amortissement">Tableau d’amortissement annuel</h3>
  <div class="table-scroll" tabindex="0" role="region" aria-labelledby="amortissement">
    <table class="schedule__table">
      <thead><tr><th scope="col">Année</th><th scope="col">Intérêts</th><th scope="col">Capital remboursé</th><th scope="col">Assurance</th><th scope="col">Capital restant dû</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">Total</th><td>${formatEuro(result.totalInterest)}</td><td>${formatEuro(result.schedule.reduce((sum, year) => sum + year.principal, 0))}</td><td>${formatEuro(result.totalInsurance)}</td><td>—</td></tr></tfoot>
    </table>
  </div>
</div>`;
}

export const creditTool: ToolDefinition<Field, LoanResult> = {
  fields: CREDIT_FIELDS,
  compute: (values) => computeLoan(values),
  view(result, values) {
    const periodicRate = result.monthlyRate * 100;
    const firstYear = result.schedule[0];
    const interestShare = firstYear ? (firstYear.interest / (firstYear.interest + firstYear.principal)) * 100 : 0;
    const table = resultTable('Le tableau de votre crédit', [
      { label: 'Mensualité hors assurance', value: formatEuro(result.payment, 2) },
      { label: 'Assurance par mois', value: formatEuro(result.monthlyInsurance, 2) },
      { label: 'Mensualité assurance comprise', value: formatEuro(result.monthlyTotal, 2), key: true },
      { label: 'Coût des intérêts', value: formatEuro(result.totalInterest) },
      { label: 'Coût de l’assurance', value: formatEuro(result.totalInsurance) },
      { label: 'Coût total du crédit', value: formatEuro(result.totalCost), key: true, hint: 'intérêts + assurance' },
      { label: 'Total remboursé', value: formatEuro(result.totalRepaid), hint: 'capital + coût du crédit' },
    ]);
    const formula = formulaLines('Le calcul, ligne par ligne', [
      { formula: `Taux mensuel t = ${formatNumber(values.rate, 3)} % ÷ 12`, result: formatPercent(periodicRate, 4) },
      { formula: `Nombre de mensualités n = ${values.years} × 12`, result: String(result.months) },
      {
        formula:
          values.rate === 0
            ? `Mensualité = ${formatEuro(values.capital)} ÷ ${result.months}`
            : `Mensualité = ${formatEuro(values.capital)} × t ÷ (1 − (1 + t)^−${result.months})`,
        result: formatEuro(result.payment, 2),
      },
      { formula: `Assurance = ${formatEuro(values.capital)} × ${formatNumber(values.insurance, 3)} % ÷ 12`, result: formatEuro(result.monthlyInsurance, 2) },
      { formula: `Intérêts = mensualité × ${result.months} − ${formatEuro(values.capital)}`, result: formatEuro(result.totalInterest) },
    ]);
    const explanation = plainExplanation([
      `En empruntant ${formatEuro(values.capital)} sur ${values.years} ans à ${formatPercent(values.rate, 2)}, vous remboursez ${formatEuro(result.monthlyTotal, 2)} par mois assurance comprise, pendant ${result.months} mois.`,
      `Le crédit vous coûte ${formatEuro(result.totalCost)} au total, soit ${formatPercent((result.totalCost / values.capital) * 100, 1)} du montant emprunté. La première année, ${formatPercent(interestShare, 0)} de vos mensualités (hors assurance) servent à payer des intérêts : c’est normal, les intérêts sont calculés sur le capital restant dû, qui est maximal au début.`,
    ]);
    return {
      summary: `Mensualité assurance comprise : ${formatEuro(result.monthlyTotal, 2)} par mois. Coût total du crédit : ${formatEuro(result.totalCost)}.`,
      html: `${table}${formula}${explanation}${scheduleTable(result)}`,
    };
  },
};

