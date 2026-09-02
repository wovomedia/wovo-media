import "server-only";

import { retrievePrice, type StripePrice } from "@/lib/stripe";

export const CREDIT_PACKS = [
  { key: "usd10", label: "$10 · 110 credits", units: 110, amountCents: 1000, priceId: "price_1UB3PWFmIvQosWF9xcL50lGK" },
  { key: "usd20", label: "$20 · 220 credits", units: 220, amountCents: 2000, priceId: "price_1UB3PWFmIvQosWF9xouEdvcA" },
  { key: "usd50", label: "$50 · 550 credits", units: 550, amountCents: 5000, priceId: "price_1UB3PWFmIvQosWF96Xk9R2dl" },
  { key: "usd100", label: "$100 · 1,100 credits", units: 1100, amountCents: 10000, priceId: "price_1UB3PWFmIvQosWF9QvTlfi8x" },
  { key: "usd500", label: "$500 · 5,500 credits", units: 5500, amountCents: 50000, priceId: "price_1UB3PWFmIvQosWF93AnT2m2c" },
  { key: "usd1000", label: "$1,000 · 11,000 credits", units: 11000, amountCents: 100000, priceId: "price_1UB3PXFmIvQosWF9xi2fjw3C" },
  // Legacy prices remain allowlisted only so already-open Checkout Sessions can
  // finish idempotently. They are no longer shown in the V2 purchase UI.
  { key: "small", label: "50 credits", units: 50, amountCents: 500, priceId: "price_1Ta7xPFmIvQosWF9Uz8mWJvS", legacy: true },
  { key: "growth", label: "110 credits", units: 110, amountCents: 1000, priceId: "price_1Ta7xZFmIvQosWF9e8Pdbgor", legacy: true },
  { key: "studio", label: "300 credits", units: 300, amountCents: 2500, priceId: "price_1Ta7xiFmIvQosWF9VFsQSkhp", legacy: true },
] as const;

export const PUBLIC_CREDIT_PACKS = CREDIT_PACKS.filter((pack) => !("legacy" in pack && pack.legacy));
export type CreditPackKey = (typeof CREDIT_PACKS)[number]["key"];

export function isCreditPackKey(value: unknown): value is CreditPackKey {
  return typeof value === "string" && CREDIT_PACKS.some((pack) => pack.key === value);
}

function validStripePrice(price: StripePrice, pack: (typeof CREDIT_PACKS)[number]) {
  const productId = typeof price.product === "string" ? price.product : price.product?.id;
  const legacy = "legacy" in pack && pack.legacy;
  return price.id === pack.priceId && price.active && price.livemode === true
    && price.currency === "usd" && price.unit_amount === pack.amountCents
    && price.type === "one_time" && !price.recurring
    && (legacy
      ? productId === "prod_UZGU8hlBakenHa" && price.metadata?.wovo_product === "workspace_credits"
      : productId === "prod_VBQGaU8BOlCaAU" && price.metadata?.wovo_product === "workspace_credits_v2")
    && Number(price.metadata?.credit_units) === pack.units;
}

export async function getValidatedCreditPack(key: CreditPackKey) {
  const pack = CREDIT_PACKS.find((candidate) => candidate.key === key)!;
  const price = await retrievePrice(pack.priceId);
  return validStripePrice(price, pack) ? pack : null;
}

export async function getValidatedCreditPacks() {
  const validated = await Promise.all(PUBLIC_CREDIT_PACKS.map(async (pack) => {
    try { return await getValidatedCreditPack(pack.key); } catch { return null; }
  }));
  return validated.filter((pack): pack is (typeof PUBLIC_CREDIT_PACKS)[number] => Boolean(pack));
}

export function creditPackForPriceId(priceId: string) {
  return CREDIT_PACKS.find((pack) => pack.priceId === priceId) ?? null;
}
