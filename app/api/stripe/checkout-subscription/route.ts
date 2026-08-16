import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getAllowedSubscriptionPriceIds, WOVO_AI_PRICES } from "@/lib/wovo-ai/plans";

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as { plan?: "starter" | "growth" | "pro"; priceId?: string };
    const priceId = body.priceId ?? (body.plan ? WOVO_AI_PRICES[body.plan] : "");
    if (!getAllowedSubscriptionPriceIds().includes(priceId)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const customerId = await ensureStripeCustomerForUser(user.id, user.email);
    const siteUrl = getEnv("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "") || new URL(request.url).origin;
    const session = await createCheckoutSession({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${siteUrl}/wovo-ai`,
      cancelUrl: `${siteUrl}/wovo-ai/pricing`,
      mode: "subscription",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create checkout session." }, { status: 500 });
  }
}
