// Capacité d'emprunt selon la règle du Haut Conseil de stabilité financière (HCSF) :
// taux d'effort (mensualités / revenus) ≤ 35 % assurance comprise, durée ≤ 25 ans (27 ans avec différé).
// Décision D-HCSF-2021-7 du 29 septembre 2021, modifiée ; contraignante depuis le 1er janvier 2022.

import { annuityFactor } from '../credit/logic.ts';

/** Part des loyers retenue par la plupart des banques (pratique courante, non fixée par le HCSF). */
export const RENT_RETAINED = 0.7;
/** Durée maximale de la règle HCSF (hors différé). */
export const HCSF_MAX_YEARS = 25;
export const HCSF_MAX_RATIO = 35;

export interface CapacityInput {
  /** Revenus nets mensuels du foyer, avant impôt (€) */
  income: number;
  /** Loyers déjà perçus, bruts mensuels (€) */
  rents: number;
  /** Mensualités des crédits en cours (€) */
  otherLoans: number;
  /** Taux nominal annuel (%) */
  rate: number;
  /** Durée (années) */
  years: number;
  /** Assurance emprunteur, taux annuel sur le capital (%) */
  insurance: number;
  /** Taux d'endettement maximal (%) */
  maxRatio: number;
}

export interface CapacityResult {
  /** Revenus retenus : revenus + 70 % des loyers */
  retainedIncome: number;
  /** Mensualité maximale toutes charges de crédit comprises (avant déduction des crédits en cours) */
  maxDebtService: number;
  /** Mensualité disponible pour le nouveau prêt, assurance comprise */
  availablePayment: number;
  /** Capital empruntable */
  capital: number;
  /** Part hors assurance de la mensualité */
  loanPayment: number;
  monthlyInsurance: number;
  /** Coût total du crédit (intérêts + assurance) pour ce capital */
  totalCost: number;
  /** Revenus retenus − toutes les mensualités */
  remainingIncome: number;
  months: number;
  warnings: string[];
}

export function computeCapacity(input: CapacityInput): CapacityResult {
  const months = Math.round(input.years * 12);
  const retainedIncome = input.income + RENT_RETAINED * input.rents;
  const maxDebtService = (retainedIncome * input.maxRatio) / 100;
  const availablePayment = Math.max(0, maxDebtService - input.otherLoans);
  const factor = annuityFactor(input.rate / 100 / 12, months);
  const insurancePerEuro = input.insurance / 100 / 12;
  const capital = availablePayment / (factor + insurancePerEuro);
  const loanPayment = capital * factor;
  const monthlyInsurance = capital * insurancePerEuro;
  const totalCost = loanPayment * months - capital + monthlyInsurance * months;

  const warnings: string[] = [];
  if (input.otherLoans >= maxDebtService) {
    warnings.push('Vos crédits en cours atteignent déjà le taux d’endettement maximal : aucune nouvelle mensualité n’est possible avec cette règle.');
  }
  if (input.years > HCSF_MAX_YEARS) {
    warnings.push('Au-delà de 25 ans, la règle du HCSF n’admet que 2 ans de différé (achat dans le neuf ou travaux importants) ou un dossier pris sur la marge de dérogation des banques.');
  }
  if (input.maxRatio > HCSF_MAX_RATIO) {
    warnings.push('Un taux d’endettement supérieur à 35 % n’est possible que sur la marge de dérogation des banques (20 % des crédits accordés).');
  }
  return {
    retainedIncome,
    maxDebtService,
    availablePayment,
    capital,
    loanPayment,
    monthlyInsurance,
    totalCost,
    remainingIncome: retainedIncome - input.otherLoans - availablePayment,
    months,
    warnings,
  };
}
