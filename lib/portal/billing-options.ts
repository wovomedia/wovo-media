import { getEnv } from "@/lib/env";
import { retrievePrice } from "@/lib/stripe";

export type PortalBillingFrequency = "monthly" | "quarterly" | "semiannual" | "yearly";

export type PortalBillingOption = {
  frequency: PortalBillingFrequency;
  label: string;
  amountCents: number;
  currency: "usd";
  interval: "month" | "year";
  intervalCount: number;
  monthsCovered: 1 | 3 | 6 | 12;
  effectiveMonthlyCents: number;
  savingsCents: number;
  savingsPercent: number;
  renewalLabel: string;
};

const BILLING_CONFIG: Record<PortalBillingFrequency, {
  env: "WOVO_PORTAL_MONTHLY_PRICE_ID" | "WOVO_PORTAL_QUARTERLY_PRICE_ID" | "WOVO_PORTAL_SEMIANNUAL_PRICE_ID" | "WOVO_PORTAL_YEARLY_PRICE_ID";
  label: string;
  amountCents: number;
  interval: "month" | "year";
  intervalCount: number;
  monthsCovered: 1 | 3 | 6 | 12;
  renewalLabel: string;
}> = {
  monthly: {
    env: "WOVO_PORTAL_MONTHLY_PRICE_ID",
    label: "Monthly",
    amountCents: 4499,
    interval: "month",
    intervalCount: 1,
    monthsCovered: 1,
    renewalLabel: "$44.99 every month",
  },
  quarterly: {
    env: "WOVO_PORTAL_QUARTERLY_PRICE_ID",
    label: "Every 3 months",
    amountCents: 11997,
    interval: "month",
    intervalCount: 3,
    monthsCovered: 3,
    renewalLabel: "$119.97 every 3 months",
  },
  semiannual: {
    env: "WOVO_PORTAL_SEMIANNUAL_PRICE_ID",
    label: "Every 6 months",
    amountCents: 20994,
    interval: "month",
    intervalCount: 6,
    monthsCovered: 6,
    renewalLabel: "$209.94 every 6 months",
  },
  yearly: {
    env: "WOVO_PORTAL_YEARLY_PRICE_ID",
    label: "Yearly",
    amountCents: 35988,
    interval: "year",
    intervalCount: 1,
    monthsCovered: 12,
    renewalLabel: "$359.88 every year",
  },
};

const FREQUENCIES = Object.keys(BILLING_CONFIG) as PortalBillingFrequency[];

export function isPortalBillingFrequency(value: unknown): value is PortalBillingFrequency {
  return typeof value === "string" && FREQUENCIES.includes(value as PortalBillingFrequency);
}

export function getPortalPriceIdForFrequency(frequency: PortalBillingFrequency): string {
  return getEnv(BILLING_CONFIG[frequency].env);
}

export function getPortalGrandfatheredPriceIds(): string[] {
  return getEnv("WOVO_PORTAL_GRANDFATHERED_PRICE_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("price_"));
}

export function getPortalSubscriptionPriceAllowlist(): string[] {
  return [...new Set([
    ...FREQUENCIES.map(getPortalPriceIdForFrequency).filter(Boolean),
    ...getPortalGrandfatheredPriceIds(),
  ])];
}

export async function getValidatedPortalBillingOption(frequency: PortalBillingFrequency): Promise<PortalBillingOption | null> {
  const expected = BILLING_CONFIG[frequency];
  const priceId = getPortalPriceIdForFrequency(frequency);
  if (!priceId) return null;
  const price = await retrievePrice(priceId).catch(() => null);
  if (
    !price?.active
    || price.currency !== "usd"
    || price.unit_amount !== expected.amountCents
    || price.recurring?.interval !== expected.interval
    || (price.recurring.interval_count ?? 1) !== expected.intervalCount
  ) return null;

  const monthlyBaselineCents = 4499 * expected.monthsCovered;
  const savingsCents = Math.max(0, monthlyBaselineCents - expected.amountCents);
  return {
    frequency,
    label: expected.label,
    amountCents: expected.amountCents,
    currency: "usd",
    interval: expected.interval,
    intervalCount: expected.intervalCount,
    monthsCovered: expected.monthsCovered,
    effectiveMonthlyCents: Math.round(expected.amountCents / expected.monthsCovered),
    savingsCents,
    savingsPercent: Math.round((savingsCents / monthlyBaselineCents) * 100),
    renewalLabel: expected.renewalLabel,
  };
}

export async function getValidatedPortalBillingOptions(): Promise<PortalBillingOption[]> {
  const options = await Promise.all(FREQUENCIES.map(getValidatedPortalBillingOption));
  return options.filter((option): option is PortalBillingOption => Boolean(option));
}

export async function isAllowedPortalSubscriptionPriceId(priceId: string | null | undefined): Promise<boolean> {
  if (!priceId || !getPortalSubscriptionPriceAllowlist().includes(priceId)) return false;
  if (getPortalGrandfatheredPriceIds().includes(priceId)) return true;
  const matches = await Promise.all(FREQUENCIES.map(async (frequency) => {
    if (getPortalPriceIdForFrequency(frequency) !== priceId) return false;
    return Boolean(await getValidatedPortalBillingOption(frequency));
  }));
  return matches.some(Boolean);
}
