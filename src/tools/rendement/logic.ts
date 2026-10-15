// Rendement locatif brut et net de charges (avant impôt et avant crédit).

export interface YieldInput {
  /** Prix d'achat net vendeur (€) */
  price: number;
  /** Frais d'acquisition : notaire, agence si à la charge de l'acheteur (€) */
  fees: number;
  /** Travaux (€) */
  works: number;
  /** Loyer mensuel hors charges (€) */
  rent: number;
  /** Vacance locative (semaines par an) */
  vacancyWeeks: number;
  /** Charges de copropriété non récupérables (€/an) */
  nonRecoverable: number;
  /** Taxe foncière (€/an) */
  propertyTax: number;
  /** Assurance propriétaire non occupant (€/an) */
  insurance: number;
  /** Frais de gestion locative (% des loyers encaissés) */
  management: number;
}

export interface YieldResult {
  totalCost: number;
  /** Loyers annuels théoriques (12 mois) */
  annualRent: number;
  /** Loyers encaissés après vacance */
  collectedRent: number;
  vacancyLoss: number;
  managementFees: number;
  /** Charges annuelles du propriétaire (copropriété, taxe foncière, assurance, gestion) */
  charges: number;
  /** Revenu net de charges, avant impôt et crédit */
  netIncome: number;
  /** Rendement brut sur le coût total (%) */
  gross: number;
  /** Rendement brut sur le seul prix d'achat (%) */
  grossOnPrice: number;
  /** Rendement net de charges sur le coût total (%) */
  net: number;
}

export const WEEKS_PER_YEAR = 52;

export function computeYield(input: YieldInput): YieldResult {
  const totalCost = input.price + input.fees + input.works;
  const annualRent = input.rent * 12;
  const collectedRent = annualRent * (1 - input.vacancyWeeks / WEEKS_PER_YEAR);
  const managementFees = (collectedRent * input.management) / 100;
  const charges = input.nonRecoverable + input.propertyTax + input.insurance + managementFees;
  const netIncome = collectedRent - charges;
  return {
    totalCost,
    annualRent,
    collectedRent,
    vacancyLoss: annualRent - collectedRent,
    managementFees,
    charges,
    netIncome,
    gross: (annualRent / totalCost) * 100,
    grossOnPrice: (annualRent / input.price) * 100,
    net: (netIncome / totalCost) * 100,
  };
}
