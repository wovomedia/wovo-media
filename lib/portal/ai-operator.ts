import "server-only";

import { getEnv } from "@/lib/env";
import { retrievePrice } from "@/lib/stripe";

export const AI_OPERATOR_FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
export type AiOperatorFrequency = (typeof AI_OPERATOR_FREQUENCIES)[number];

const CONFIG = {
  monthly: { env: "WOVO_AI_OPERATOR_MONTHLY_PRICE_ID", amountCents: 19900, interval: "month", intervalCount: 1, months: 1, label: "Monthly", renewal: "$199 every month" },
  quarterly: { env: "WOVO_AI_OPERATOR_QUARTERLY_PRICE_ID", amountCents: 37500, interval: "month", intervalCount: 3, months: 3, label: "Every 3 months", renewal: "$375 every 3 months" },
  yearly: { env: "WOVO_AI_OPERATOR_YEARLY_PRICE_ID", amountCents: 102000, interval: "year", intervalCount: 1, months: 12, label: "Yearly", renewal: "$1,020 every year" },
} as const;

export function isAiOperatorFrequency(value: unknown): value is AiOperatorFrequency {
  return typeof value === "string" && AI_OPERATOR_FREQUENCIES.includes(value as AiOperatorFrequency);
}

export function getAiOperatorPriceId(frequency: AiOperatorFrequency): string {
  return getEnv(CONFIG[frequency].env);
}

export async function getValidatedAiOperatorOptions() {
  const options = await Promise.all(AI_OPERATOR_FREQUENCIES.map(async (frequency) => {
    const expected = CONFIG[frequency];
    const priceId = getAiOperatorPriceId(frequency);
    if (!priceId) return null;
    const price = await retrievePrice(priceId).catch(() => null);
    if (!price?.active || price.currency !== "usd" || price.unit_amount !== expected.amountCents || price.recurring?.interval !== expected.interval || (price.recurring.interval_count ?? 1) !== expected.intervalCount) return null;
    const monthlyBaseline = 19900 * expected.months;
    return {
      frequency,
      label: expected.label,
      amountCents: expected.amountCents,
      effectiveMonthlyCents: Math.round(expected.amountCents / expected.months),
      savingsCents: monthlyBaseline - expected.amountCents,
      renewalLabel: expected.renewal,
      priceId,
    };
  }));
  return options.filter((option): option is NonNullable<typeof option> => Boolean(option));
}

export function getAiOperatorPriceAllowlist(): string[] {
  return AI_OPERATOR_FREQUENCIES.map(getAiOperatorPriceId).filter(Boolean);
}

export function aiOperatorCheckoutEnabled(): boolean {
  return getEnv("WOVO_AI_OPERATOR_CHECKOUT_ENABLED") === "true";
}
