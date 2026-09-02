// Contribution-margin simulator for WOVO subscription terms.
//
// Deliberately dependency-free so it can be imported by app code, by the
// Node test runner, and by pricing tooling without pulling in the provider
// registry. Callers pass the provider cost they measured; tests wire in the
// real registry quotes so the numbers cannot drift from what is charged.
//
// Launch planning assumes customers spend their entire allowance. Unused
// balance is not treated as revenue.

export type WovoCostAssumptions = {
  /** Worst-case provider cost of one credit of real work, in micros of USD. */
  providerCostPerCreditMicros: number;
  /** Stripe percentage taken from each charge, e.g. 0.029. */
  stripePercent: number;
  /** Stripe fixed fee per charge, in cents. */
  stripeFixedCents: number;
  /** Storage and egress for one active workspace per month, in cents. */
  storageEgressCentsPerMonth: number;
  /** Support, moderation and refund allowance per workspace per month, in cents. */
  supportCentsPerMonth: number;
  /** Share of the allowance actually spent. Launch planning uses 1. */
  utilization: number;
};

export const WOVO_LAUNCH_COST_ASSUMPTIONS: WovoCostAssumptions = {
  providerCostPerCreditMicros: 15_570,
  stripePercent: 0.029,
  stripeFixedCents: 30,
  storageEgressCentsPerMonth: 6,
  supportCentsPerMonth: 40,
  utilization: 1,
};

export type PlanTermCharge = {
  monthlyCredits: number;
  /** Amount charged once per term, in cents. */
  amountCents: number;
  monthsCovered: number;
};

export type PlanTermEconomics = {
  effectiveMonthlyRevenueCents: number;
  creditsSpentPerMonth: number;
  providerCostCentsPerMonth: number;
  stripeFeeCentsPerMonth: number;
  fixedCostCentsPerMonth: number;
  contributionCentsPerMonth: number;
  contributionMarginBps: number;
};

const MICROS_PER_CENT = 10_000;

export function planTermEconomics(
  charge: PlanTermCharge,
  assumptions: WovoCostAssumptions = WOVO_LAUNCH_COST_ASSUMPTIONS,
): PlanTermEconomics {
  const effectiveMonthlyRevenueCents = charge.amountCents / charge.monthsCovered;
  const stripeFeeCentsPerMonth =
    (charge.amountCents * assumptions.stripePercent + assumptions.stripeFixedCents) / charge.monthsCovered;
  const fixedCostCentsPerMonth =
    assumptions.storageEgressCentsPerMonth + assumptions.supportCentsPerMonth;
  const creditsSpentPerMonth = charge.monthlyCredits * assumptions.utilization;
  const providerCostCentsPerMonth =
    (creditsSpentPerMonth * assumptions.providerCostPerCreditMicros) / MICROS_PER_CENT;
  const contributionCentsPerMonth =
    effectiveMonthlyRevenueCents - stripeFeeCentsPerMonth - fixedCostCentsPerMonth - providerCostCentsPerMonth;
  const contributionMarginBps =
    effectiveMonthlyRevenueCents <= 0
      ? -1
      : Math.floor((contributionCentsPerMonth * 10_000) / effectiveMonthlyRevenueCents);
  return {
    effectiveMonthlyRevenueCents,
    creditsSpentPerMonth,
    providerCostCentsPerMonth,
    stripeFeeCentsPerMonth,
    fixedCostCentsPerMonth,
    contributionCentsPerMonth,
    contributionMarginBps,
  };
}

/**
 * The largest monthly allowance this charge can carry and still clear the
 * target contribution margin with the whole allowance spent.
 */
export function maxMonthlyCreditsForMargin(
  charge: Omit<PlanTermCharge, "monthlyCredits">,
  targetContributionMarginBps: number,
  assumptions: WovoCostAssumptions = WOVO_LAUNCH_COST_ASSUMPTIONS,
): number {
  const effectiveMonthlyRevenueCents = charge.amountCents / charge.monthsCovered;
  const stripeFeeCentsPerMonth =
    (charge.amountCents * assumptions.stripePercent + assumptions.stripeFixedCents) / charge.monthsCovered;
  const fixedCostCentsPerMonth =
    assumptions.storageEgressCentsPerMonth + assumptions.supportCentsPerMonth;
  const budgetForProviderCents =
    effectiveMonthlyRevenueCents * (1 - targetContributionMarginBps / 10_000)
    - stripeFeeCentsPerMonth
    - fixedCostCentsPerMonth;
  if (budgetForProviderCents <= 0) return 0;
  const credits =
    (budgetForProviderCents * MICROS_PER_CENT)
    / (assumptions.providerCostPerCreditMicros * assumptions.utilization);
  return Math.floor(credits);
}
