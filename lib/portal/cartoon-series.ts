import "server-only";

import { getEnv } from "@/lib/env";
import { retrievePrice } from "@/lib/stripe";

export const CARTOON_SERIES_PRICE_CENTS = 3999;
export const CARTOON_SERIES_PRICE_ENV = "WOVO_CARTOON_SERIES_MONTHLY_PRICE_ID";

export function cartoonSeriesPriceId(): string {
  return getEnv(CARTOON_SERIES_PRICE_ENV);
}

export function cartoonSeriesCheckoutEnabled(): boolean {
  return getEnv("WOVO_CARTOON_SERIES_CHECKOUT_ENABLED") === "true";
}

export async function getValidatedCartoonSeriesPrice() {
  const priceId = cartoonSeriesPriceId();
  if (!priceId || !cartoonSeriesCheckoutEnabled()) return null;
  const price = await retrievePrice(priceId).catch(() => null);
  if (
    !price?.active
    || price.livemode !== true
    || price.currency !== "usd"
    || price.unit_amount !== CARTOON_SERIES_PRICE_CENTS
    || price.recurring?.interval !== "month"
    || (price.recurring.interval_count ?? 1) !== 1
  ) return null;
  return {
    priceId,
    amountCents: CARTOON_SERIES_PRICE_CENTS,
    label: "$39.99/month",
    renewalLabel: "$39.99 every month",
  };
}

export function cartoonSeriesPriceAllowlist(): string[] {
  const value = cartoonSeriesPriceId();
  return value ? [value] : [];
}

export function cartoonProviderStatus() {
  const videoVerified = getEnv("WOVO_CARTOON_VIDEO_PROVIDER_VERIFIED") === "true";
  const falConfigured = Boolean(getEnv("FAL_KEY") || getEnv("FAL_API_KEY"));
  return {
    text: Boolean(getEnv("OPENAI_API_KEY")),
    video: falConfigured && getEnv("WOVO_CARTOON_VIDEO_ENABLED") === "true" && videoVerified,
    textModel: getEnv("WOVO_CARTOON_TEXT_MODEL") || "gpt-5.6-luna",
    videoModel: videoVerified
      ? (getEnv("WOVO_CARTOON_VIDEO_MODEL") || "fal-ai/wan/v2.2-a14b/text-to-video/turbo")
      : "provider_not_verified",
  };
}
