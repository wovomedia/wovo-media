import { NextResponse } from "next/server";
import { getValidatedPortalBillingOptions } from "@/lib/portal/billing-options";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_accounts?select=id&limit=1");
    const billingOptions = await getValidatedPortalBillingOptions();
    const stripeReady = billingOptions.length === 4;
    if (!stripeReady) throw new Error("Portal price failed validation.");
    return NextResponse.json(
      { ok: true, database: "ready", billing: "ready", billingPeriods: billingOptions.map((option) => option.frequency) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, database: "unavailable", billing: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
