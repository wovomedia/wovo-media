import { NextResponse } from "next/server";
import { authRequestAllowed } from "@/lib/auth/request-limit";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!authRequestAllowed(request, "pricing-deal")) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.company === "string" && body.company.trim()) return NextResponse.json({ accepted: true });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.consent !== true) {
    return NextResponse.json({ error: "Enter a valid email and confirm deal-email consent." }, { status: 400 });
  }
  await supabaseServiceRoleRequest("/rest/v1/wovo_pricing_deal_subscribers?on_conflict=email_normalized", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      email,
      source: body.source === "pricing_inline" ? "pricing_inline" : "pricing_popup",
      consent_text: "I agree to receive WOVO pricing and product deal emails. I can unsubscribe at any time.",
      consented_at: new Date().toISOString(),
      status: "subscribed",
      last_seen_at: new Date().toISOString(),
    }),
  });
  return NextResponse.json({ accepted: true, message: "You’re on the WOVO deals list." }, { status: 201 });
}
