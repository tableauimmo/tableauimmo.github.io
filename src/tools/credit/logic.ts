// Crédit immobilier à taux fixe et mensualités constantes (amortissement « à la française »).
// Logique pure, sans dépendance au navigateur : testée dans tests/unit/tools.test.ts.

export interface LoanInput {
  /** Montant emprunté (€) */
  capital: number;
  /** Taux nominal annuel (%), hors assurance */
  rate: number;
  /** Durée (années) */
  years: number;
  /** Assurance emprunteur : taux annuel (%) appliqué au capital initial */
  insurance: number;
}

export interface ScheduleYear {
  year: number;
  /** Intérêts payés dans l'année */
  interest: number;
  /** Capital remboursé dans l'année */
  principal: number;
  insurance: number;
  /** Capital restant dû en fin d'année */
  remaining: number;
}

export interface LoanResult {
  months: number;
  /** Taux périodique mensuel (fraction : 0,035 / 12) */
  monthlyRate: number;
  /** Mensualité hors assurance */
  payment: number;
  /** Assurance mensuelle */
  monthlyInsurance: number;
  /** Mensualité assurance comprise */
  monthlyTotal: number;
  totalInterest: number;
  totalInsurance: number;
  /** Coût du crédit : intérêts + assurance */
  totalCost: number;
  /** Total remboursé : capital + intérêts + assurance */
  totalRepaid: number;
  schedule: ScheduleYear[];
}

/** Facteur d'annuité : mensualité pour 1 € emprunté (t / (1 − (1 + t)^−n)), ou 1/n à taux nul. */
export function annuityFactor(monthlyRate: number, months: number): number {
  if (months <= 0) throw new Error('Durée nulle');
  if (monthlyRate === 0) return 1 / months;
  return monthlyRate / (1 - (1 + monthlyRate) ** -months);
}

/** Mensualité hors assurance d'un prêt amortissable à taux fixe. */
export function monthlyPayment(capital: number, annualRatePercent: number, months: number): number {
  return capital * annuityFactor(annualRatePercent / 100 / 12, months);
}

export function computeLoan(input: LoanInput): LoanResult {
  const months = Math.round(input.years * 12);
  const monthlyRate = input.rate / 100 / 12;
  const payment = input.capital * annuityFactor(monthlyRate, months);
  const monthlyInsurance = (input.capital * input.insurance) / 100 / 12;

  const schedule: ScheduleYear[] = [];
  let remaining = input.capital;
  for (let month = 1; month <= months; month += 1) {
    const interest = remaining * monthlyRate;
    // Dernière échéance : solde exact (les arrondis flottants ne laissent jamais de reliquat).
    const principal = month === months ? remaining : payment - interest;
    remaining = Math.max(0, remaining - principal);
    const yearIndex = Math.ceil(month / 12) - 1;
    const year = schedule[yearIndex] ?? { year: yearIndex + 1, interest: 0, principal: 0, insurance: 0, remaining: 0 };
    year.interest += interest;
    year.principal += principal;
    year.insurance += monthlyInsurance;
    year.remaining = remaining;
    schedule[yearIndex] = year;
  }

  const totalInterest = schedule.reduce((sum, year) => sum + year.interest, 0);
  const totalInsurance = monthlyInsurance * months;
  return {
    months,
    monthlyRate,
    payment,
    monthlyInsurance,
    monthlyTotal: payment + monthlyInsurance,
    totalInterest,
    totalInsurance,
    totalCost: totalInterest + totalInsurance,
    totalRepaid: input.capital + totalInterest + totalInsurance,
    schedule,
  };
}
