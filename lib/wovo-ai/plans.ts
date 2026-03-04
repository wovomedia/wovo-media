export type PlanName = "starter" | "pro" | "business";

export type PlanConfig = {
  name: PlanName;
  label: string;
  monthlyCredits: number;
  monthlyPrice: string;
};

export const WOVO_AI_PRICES: Record<PlanName, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

const PLAN_MAP: Record<PlanName, PlanConfig> = {
  starter: { name: "starter", label: "Starter", monthlyCredits: 25, monthlyPrice: "$24.99/month" },
  pro: { name: "pro", label: "Pro", monthlyCredits: 50, monthlyPrice: "$49.99/month" },
  business: { name: "business", label: "Business", monthlyCredits: 100, monthlyPrice: "$99/month" },
};

function getPricePlanPairs(): Array<[string, PlanName]> {
  return Object.entries(WOVO_AI_PRICES)
    .filter(([, priceId]) => Boolean(priceId))
    .map(([plan, priceId]) => [priceId as string, plan as PlanName]);
}

export function getAllowedSubscriptionPriceIds(): string[] {
  return getPricePlanPairs().map(([priceId]) => priceId);
}

export function getPlanFromPriceId(priceId: string | null | undefined): PlanName | null {
  if (!priceId) return null;
  const mapping = getPricePlanPairs().reduce<Record<string, PlanName>>((acc, [id, plan]) => {
    acc[id] = plan;
    return acc;
  }, {});
  return mapping[priceId] ?? null;
}

export function getPlanConfig(plan: PlanName): PlanConfig {
  return PLAN_MAP[plan];
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return ["active", "trialing"].includes(status ?? "");
}

export const EXTRA_CREDITS_PRICE_ID = "price_1T7K3uFmIvQosWF9B3oVEMMu";
