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

function getPricePlanPairs(): Array<[string, PlanName]> {
  const entries: Array<[string | undefined, PlanName]> = [
    [process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID, "starter"],
    [process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID, "pro"],
    [process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID, "agency"],
  ];

  return entries.filter((entry): entry is [string, PlanName] => Boolean(entry[0]));
}

export function getPriceToPlanMap(): Record<string, PlanName> {
  return getPricePlanPairs().reduce<Record<string, PlanName>>((acc, [priceId, plan]) => {
    acc[priceId] = plan;
    return acc;
  }, {});
}

export function getPlanFromPriceId(priceId: string | null | undefined): PlanName | null {
  if (!priceId) return null;
  return getPriceToPlanMap()[priceId] ?? null;
}

export function getPlanConfig(plan: PlanName): PlanConfig {
  return PLAN_MAP[plan];
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return ["active", "trialing"].includes(status ?? "");
}

export function getUpgradeSuggestion(currentPlan: PlanName | null): PlanName {
  if (currentPlan === "starter") return "pro";
  return "agency";
}
