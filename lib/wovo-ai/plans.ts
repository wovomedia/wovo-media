export type PlanName = "starter" | "pro" | "business";

export type PlanConfig = {
  name: PlanName;
  label: string;
  monthlyCredits: number;
};

const PLAN_MAP: Record<PlanName, PlanConfig> = {
  starter: { name: "starter", label: "Starter", monthlyCredits: 25 },
  pro: { name: "pro", label: "Pro", monthlyCredits: 50 },
  business: { name: "business", label: "Business", monthlyCredits: 100 },
};

function getPricePlanPairs(): Array<[string, PlanName]> {
  const entries: Array<[string | undefined, PlanName]> = [
    [process.env.NEXT_PUBLIC_STARTER_PRICE_ID, "starter"],
    [process.env.NEXT_PUBLIC_PRO_PRICE_ID, "pro"],
    [process.env.NEXT_PUBLIC_BUSINESS_PRICE_ID, "business"],
  ];

  return entries.filter((entry): entry is [string, PlanName] => Boolean(entry[0]));
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
