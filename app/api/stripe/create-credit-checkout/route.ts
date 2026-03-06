import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getCreditPackByPriceId } from "@/lib/wovo-ai/plans";

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
    const body = (await request.json().catch(() => ({}))) as { priceId?: string };
    const selectedPack = getCreditPackByPriceId(body.priceId);

    if (!selectedPack) {
      return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser(user.id, user.email);
    const siteUrl = getSiteUrlFromRequest(request);

    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: selectedPack.priceId,
      userId: user.id,
      successUrl: `${siteUrl}/wovo-ai/buy-credits?success=1`,
      cancelUrl: `${siteUrl}/wovo-ai/buy-credits`,
      mode: "payment",
      metadata: {
        creditPackPriceId: selectedPack.priceId,
        email: user.email,
      },
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
