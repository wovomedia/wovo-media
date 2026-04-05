import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isPaidStatus } from "@/lib/wovo-ai/plans";

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
    const [profileRows, subRows] = await Promise.all([
      supabaseServiceRoleRequest<Array<{ stripe_customer_id: string | null }>>(`/rest/v1/profiles?select=stripe_customer_id&user_id=eq.${user.id}&limit=1`),
      supabaseServiceRoleRequest<Array<{ status: string | null }>>(`/rest/v1/subscriptions?select=status&user_id=eq.${user.id}&limit=1`),
    ]);
    if (!isPaidStatus(subRows?.[0]?.status)) {
      return NextResponse.json({ error: "No active subscription found." }, { status: 400 });
    }
    const customerId = profileRows?.[0]?.stripe_customer_id ?? null;
    if (!customerId) return NextResponse.json({ error: "No Stripe customer found." }, { status: 400 });
    const session = await createPortalSession(customerId, `${getSiteUrl(request)}/wovo-ai`);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unable to verify session")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
