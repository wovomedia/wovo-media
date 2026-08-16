import { NextResponse } from "next/server";
import { authRequestAllowed } from "@/lib/auth/request-limit";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";

type InquiryRow = {
  id: string;
  case_reference: string;
};

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function notifyTeam(caseReference: string): Promise<void> {
  const key = getEnv("RESEND_API_KEY");
  if (!key) return;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "WOVO Media <support@wovomedia.com>",
      to: ["support@wovomedia.com"],
      subject: `New WOVO public inquiry · ${caseReference}`,
      html: `<div style="background:#f3efe6;padding:32px;font-family:Arial,sans-serif;color:#191714"><div style="max-width:560px;margin:auto;background:#fffdf8;border:1px solid #ded6c8;border-radius:18px;padding:28px"><div style="width:48px;height:5px;border-radius:99px;background:#f05a3a"></div><h1 style="font-size:24px;margin:22px 0 10px">A new public inquiry is ready.</h1><p style="line-height:1.6;color:#655f56">Open the authenticated WOVO owner workspace to review and assign case <strong>${caseReference}</strong>. Sensitive inquiry content is not included in this email.</p><a href="https://wovomedia.com/portal#case-${caseReference}" style="display:inline-block;margin-top:16px;background:#191714;color:#fff;text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:700">Open this case</a></div></div>`,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) {
    console.error("Public inquiry notification was not accepted by Resend.", { status: response?.status ?? 0 });
    return;
  }
  console.info("Public inquiry notification accepted by Resend.");
}

export async function POST(request: Request) {
  if (!authRequestAllowed(request, "inquiry")) {
    return NextResponse.json({ error: "Please wait before sending another inquiry." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (clean(body.company, 200)) {
    return NextResponse.json({ accepted: true });
  }
  const name = clean(body.name, 120);
  const email = clean(body.email, 320).toLowerCase();
  const phone = clean(body.phone, 40);
  const subject = clean(body.subject, 160);
  const message = clean(body.message, 5000);
  const consentConfirmed = body.consentConfirmed === true;
  if (
    name.length < 2
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || (phone && phone.length < 7)
    || subject.length < 3
    || message.length < 10
    || !consentConfirmed
  ) {
    return NextResponse.json({ error: "Complete the required fields and consent confirmation." }, { status: 400 });
  }
  const rows = await supabaseServiceRoleRequest<InquiryRow[]>("/rest/v1/wovo_public_inquiries", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name,
      email,
      phone: phone || null,
      subject,
      message,
      consent_confirmed: true,
      assigned_role: "support",
    }),
  });
  const inquiry = rows?.[0];
  if (!inquiry) {
    return NextResponse.json({ error: "The inquiry could not be recorded. Please try again." }, { status: 500 });
  }
  await notifyTeam(inquiry.case_reference);
  return NextResponse.json({
    accepted: true,
    caseReference: inquiry.case_reference,
    message: "Your inquiry is in the WOVO team inbox.",
  }, { status: 201 });
}
