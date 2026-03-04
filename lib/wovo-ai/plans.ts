export type PlanName = "starter" | "pro" | "business";

export type PlanConfig = {
  name: PlanName;
  label: string;
  monthlyCredits: number;
  monthlyPrice: string;
  priceId: string;
};

export const WOVO_AI_PRICES: Record<PlanName, string> = {
  starter: "price_1T76wyFmIvQosWF9UoGSKAe2",
  pro: "price_1T76wSFmIvQosWF9u3GWCWBV",
  business: "price_1T76vlFmIvQosWF9gmdPrCVT",
};

const PLAN_MAP: Record<PlanName, PlanConfig> = {
  starter: { name: "starter", label: "Starter", monthlyCredits: 25, monthlyPrice: "$24.99/month", priceId: WOVO_AI_PRICES.starter },
  pro: { name: "pro", label: "Pro", monthlyCredits: 50, monthlyPrice: "$49.99/month", priceId: WOVO_AI_PRICES.pro },
  business: { name: "business", label: "Business", monthlyCredits: 100, monthlyPrice: "$99/month", priceId: WOVO_AI_PRICES.business },
};

export function getAllowedSubscriptionPriceIds(): string[] {
  return Object.values(WOVO_AI_PRICES);
}

export function getPlanFromPriceId(priceId: string | null | undefined): PlanName | null {
  if (!priceId) return null;
  const found = (Object.entries(WOVO_AI_PRICES) as Array<[PlanName, string]>).find(([, id]) => id === priceId);
  return found?.[0] ?? null;
}

export function getPlanConfig(plan: PlanName): PlanConfig {
  return PLAN_MAP[plan];
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return ["active", "trialing"].includes(status ?? "");
}

export const EXTRA_CREDITS_PRICE_ID = "price_1T7K3uFmIvQosWF9B3oVEMMu";
