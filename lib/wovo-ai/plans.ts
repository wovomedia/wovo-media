export type PlanName = "starter" | "growth" | "pro";

export type PlanConfig = {
  name: PlanName;
  label: string;
  monthlyCredits: number;
  monthlyPrice: string;
  priceId: string;
  trialDays: number;
};

// Stripe Price IDs — update these with real IDs from your Stripe dashboard
// Agency / done-for-you plans (contact-based, no Stripe subscription needed)
export const WOVO_AI_PRICES: Record<PlanName, string> = {
  starter: "price_1T76wyFmIvQosWF9UoGSKAe2",   // $24.99/mo — update in Stripe
  growth:  "price_1T76wSFmIvQosWF9u3GWCWBV",   // $49.99/mo — update in Stripe
  pro:     "price_1T76vlFmIvQosWF9gmdPrCVT",   // $99/mo    — update in Stripe
};

// Legacy alias used in some routes
export const WOVO_AI_PRICES_LEGACY: Record<string, string> = {
  starter: WOVO_AI_PRICES.starter,
  growth:  WOVO_AI_PRICES.growth,
  pro:     WOVO_AI_PRICES.pro,
  // Old names still accepted
  business: WOVO_AI_PRICES.pro,
  standard: WOVO_AI_PRICES.growth,
};

const PLAN_MAP: Record<PlanName, PlanConfig> = {
  starter: {
    name: "starter",
    label: "Starter",
    monthlyCredits: 50,
    monthlyPrice: "$24.99/month",
    priceId: WOVO_AI_PRICES.starter,
    trialDays: 7,
  },
  growth: {
    name: "growth",
    label: "Growth",
    monthlyCredits: 150,
    monthlyPrice: "$49.99/month",
    priceId: WOVO_AI_PRICES.growth,
    trialDays: 7,
  },
  pro: {
    name: "pro",
    label: "Pro",
    monthlyCredits: 300,
    monthlyPrice: "$99/month",
    priceId: WOVO_AI_PRICES.pro,
    trialDays: 7,
  },
};

export function getAllowedSubscriptionPriceIds(): string[] {
  return Object.values(WOVO_AI_PRICES);
}

export function getPlanFromPriceId(priceId: string | null | undefined): PlanName | null {
  if (!priceId) return null;
  const found = (Object.entries(WOVO_AI_PRICES) as Array<[PlanName, string]>).find(
    ([, id]) => id === priceId
  );
  return found?.[0] ?? null;
}

export function getPlanConfig(plan: PlanName): PlanConfig {
  return PLAN_MAP[plan];
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return ["active", "trialing"].includes(status ?? "");
}

// ─── CREDIT PACKS ───
export type CreditPack = {
  priceId: string;
  credits: number;
  price: number;
  label: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  { priceId: "price_1T7K3uFmIvQosWF9B3oVEMMu", credits: 5,  price: 1.5,  label: "Small Pack" },
  { priceId: "price_1T7tozFmIvQosWF9Nrnm4zqG", credits: 20, price: 5.0,  label: "Medium Pack" },
  { priceId: "price_1T7tqNFmIvQosWF9emrI26Mi", credits: 50, price: 10.0, label: "Large Pack" },
];

export const CREDIT_PACK_MAP: Record<string, number> = {
  price_1T7K3uFmIvQosWF9B3oVEMMu: 5,
  price_1T7tozFmIvQosWF9Nrnm4zqG: 20,
  price_1T7tqNFmIvQosWF9emrI26Mi: 50,
};

export const EXTRA_CREDITS_PRICE_ID = CREDIT_PACKS[0].priceId;
export const VERIFIED_BADGE_PRICE_ID = process.env.WOVO_VERIFIED_BADGE_PRICE_ID ?? "";
export const VERIFIED_BADGE_CHECKOUT_LINK = process.env.WOVO_VERIFIED_BADGE_CHECKOUT_LINK ?? "";

export function getCreditPackByPriceId(priceId: string | null | undefined): CreditPack | null {
  if (!priceId) return null;
  return CREDIT_PACKS.find((p) => p.priceId === priceId) ?? null;
}

// ─── AGENCY PLANS (contact-based) ───
export const AGENCY_PLANS = [
  { name: "Essential", price: "$450/mo",     description: "Great entry point for any business" },
  { name: "Starter",   price: "$600/mo",     description: "Consistent local growth" },
  { name: "Growth",    price: "$800/mo",     description: "More velocity + lead generation" },
  { name: "Full",      price: "$1,000+/mo",  description: "Full-service media partnership" },
];
