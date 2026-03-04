import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

type UserRow = {
  stripe_customer_id: string | null;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    const users = await supabaseServiceRoleRequest<UserRow[]>(
      `/rest/v1/users?select=stripe_customer_id&id=eq.${user.id}&limit=1`,
    );

    const stripeCustomerId = users?.[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer found." }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const session = await createPortalSession(stripeCustomerId, `${siteUrl}/wovo-ai`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
