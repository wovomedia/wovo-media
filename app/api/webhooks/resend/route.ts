import { NextResponse } from "next/server";
import { recordResendEvent, verifyResendWebhook } from "@/lib/adam/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const verified = verifyResendWebhook(raw, request.headers);
    const result = await recordResendEvent(verified.id, verified.event);
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
