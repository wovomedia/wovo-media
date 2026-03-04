export type PlanName = "starter" | "pro" | "agency";

export type PlanConfig = {
  name: PlanName;
  label: string;
  monthlyCredits: number;
  weeklyLimit: number;
};

const PLAN_MAP: Record<PlanName, PlanConfig> = {
  starter: { name: "starter", label: "Starter", monthlyCredits: 9, weeklyLimit: 3 },
  pro: { name: "pro", label: "Pro", monthlyCredits: 18, weeklyLimit: 6 },
  agency: { name: "agency", label: "Agency", monthlyCredits: 42, weeklyLimit: 14 },
};

const PRICE_TO_PLAN_ENTRIES = [
  [process.env.NEXT_PUBLIC_STARTER_PRICE_ID, "starter"],
  [process.env.NEXT_PUBLIC_PRO_PRICE_ID, "pro"],
  [process.env.NEXT_PUBLIC_AGENCY_PRICE_ID, "agency"],
] as const;

export const PRICE_TO_PLAN: Record<string, PlanName> = PRICE_TO_PLAN_ENTRIES.reduce<Record<string, PlanName>>(
  (acc, [priceId, plan]) => {
    if (priceId) acc[priceId] = plan;
    return acc;
  },
  {},
);

export function getPlanFromPriceId(priceId: string | null | undefined): PlanName | null {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] ?? null;
}

export function getPlanConfig(plan: PlanName): PlanConfig {
  return PLAN_MAP[plan];
}

export function isActiveSubscription(status: string | null | undefined): boolean {
  return ["active", "trialing", "past_due"].includes(status ?? "");
}
