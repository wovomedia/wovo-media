import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const webhook = process.env.LEADS_WEBHOOK_URL;
    if (!webhook) return NextResponse.json({ error: "Missing LEADS_WEBHOOK_URL" }, { status: 500 });
    const res = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return NextResponse.json({ error: `Webhook failed: ${res.status}` }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
