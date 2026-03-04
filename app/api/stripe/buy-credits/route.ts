import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { EXTRA_CREDITS_PRICE_ID } from "@/lib/wovo-ai/plans";

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
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const stripeCustomerId = await ensureStripeCustomerForUser(user.id, user.email);
    const siteUrl = getSiteUrlFromRequest(request);

    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: EXTRA_CREDITS_PRICE_ID,
      userId: user.id,
      successUrl: `${siteUrl}/wovo-ai`,
      cancelUrl: `${siteUrl}/wovo-ai`,
      mode: "payment",
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create checkout session." }, { status: 500 });
  }
}
