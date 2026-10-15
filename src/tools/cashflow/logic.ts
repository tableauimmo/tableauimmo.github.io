// Cash-flow mensuel d'un investissement locatif, avant impôt : loyer encaissé − crédit − charges.

export interface CashflowInput {
  /** Loyer mensuel hors charges (€) */
  rent: number;
  /** Vacance locative (semaines par an) */
  vacancyWeeks: number;
  /** Mensualité du crédit, assurance comprise (€/mois) */
  loanPayment: number;
  /** Charges de copropriété non récupérables (€/mois) */
  coproCharges: number;
  /** Taxe foncière (€/an) */
  propertyTax: number;
  /** Assurance propriétaire non occupant (€/an) */
  insurance: number;
  /** Frais de gestion locative (% des loyers encaissés) */
  management: number;
  /** Provision pour entretien et petits travaux (€/mois) */
  maintenance: number;
}

export interface CashflowResult {
  /** Loyer moyen encaissé par mois, vacance déduite */
  collectedRent: number;
  managementFees: number;
  /** Taxe foncière + assurance ramenées au mois */
  annualChargesMonthly: number;
  /** Toutes les charges du mois (hors crédit) */
  charges: number;
  /** Cash-flow mensuel avant impôt */
  monthly: number;
  annual: number;
}

export function computeCashflow(input: CashflowInput): CashflowResult {
  const collectedRent = input.rent * (1 - input.vacancyWeeks / 52);
  const managementFees = (collectedRent * input.management) / 100;
  const annualChargesMonthly = (input.propertyTax + input.insurance) / 12;
  const charges = input.coproCharges + annualChargesMonthly + managementFees + input.maintenance;
  const monthly = collectedRent - input.loanPayment - charges;
  return { collectedRent, managementFees, annualChargesMonthly, charges, monthly, annual: monthly * 12 };
}
