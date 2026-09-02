import { NextResponse } from "next/server";
import { getValidatedPortalBillingOptions } from "@/lib/portal/billing-options";
import { WOVO_PLAN_TERMS } from "@/lib/portal/pricing-catalog";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Checked independently so the response names the subsystem that is actually
// down. A single try/catch used to report the database as unavailable whenever
// price validation failed, which sent every investigation to the wrong place.
export async function GET() {
  let database: "ready" | "unavailable" = "unavailable";
  let billing: "ready" | "unavailable" = "unavailable";
  let validatedPrices = 0;
  let billingPeriods: string[] = [];

  try {
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_accounts?select=id&limit=1");
    database = "ready";
  } catch {
    database = "unavailable";
  }

  try {
    const options = await getValidatedPortalBillingOptions();
    validatedPrices = options.length;
    // Compared against the catalog rather than a literal. The previous check
    // expected four prices and was never updated when the catalog grew to three
    // plans across four billing terms, so it could not pass.
    if (validatedPrices === WOVO_PLAN_TERMS.length) {
      billing = "ready";
      billingPeriods = [...new Set(options.map((option) => option.frequency))];
    }
  } catch {
    billing = "unavailable";
  }

  const ok = database === "ready" && billing === "ready";
  return NextResponse.json(
    {
      ok,
      database,
      billing,
      validatedPrices,
      expectedPrices: WOVO_PLAN_TERMS.length,
      billingPeriods,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
