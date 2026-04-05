import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { VERIFIED_BADGE_CHECKOUT_LINK, VERIFIED_BADGE_PRICE_ID } from "@/lib/wovo-ai/plans";

function isMissingVerifiedBadgeTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("could not find the table") && message.includes("verified_subscriptions")) ||
    (message.includes("relation") && message.includes("verified_subscriptions") && message.includes("does not exist")) ||
    (message.includes("permission denied") && message.includes("verified_subscriptions"))
  );
}

function getSiteUrlFromRequest(request: Request): string {
  const envUrl = getEnv("NEXT_PUBLIC_SITE_URL");
  if (envUrl) return envUrl.replace(/\/$/, "");

  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

async function hasActiveVerifiedBadge(userId: string): Promise<boolean> {
  try {
    const rows = await supabaseServiceRoleRequest<
      Array<{ status: string | null; badge_active: boolean | null; cancel_at_period_end: boolean | null }>
    >(
      `/rest/v1/verified_subscriptions?select=status,badge_active,cancel_at_period_end&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    const row = rows?.[0];
    if (!row) return false;
    if (row.badge_active === true) return true;
    const normalizedStatus = (row.status ?? "").toLowerCase();
    return (normalizedStatus === "active" || normalizedStatus === "trialing") && !Boolean(row.cancel_at_period_end);
  } catch (error) {
    if (isMissingVerifiedBadgeTableError(error)) {
      return false;
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    if (await hasActiveVerifiedBadge(user.id)) {
      return NextResponse.json({ error: "Verified badge is already active." }, { status: 400 });
    }

    const customerId = await ensureStripeCustomerForUser(user.id, user.email);
    const siteUrl = getSiteUrlFromRequest(request);

    const session = await createCheckoutSession({
      customerId,
      priceId: VERIFIED_BADGE_PRICE_ID,
      userId: user.id,
      successUrl: `${siteUrl}/wovo-ai/profile?verified=1`,
      cancelUrl: `${siteUrl}/wovo-ai/profile`,
      mode: "subscription",
      metadata: {
        purchaseType: "verified_badge",
      },
    });

    return NextResponse.json({ url: session.url ?? VERIFIED_BADGE_CHECKOUT_LINK });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create verified checkout session." },
      { status: 500 },
    );
  }
}
