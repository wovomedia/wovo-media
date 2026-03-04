const STRIPE_API_BASE = "https://api.stripe.com/v1";

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return key;
}

type StripeRequestBody = Record<string, string | number | boolean | undefined | null>;

async function stripeRequest<T>(path: string, body?: StripeRequestBody, method = "POST"): Promise<T> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${getStripeSecretKey()}`);

  const init: RequestInit = { method, headers, cache: "no-store" };

  if (body) {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    init.body = params.toString();
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, init);
  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Stripe request failed (${response.status}).`);
  }

  return payload;
}

export type StripeCheckoutSession = { url: string | null; id: string; customer?: string; subscription?: string };
export type StripePortalSession = { url: string; id: string };

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  current_period_start: number;
  current_period_end: number;
  items?: { data?: Array<{ id: string; price?: { id?: string | null } }> };
};

export async function createStripeCustomer(email: string, userId: string): Promise<{ id: string }> {
  return stripeRequest("/customers", {
    email,
    "metadata[userId]": userId,
  });
}

export async function createCheckoutSession(args: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  mode: "subscription" | "payment";
}): Promise<StripeCheckoutSession> {
  return stripeRequest("/checkout/sessions", {
    mode: args.mode,
    customer: args.customerId,
    "line_items[0][price]": args.priceId,
    "line_items[0][quantity]": 1,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    "metadata[userId]": args.userId,
    "metadata[purchaseType]": args.mode === "payment" ? "extra_credits" : "subscription",
    ...(args.mode === "subscription" ? { "subscription_data[metadata][userId]": args.userId } : {}),
  });
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<StripePortalSession> {
  return stripeRequest("/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest(`/subscriptions/${subscriptionId}`, undefined, "GET");
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
