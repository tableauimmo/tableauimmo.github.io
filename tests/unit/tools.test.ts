import { describe, expect, it } from 'vitest';
import { computeCapacity } from '../../src/tools/capacite/logic.ts';
import { capacityTool, CAPACITY_FIELDS } from '../../src/tools/capacite/tool.ts';
import { computeCashflow } from '../../src/tools/cashflow/logic.ts';
import { cashflowTool, CASHFLOW_FIELDS } from '../../src/tools/cashflow/tool.ts';
import { annuityFactor, computeLoan, monthlyPayment } from '../../src/tools/credit/logic.ts';
import { creditTool, CREDIT_FIELDS } from '../../src/tools/credit/tool.ts';
import { computeYield } from '../../src/tools/rendement/logic.ts';
import { yieldTool, YIELD_FIELDS } from '../../src/tools/rendement/tool.ts';
import { defaultValues, displayValue, parseFields, runTool } from '../../src/tools/shared/fields.ts';
import { plainSpaces } from '../../src/tools/shared/numbers.ts';

const cents = (value: number) => Math.round(value * 100) / 100;

describe('crédit immobilier', () => {
  it('mensualité de référence : 200 000 € sur 20 ans à 3,5 %', () => {
    const loan = computeLoan({ capital: 200_000, rate: 3.5, years: 20, insurance: 0.3 });
    expect(cents(loan.payment)).toBe(1159.92);
    expect(cents(loan.monthlyInsurance)).toBe(50);
    expect(cents(loan.monthlyTotal)).toBe(1209.92);
    expect(loan.months).toBe(240);
    expect(Math.round(loan.totalInterest)).toBe(78_381);
    expect(Math.round(loan.totalInsurance)).toBe(12_000);
    expect(Math.round(loan.totalCost)).toBe(90_381);
  });

  it('le tableau d’amortissement rembourse exactement le capital', () => {
    const loan = computeLoan({ capital: 150_000, rate: 4.1, years: 25, insurance: 0 });
    expect(loan.schedule).toHaveLength(25);
    const principal = loan.schedule.reduce((sum, year) => sum + year.principal, 0);
    expect(principal).toBeCloseTo(150_000, 6);
    expect(loan.schedule.at(-1)?.remaining).toBe(0);
    // Intérêts décroissants, capital remboursé croissant.
    expect(loan.schedule[0]!.interest).toBeGreaterThan(loan.schedule[1]!.interest);
    expect(loan.schedule[0]!.principal).toBeLessThan(loan.schedule[1]!.principal);
    expect(loan.totalInterest).toBeCloseTo(loan.payment * loan.months - 150_000, 6);
  });

  it('taux nul : capital ÷ nombre de mois', () => {
    expect(monthlyPayment(120_000, 0, 120)).toBe(1000);
    expect(computeLoan({ capital: 120_000, rate: 0, years: 10, insurance: 0 }).totalInterest).toBeCloseTo(0, 9);
    expect(annuityFactor(0, 240)).toBeCloseTo(1 / 240, 12);
  });

  it('résultat lisible, avec la formule et le tableau d’amortissement', () => {
    const outcome = runTool(creditTool, { capital: '200 000', rate: '3,5', years: '20', insurance: '0,30' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const view = creditTool.view(outcome.result, outcome.values);
    expect(plainSpaces(view.summary)).toBe('Mensualité assurance comprise : 1 209,92 € par mois. Coût total du crédit : 90 381 €.');
    expect(plainSpaces(view.html)).toContain('Mensualité hors assurance</th><td>1 159,92 €');
    expect(view.html).toContain('Tableau d’amortissement annuel');
    expect(view.html.match(/<tr><th scope="row">\d+<\/th>/g)).toHaveLength(20);
  });
});

describe('capacité d’emprunt (HCSF)', () => {
  it('35 % de 4 000 € : 1 400 € de mensualité, environ 266 350 € sur 25 ans', () => {
    const result = computeCapacity({ income: 4000, rents: 0, otherLoans: 0, rate: 3.5, years: 25, insurance: 0.3, maxRatio: 35 });
    expect(result.maxDebtService).toBe(1400);
    expect(Math.round(result.capital)).toBe(266_350);
    // Le capital trouvé redonne bien la mensualité disponible, assurance comprise.
    const loan = computeLoan({ capital: result.capital, rate: 3.5, years: 25, insurance: 0.3 });
    expect(loan.monthlyTotal).toBeCloseTo(1400, 6);
    expect(result.warnings).toEqual([]);
  });

  it('retient 70 % des loyers et déduit les crédits en cours', () => {
    const result = computeCapacity({ income: 3000, rents: 1000, otherLoans: 300, rate: 3.5, years: 20, insurance: 0, maxRatio: 35 });
    expect(result.retainedIncome).toBe(3700);
    expect(result.maxDebtService).toBeCloseTo(1295, 9);
    expect(result.availablePayment).toBeCloseTo(995, 9);
    expect(result.remainingIncome).toBeCloseTo(2405, 9);
  });

  it('signale les situations hors règle', () => {
    const blocked = computeCapacity({ income: 2000, rents: 0, otherLoans: 800, rate: 3.5, years: 27, insurance: 0.3, maxRatio: 40 });
    expect(blocked.capital).toBe(0);
    expect(blocked.warnings).toHaveLength(3);
    expect(runTool(capacityTool, { income: '0', rents: '0', otherLoans: '0', rate: '3', years: '25', insurance: '0', maxRatio: '35' })).toMatchObject({ ok: false });
  });
});

describe('rendement locatif', () => {
  it('studio à 150 000 € : 5,56 % brut, 6 % sur le prix seul, 4,47 % net de charges', () => {
    const result = computeYield({ price: 150_000, fees: 12_000, works: 0, rent: 750, vacancyWeeks: 2, nonRecoverable: 400, propertyTax: 900, insurance: 120, management: 0 });
    expect(result.totalCost).toBe(162_000);
    expect(result.annualRent).toBe(9000);
    expect(result.gross.toFixed(2)).toBe('5.56');
    expect(result.grossOnPrice).toBe(6);
    expect(Math.round(result.collectedRent)).toBe(8654);
    expect(result.charges).toBe(1420);
    expect(result.net.toFixed(2)).toBe('4.47');
  });

  it('frais de gestion calculés sur les loyers encaissés', () => {
    const result = computeYield({ price: 100_000, fees: 0, works: 0, rent: 500, vacancyWeeks: 0, nonRecoverable: 0, propertyTax: 0, insurance: 0, management: 8 });
    expect(result.managementFees).toBeCloseTo(480, 9);
    expect(result.net).toBeCloseTo(5.52, 9);
  });
});

describe('cash-flow', () => {
  it('loyer − crédit − charges, ramené au mois', () => {
    const result = computeCashflow({ rent: 800, vacancyWeeks: 0, loanPayment: 650, coproCharges: 50, propertyTax: 900, insurance: 120, management: 0, maintenance: 0 });
    expect(result.annualChargesMonthly).toBe(85);
    expect(result.monthly).toBe(15);
    expect(result.annual).toBe(180);
  });

  it('effort d’épargne quand le cash-flow est négatif', () => {
    const outcome = runTool(cashflowTool, { rent: '750', vacancyWeeks: '2', loanPayment: '690', coproCharges: '35', propertyTax: '900', insurance: '120', management: '0', maintenance: '20' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(cents(outcome.result.monthly)).toBe(-108.85);
    expect(plainSpaces(cashflowTool.view(outcome.result, outcome.values).summary)).toBe('Cash-flow mensuel avant impôt : −108,85 €.');
  });
});

describe('saisie et validation', () => {
  it('accepte les nombres à la française', () => {
    const parsed = parseFields(CREDIT_FIELDS, { capital: '250 000 €', rate: '3.45', years: '25', insurance: '0,3 %' });
    expect(parsed).toEqual({ ok: true, values: { capital: 250_000, rate: 3.45, years: 25, insurance: 0.3 } });
  });

  it('signale chaque champ invalide en français', () => {
    const parsed = parseFields(CREDIT_FIELDS, { capital: '', rate: 'abc', years: '20,5', insurance: '5' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual([
      { field: 'capital', message: 'Ce champ est obligatoire.' },
      { field: 'rate', message: 'Indiquez un nombre, par exemple 1 250 ou 3,5.' },
      { field: 'years', message: 'Indiquez un nombre entier.' },
      { field: 'insurance', message: 'Maximum : 2 %.' },
    ]);
    const tooSmall = parseFields(CREDIT_FIELDS, { capital: '500', rate: '3', years: '20', insurance: '0' });
    expect(tooSmall.ok ? [] : tooSmall.errors.map((error) => plainSpaces(error.message))).toEqual(['Minimum : 1 000 €.']);
  });

  it.each([
    ['crédit', creditTool, CREDIT_FIELDS],
    ['capacité', capacityTool, CAPACITY_FIELDS],
    ['rendement', yieldTool, YIELD_FIELDS],
    ['cash-flow', cashflowTool, CASHFLOW_FIELDS],
  ] as const)('les valeurs d’exemple du calculateur %s sont valides et affichables', (_name, tool, fields) => {
    const raw = Object.fromEntries(fields.map((field) => [field.name, displayValue(field, field.default)]));
    const outcome = runTool(tool as never, raw);
    expect(outcome.ok).toBe(true);
    expect(Object.keys(defaultValues(fields))).toHaveLength(fields.length);
    // Paramètres d'adresse uniques (liens partageables).
    expect(new Set(fields.map((field) => field.param)).size).toBe(fields.length);
  });
});
