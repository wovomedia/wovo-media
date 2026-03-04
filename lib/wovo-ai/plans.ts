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

export const PRICE_TO_PLAN: Record<string, PlanName> = {
  [process.env.STARTER_PRICE_ID ?? ""]: "starter",
  [process.env.PRO_PRICE_ID ?? ""]: "pro",
  [process.env.AGENCY_PRICE_ID ?? ""]: "agency",
};

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
