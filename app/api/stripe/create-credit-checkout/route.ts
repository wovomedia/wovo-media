import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getCreditPackByPriceId } from "@/lib/wovo-ai/plans";

function getSiteUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  const fwd = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return fwd ? `${proto}://${fwd}` : url.origin;
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json().catch(() => ({}))) as { priceId?: string };
    const pack = getCreditPackByPriceId(body.priceId);
    if (!pack) return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
    const customerId = await ensureStripeCustomerForUser(String(user.id), user.email);
    const siteUrl = getSiteUrl(request);
    const session = await createCheckoutSession({
      customerId, priceId: pack.priceId, userId: String(user.id),
      successUrl: `${siteUrl}/wovo-ai/buy-credits?success=1`,
      cancelUrl: `${siteUrl}/wovo-ai/buy-credits`,
      mode: "payment",
      metadata: { creditPackPriceId: pack.priceId, email: user.email ?? "", userId: String(user.id) },
    });
    if (!session.url) return NextResponse.json({ error: "Stripe did not return checkout URL." }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create checkout session." }, { status: 500 });
  }
}
