const STRIPE_API_BASE = "https://api.stripe.com/v1";

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return key;
}

type StripeRequestBody = Record<string, string | number | boolean | undefined | null>;

async function stripeRequest<T>(path: string, body?: StripeRequestBody, method = "POST"): Promise<T> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${getStripeSecretKey()}`);
  const init: RequestInit = { method, headers, cache: "no-store" };
  if (body) {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)); });
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    init.body = params.toString();
  }
  const response = await fetch(`${STRIPE_API_BASE}${path}`, init);
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Stripe request failed (${response.status}).`);
  return payload;
}

export type StripeCheckoutSession = { url: string | null; id: string; customer?: string; subscription?: string };
export type StripePortalSession   = { url: string; id: string };
export type StripePrice = {
  id: string;
  active: boolean;
  livemode?: boolean;
  currency: string;
  unit_amount: number | null;
  product?: string | { id: string; name?: string };
  recurring?: { interval?: "day" | "week" | "month" | "year"; interval_count?: number } | null;
};
export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  current_period_start: number;
  current_period_end: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ id: string; price?: { id?: string | null } }> };
};

export async function createStripeCustomer(email: string, userId: string): Promise<{ id: string }> {
  return stripeRequest("/customers", { email, "metadata[userId]": userId });
}

export async function createCheckoutSession(args: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  mode: "subscription" | "payment";
  trialDays?: number;
  metadata?: Record<string, string>;
}): Promise<StripeCheckoutSession> {
  const metaBody = Object.fromEntries(
    Object.entries(args.metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, v])
  );

  const body: StripeRequestBody = {
    mode: args.mode,
    customer: args.customerId,
    "line_items[0][price]": args.priceId,
    "line_items[0][quantity]": 1,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    "metadata[userId]": args.userId,
    "metadata[purchaseType]": args.mode === "payment" ? "extra_credits" : "subscription",
    // Stripe-hosted Checkout supports per-session branding. This keeps the hosted
    // payment surface aligned with WOVO without mutating account-wide settings.
    "branding_settings[display_name]": "WOVO Media",
    "branding_settings[background_color]": "#FFFDF8",
    "branding_settings[button_color]": "#D94326",
    submit_type: args.mode === "subscription" ? "subscribe" : "pay",
    "custom_text[submit][message]": "Renews at the price and cadence shown until canceled. Manage future renewal from WOVO Billing. Cancellation and refund terms: wovomedia.com/cancellation-refund-policy.",
    "custom_text[after_submit][message]": "Access activates after Stripe confirms payment. Manage billing and future cancellation from your WOVO workspace.",
    ...metaBody,
    ...(args.mode === "subscription"
      ? {
          "subscription_data[metadata][userId]": args.userId,
          ...Object.fromEntries(
            Object.entries(args.metadata ?? {}).map(([k, v]) => [`subscription_data[metadata][${k}]`, v])
          ),
        }
      : {}),
  };

  // Add 7-day trial for new subscriptions
  if (args.mode === "subscription" && args.trialDays && args.trialDays > 0) {
    body["subscription_data[trial_period_days]"] = args.trialDays;
  }

  return stripeRequest("/checkout/sessions", body);
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<StripePortalSession> {
  return stripeRequest("/billing_portal/sessions", { customer: customerId, return_url: returnUrl });
}

export async function retrievePrice(priceId: string): Promise<StripePrice> {
  return stripeRequest(`/prices/${encodeURIComponent(priceId)}`, undefined, "GET");
}

export async function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest(`/subscriptions/${subscriptionId}`, undefined, "GET");
}

/**
 * All non-cancelled subscriptions for a customer, with price data expanded.
 *
 * Add-on entitlement is resolved against this rather than against a locally
 * cached flag: there is no Stripe webhook route in this app, so a cached flag
 * would go stale the moment a customer cancels from the billing portal and
 * they would keep paid access indefinitely.
 */
export async function listSubscriptionsForCustomer(customerId: string): Promise<StripeSubscription[]> {
  const payload = await stripeRequest<{ data?: StripeSubscription[] }>(
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100&expand[]=data.items.data.price`,
    undefined,
    "GET",
  );
  return payload.data ?? [];
}

export async function updateSubscriptionPrice(subscriptionId: string, subscriptionItemId: string, newPriceId: string): Promise<StripeSubscription> {
  return stripeRequest(`/subscriptions/${subscriptionId}`, {
    "items[0][id]": subscriptionItemId,
    "items[0][price]": newPriceId,
    proration_behavior: "create_prorations",
  });
}

export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  await stripeRequest(`/subscriptions/${subscriptionId}`, undefined, "DELETE");
}
