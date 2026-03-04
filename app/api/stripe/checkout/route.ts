import { NextResponse } from "next/server";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { EXTRA_CREDITS_PRICE_ID, getAllowedSubscriptionPriceIds, isPaidStatus } from "@/lib/wovo-ai/plans";
import { getRawSubscription } from "@/lib/wovo-ai/subscription";

type CheckoutBody = {
  priceId?: string;
};

function getSiteUrlFromRequest(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  try {
    const { user } = await requireServerUser(authorization);
    const body = (await request.json()) as CheckoutBody;
    const priceId = (body.priceId ?? "").trim();

    const subscriptionPriceIds = getAllowedSubscriptionPriceIds();
    const isExtraCreditsPurchase = priceId === EXTRA_CREDITS_PRICE_ID;
    if (!priceId || (!subscriptionPriceIds.includes(priceId) && !isExtraCreditsPurchase)) {
      return NextResponse.json({ error: "Invalid priceId." }, { status: 400 });
    }

    const existing = await getRawSubscription(user.id);
    const siteUrl = getSiteUrlFromRequest(request);

    if (!isExtraCreditsPurchase && isPaidStatus(existing?.status) && existing?.stripe_customer_id) {
      const portal = await createPortalSession(existing.stripe_customer_id, `${siteUrl}/wovo-ai`);
      return NextResponse.json({ url: portal.url });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser(user.id, user.email);
    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      userId: user.id,
      successUrl: `${siteUrl}/wovo-ai`,
      cancelUrl: `${siteUrl}/wovo-ai`,
      mode: isExtraCreditsPurchase ? "payment" : "subscription",
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unable to verify session")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
