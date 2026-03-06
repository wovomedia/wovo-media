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
  starter: { name: "starter", label: "Starter", monthlyCredits: 50, monthlyPrice: "$24.99/month", priceId: WOVO_AI_PRICES.starter },
  pro: { name: "pro", label: "Growth", monthlyCredits: 150, monthlyPrice: "$49.99/month", priceId: WOVO_AI_PRICES.pro },
  business: { name: "business", label: "Pro", monthlyCredits: 300, monthlyPrice: "$99/month", priceId: WOVO_AI_PRICES.business },
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

export type CreditPack = {
  priceId: string;
  credits: number;
  price: number;
  label: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  { priceId: "price_1T7K3uFmIvQosWF9B3oVEMMu", credits: 5, price: 1.5, label: "Small Pack" },
  { priceId: "price_1T7tozFmIvQosWF9Nrnm4zqG", credits: 20, price: 5, label: "Medium Pack" },
  { priceId: "price_1T7tqNFmIvQosWF9emrI26Mi", credits: 50, price: 10, label: "Large Pack" },
];

export const EXTRA_CREDITS_PRICE_ID = CREDIT_PACKS[0].priceId;

export function getCreditPackByPriceId(priceId: string | null | undefined): CreditPack | null {
  if (!priceId) return null;
  return CREDIT_PACKS.find((pack) => pack.priceId === priceId) ?? null;
}
