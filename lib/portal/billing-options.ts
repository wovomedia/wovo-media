import { getEnv } from "@/lib/env";
import { retrievePrice } from "@/lib/stripe";
import {
  getWovoPlanTerm,
  isWovoBillingTerm,
  isWovoPlanId,
  WOVO_PLAN_TERMS,
  type WovoBillingTerm,
  type WovoPlanId,
} from "@/lib/portal/pricing-catalog";

export type PortalBillingFrequency = WovoBillingTerm;
export type PortalBillingOption = Omit<(typeof WOVO_PLAN_TERMS)[number], "priceId">;

export { isWovoPlanId as isPortalPlanId, isWovoBillingTerm as isPortalBillingFrequency };

export function getPortalPriceId(planId: WovoPlanId, frequency: PortalBillingFrequency): string {
  return getWovoPlanTerm(planId, frequency).priceId;
}

export function getPortalGrandfatheredPriceIds(): string[] {
  return [
    getEnv("WOVO_PORTAL_MONTHLY_PRICE_ID"),
    getEnv("WOVO_PORTAL_QUARTERLY_PRICE_ID"),
    getEnv("WOVO_PORTAL_SEMIANNUAL_PRICE_ID"),
    getEnv("WOVO_PORTAL_YEARLY_PRICE_ID"),
    ...getEnv("WOVO_PORTAL_GRANDFATHERED_PRICE_IDS").split(","),
  ].map((value) => value.trim()).filter((value) => value.startsWith("price_"));
}

export function getPortalSubscriptionPriceAllowlist(): string[] {
  return [...new Set([...WOVO_PLAN_TERMS.map((item) => item.priceId), ...getPortalGrandfatheredPriceIds()])];
}

export async function getValidatedPortalBillingOption(planId: WovoPlanId, frequency: PortalBillingFrequency): Promise<PortalBillingOption | null> {
  const expected = getWovoPlanTerm(planId, frequency);
  const price = await retrievePrice(expected.priceId).catch(() => null);
  if (
    !price?.active || price.livemode !== true || price.currency !== "usd"
    || price.unit_amount !== expected.amountCents
    || price.recurring?.interval !== expected.interval
    || (price.recurring.interval_count ?? 1) !== expected.intervalCount
    || price.metadata?.wovo_product !== "v2_creator_subscription"
    || price.metadata?.wovo_plan !== planId
    || price.metadata?.billing_term !== frequency
    || Number(price.metadata?.monthly_credits) !== expected.monthlyCredits
  ) return null;
  const option: PortalBillingOption & { priceId?: string } = { ...expected };
  delete option.priceId;
  return option;
}

export async function getValidatedPortalBillingOptions(): Promise<PortalBillingOption[]> {
  const options = await Promise.all(WOVO_PLAN_TERMS.map((item) => getValidatedPortalBillingOption(item.planId, item.frequency)));
  return options.filter((option): option is PortalBillingOption => Boolean(option));
}

export async function isAllowedPortalSubscriptionPriceId(priceId: string | null | undefined): Promise<boolean> {
  if (!priceId || !getPortalSubscriptionPriceAllowlist().includes(priceId)) return false;
  if (getPortalGrandfatheredPriceIds().includes(priceId)) return true;
  const expected = WOVO_PLAN_TERMS.find((item) => item.priceId === priceId);
  return Boolean(expected && await getValidatedPortalBillingOption(expected.planId, expected.frequency));
}

export function planForPortalSubscriptionPriceId(priceId: string | null | undefined) {
  return WOVO_PLAN_TERMS.find((item) => item.priceId === priceId) ?? null;
}
