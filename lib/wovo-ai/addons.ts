import { listSubscriptionsForCustomer } from "@/lib/stripe";
import { isPaidStatus } from "@/lib/wovo-ai/plans";

/**
 * Paid add-ons that sit alongside the core subscription.
 *
 * Price IDs come from env rather than being hardcoded, matching the pattern
 * already used by WOVO_VERIFIED_BADGE_PRICE_ID. An add-on with no configured
 * price is simply not offered — the UI hides it and checkout refuses it —
 * so shipping this code before the Stripe price exists is safe.
 */

export type AddonKey = "dm_manager";

export type AddonConfig = {
  key: AddonKey;
  label: string;
  /** Displayed to users. Keep in sync with the Stripe price. */
  monthlyPrice: string;
  description: string;
  priceId: string;
};

const ADDONS: Record<AddonKey, AddonConfig> = {
  dm_manager: {
    key: "dm_manager",
    label: "AI DM manager",
    monthlyPrice: "$1.99/month",
    // Deliberately describes drafting rather than autonomous sending. Meta and
    // TikTok both restrict automated DM sending, and the compliant surface is
    // narrower than "it answers your DMs for you". See NOTES-FOR-CODEX.md.
    description:
      "WOVO drafts replies to incoming direct messages and keeps them in one queue for you to approve.",
    priceId: process.env.WOVO_DM_ADDON_PRICE_ID ?? "",
  },
};

export function getAddon(key: AddonKey): AddonConfig {
  return ADDONS[key];
}

/** Only add-ons with a configured Stripe price. Use this to build any UI list. */
export function getAvailableAddons(): AddonConfig[] {
  if (process.env.WOVO_DM_ADDON_CHECKOUT_ENABLED !== "true") return [];
  return Object.values(ADDONS).filter((addon) => addon.priceId.length > 0);
}

export function isAddonConfigured(key: AddonKey): boolean {
  return getAddon(key).priceId.length > 0;
}

export function findAddonByPriceId(priceId: string | null | undefined): AddonConfig | null {
  if (!priceId) return null;
  return Object.values(ADDONS).find((addon) => addon.priceId === priceId) ?? null;
}

/**
 * Whether a customer currently holds this add-on, resolved live against Stripe.
 *
 * Fails CLOSED — if Stripe is unreachable we report "not entitled". This gates
 * a $1.99 convenience feature, so a brief false negative during a Stripe
 * outage is clearly preferable to handing out paid access on an error.
 */
export async function hasActiveAddon(customerId: string | null | undefined, key: AddonKey): Promise<boolean> {
  const addon = getAddon(key);
  if (!addon.priceId || !customerId) return false;

  try {
    const subscriptions = await listSubscriptionsForCustomer(customerId);
    return subscriptions.some(
      (subscription) =>
        isPaidStatus(subscription.status) &&
        (subscription.items?.data ?? []).some((item) => item.price?.id === addon.priceId),
    );
  } catch {
    return false;
  }
}
