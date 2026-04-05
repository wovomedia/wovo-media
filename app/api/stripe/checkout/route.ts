import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { EXTRA_CREDITS_PRICE_ID, getAllowedSubscriptionPriceIds, isPaidStatus } from "@/lib/wovo-ai/plans";
import { getRawSubscription } from "@/lib/wovo-ai/subscription";

type LegacyPlan = "starter" | "growth" | "pro" | "standard" | "business";

type CheckoutBody = {
  priceId?: string;
  plan?: LegacyPlan;
  trial_period_days?: number;
};

const LEGACY_PLAN_PRICE_MAP: Record<LegacyPlan, string> = {
  starter:  "price_1T76wyFmIvQosWF9UoGSKAe2",
  growth:   "price_1T76wSFmIvQosWF9u3GWCWBV",
  standard: "price_1T76wSFmIvQosWF9u3GWCWBV",
  pro:      "price_1T76vlFmIvQosWF9gmdPrCVT",
  business: "price_1T76vlFmIvQosWF9gmdPrCVT",
};

function getSiteUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const url = new URL(request.url);
  const fwdHost  = request.headers.get("x-forwarded-host");
  const fwdProto = request.headers.get("x-forwarded-proto") ?? "https";
  return fwdHost ? `${fwdProto}://${fwdHost}` : url.origin;
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  try {
    const { user } = await requireServerUser(authorization);
    const body = (await request.json()) as CheckoutBody;
    const mappedLegacy = body.plan ? LEGACY_PLAN_PRICE_MAP[body.plan] : "";
    const priceId = (body.priceId ?? mappedLegacy ?? "").trim();

    const subscriptionPriceIds = getAllowedSubscriptionPriceIds();
    const isExtraCredits = priceId === EXTRA_CREDITS_PRICE_ID;

    if (!priceId || (!subscriptionPriceIds.includes(priceId) && !isExtraCredits)) {
      return NextResponse.json({ error: "Invalid priceId." }, { status: 400 });
    }

    const existing = await getRawSubscription(user.id);
    if (!isExtraCredits && isPaidStatus(existing?.status)) {
      return NextResponse.json({ error: "Subscription already active. Use /api/stripe/upgrade to change plan." }, { status: 400 });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser(user.id, user.email);
    const siteUrl = getSiteUrl(request);

    // 7-day free trial for all new subscription plans
    const trialDays = isExtraCredits ? 0 : (body.trial_period_days ?? 7);

    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      userId: user.id,
      successUrl: `${siteUrl}/wovo-ai`,
      cancelUrl: `${siteUrl}/wovo-ai/pricing`,
      mode: isExtraCredits ? "payment" : "subscription",
      trialDays: trialDays > 0 ? trialDays : undefined,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unable to verify session")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
