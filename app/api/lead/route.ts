import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const webhook = process.env.LEADS_WEBHOOK_URL;
    if (!webhook) {
      return NextResponse.json(
        { error: "Missing LEADS_WEBHOOK_URL in environment." },
        { status: 500 }
      );
    }

    // Forward to Google Apps Script (server-to-server, avoids CORS problems).
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // cache: "no-store" // optional
    });

    // Some Apps Script endpoints return 200/302/redirect responses; treat non-2xx as failure.
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Webhook failed: ${res.status} ${res.statusText}`, details: text.slice(0, 400) },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
