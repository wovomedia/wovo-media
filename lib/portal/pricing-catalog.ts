export type WovoPlanId = "starter" | "creator" | "pro";
export type WovoBillingTerm = "monthly" | "quarterly" | "semiannual" | "annual";

export const WOVO_PLAN_CATALOG = [
  { id: "starter", name: "Starter", monthlyCredits: 140, monthlyPriceCents: 1499 },
  { id: "creator", name: "Creator", monthlyCredits: 225, monthlyPriceCents: 2499 },
  { id: "pro", name: "Pro", monthlyCredits: 420, monthlyPriceCents: 4499 },
] as const;

export const WOVO_TERM_CATALOG = [
  { id: "monthly", label: "Monthly", monthsCovered: 1, amountMultiplier: 1, interval: "month", intervalCount: 1, discountPercent: 0 },
  { id: "quarterly", label: "3 Months", monthsCovered: 3, amountMultiplier: 2.85, interval: "month", intervalCount: 3, discountPercent: 5 },
  { id: "semiannual", label: "6 Months", monthsCovered: 6, amountMultiplier: 5.4, interval: "month", intervalCount: 6, discountPercent: 10 },
  { id: "annual", label: "Annual", monthsCovered: 12, amountMultiplier: 9.6, interval: "year", intervalCount: 1, discountPercent: 20 },
] as const;

const PRICE_IDS: Record<`${WovoPlanId}:${WovoBillingTerm}`, string> = {
  "starter:monthly": "price_1UB3KDFmIvQosWF9WvNrXmKw",
  "starter:quarterly": "price_1UB3KEFmIvQosWF9D6wERGFk",
  "starter:semiannual": "price_1UB3KEFmIvQosWF99ZZLZJfK",
  "starter:annual": "price_1UB3KEFmIvQosWF9oS5pWEW0",
  "creator:monthly": "price_1UB3KEFmIvQosWF9oNa4uTrM",
  "creator:quarterly": "price_1UB3KFFmIvQosWF90B3lAtM8",
  "creator:semiannual": "price_1UB3KFFmIvQosWF9JuEOLcHf",
  "creator:annual": "price_1UB3KFFmIvQosWF9nMb9vkfz",
  "pro:monthly": "price_1UB3KFFmIvQosWF9MVSRvUu3",
  "pro:quarterly": "price_1UB3KFFmIvQosWF9DwiZu2dg",
  "pro:semiannual": "price_1UB3KGFmIvQosWF9gX2xQrRu",
  "pro:annual": "price_1UB3KGFmIvQosWF93SMXD8s8",
};

export function isWovoPlanId(value: unknown): value is WovoPlanId {
  return typeof value === "string" && WOVO_PLAN_CATALOG.some((plan) => plan.id === value);
}

export function isWovoBillingTerm(value: unknown): value is WovoBillingTerm {
  return typeof value === "string" && WOVO_TERM_CATALOG.some((term) => term.id === value);
}

export function getWovoPlan(planId: WovoPlanId) {
  return WOVO_PLAN_CATALOG.find((plan) => plan.id === planId)!;
}

export function getWovoTerm(termId: WovoBillingTerm) {
  return WOVO_TERM_CATALOG.find((term) => term.id === termId)!;
}

export function getWovoPlanTerm(planId: WovoPlanId, termId: WovoBillingTerm) {
  const plan = getWovoPlan(planId);
  const term = getWovoTerm(termId);
  const amountCents = Math.round(plan.monthlyPriceCents * term.amountMultiplier);
  const baselineCents = plan.monthlyPriceCents * term.monthsCovered;
  return {
    planId,
    planName: plan.name,
    monthlyCredits: plan.monthlyCredits,
    frequency: termId,
    label: term.label,
    amountCents,
    currency: "usd" as const,
    interval: term.interval,
    intervalCount: term.intervalCount,
    monthsCovered: term.monthsCovered,
    effectiveMonthlyCents: Math.round(amountCents / term.monthsCovered),
    savingsCents: baselineCents - amountCents,
    savingsPercent: term.discountPercent,
    renewalLabel: `$${(amountCents / 100).toFixed(2)} every ${term.monthsCovered === 1 ? "month" : term.monthsCovered === 12 ? "year" : `${term.monthsCovered} months`}`,
    priceId: PRICE_IDS[`${planId}:${termId}`],
  };
}

export const WOVO_PLAN_TERMS = WOVO_PLAN_CATALOG.flatMap((plan) =>
  WOVO_TERM_CATALOG.map((term) => getWovoPlanTerm(plan.id, term.id)),
);

export function creditPackUnitsForDollars(amountDollars: number) {
  const safeAmount = Math.max(10, Math.min(10_000, Math.floor(amountDollars)));
  return safeAmount * 11;
}
