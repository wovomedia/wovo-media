import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isPaidStatus } from "@/lib/wovo-ai/plans";

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
    const rows = await supabaseServiceRoleRequest<Array<{ stripe_customer_id: string | null; status: string | null }>>(
      `/rest/v1/subscriptions?select=stripe_customer_id,status&user_id=eq.${user.id}&limit=1`,
    );

    const row = rows?.[0];
    if (!isPaidStatus(row?.status)) {
      return NextResponse.json({ error: "No active subscription found." }, { status: 400 });
    }

    const stripeCustomerId = row?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer found for this account." }, { status: 400 });
    }

    const session = await createPortalSession(stripeCustomerId, `${getSiteUrlFromRequest(request)}/wovo-ai`);
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
