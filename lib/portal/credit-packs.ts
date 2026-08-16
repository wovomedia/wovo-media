import "server-only";

import { retrievePrice, type StripePrice } from "@/lib/stripe";

export const CREDIT_PACKS = [
  { key: "small", label: "50 credits", units: 50, amountCents: 500, priceId: "price_1Ta7xPFmIvQosWF9Uz8mWJvS" },
  { key: "growth", label: "110 credits", units: 110, amountCents: 1000, priceId: "price_1Ta7xZFmIvQosWF9e8Pdbgor" },
  { key: "studio", label: "300 credits", units: 300, amountCents: 2500, priceId: "price_1Ta7xiFmIvQosWF9VFsQSkhp" },
] as const;

export type CreditPackKey = (typeof CREDIT_PACKS)[number]["key"];

export function isCreditPackKey(value: unknown): value is CreditPackKey {
  return typeof value === "string" && CREDIT_PACKS.some((pack) => pack.key === value);
}

function validStripePrice(price: StripePrice, pack: (typeof CREDIT_PACKS)[number]) {
  const productId = typeof price.product === "string" ? price.product : price.product?.id;
  return price.id === pack.priceId
    && price.active
    && price.livemode === true
    && price.currency === "usd"
    && price.unit_amount === pack.amountCents
    && price.type === "one_time"
    && !price.recurring
    && productId === "prod_UZGU8hlBakenHa"
    && price.metadata?.wovo_product === "workspace_credits"
    && Number(price.metadata?.credit_units) === pack.units;
}

export async function getValidatedCreditPack(key: CreditPackKey) {
  const pack = CREDIT_PACKS.find((candidate) => candidate.key === key)!;
  const price = await retrievePrice(pack.priceId);
  return validStripePrice(price, pack) ? pack : null;
}

export async function getValidatedCreditPacks() {
  const validated = await Promise.all(CREDIT_PACKS.map(async (pack) => {
    try { return await getValidatedCreditPack(pack.key); } catch { return null; }
  }));
  return validated.filter((pack): pack is (typeof CREDIT_PACKS)[number] => Boolean(pack));
}

export function creditPackForPriceId(priceId: string) {
  return CREDIT_PACKS.find((pack) => pack.priceId === priceId) ?? null;
}
