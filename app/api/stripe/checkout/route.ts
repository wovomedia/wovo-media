import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getAllowedPriceIds } from "@/lib/wovo-ai/plans";

type CheckoutBody = {
  priceId?: string;
};

function getOrigin(request: Request): string {
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
    const body = (await request.json()) as CheckoutBody;
    const priceId = (body.priceId ?? "").trim();

    const allowedPriceIds = getAllowedPriceIds();
    if (!priceId || !allowedPriceIds.includes(priceId)) {
      return NextResponse.json({ error: "Invalid priceId." }, { status: 400 });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser(user.id, user.email);
    const origin = getOrigin(request);

    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      userId: user.id,
      successUrl: `${origin}/wovo-ai?success=1`,
      cancelUrl: `${origin}/wovo-ai?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
