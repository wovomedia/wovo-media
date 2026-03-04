import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

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
    const rows = await supabaseServiceRoleRequest<Array<{ stripe_customer_id: string | null }>>(
      `/rest/v1/subscriptions?select=stripe_customer_id&user_id=eq.${user.id}&limit=1`,
    );

    const stripeCustomerId = rows?.[0]?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: "No customer yet" }, { status: 400 });
    }

    const session = await createPortalSession(stripeCustomerId, `${getOrigin(request)}/wovo-ai`);
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
