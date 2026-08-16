import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MetaConnection = {
  id: string;
  account_id: string | null;
  owner_scope: boolean;
  page_id: string;
  instagram_user_id: string | null;
};

type NormalizedEvent = {
  provider: "facebook" | "instagram";
  event_kind: "comment" | "message" | "mention" | "unknown";
  provider_event_id: string;
  provider_sender_id: string | null;
  sender_label: string | null;
  body: string | null;
  parent_provider_id: string | null;
  occurred_at: string;
};

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validSignature(rawBody: string, signature: string | null) {
  const secret = getEnv("META_APP_SECRET");
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return safeEqual(signature, expected);
}

function isoFromTimestamp(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  const milliseconds = Number.isFinite(numeric) ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric) : Date.now();
  return new Date(milliseconds).toISOString();
}

function normalizeEntry(object: unknown, entry: Record<string, unknown>): NormalizedEvent[] {
  const provider: "facebook" | "instagram" = object === "instagram" ? "instagram" : "facebook";
  const events: NormalizedEvent[] = [];
  const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
  for (const raw of messaging) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const message = item.message && typeof item.message === "object" ? item.message as Record<string, unknown> : null;
    const sender = item.sender && typeof item.sender === "object" ? item.sender as Record<string, unknown> : null;
    const id = String(message?.mid ?? item.mid ?? "");
    if (!id) continue;
    events.push({ provider, event_kind: "message", provider_event_id: id, provider_sender_id: sender?.id ? String(sender.id) : null, sender_label: null, body: typeof message?.text === "string" ? message.text.slice(0, 20000) : null, parent_provider_id: null, occurred_at: isoFromTimestamp(item.timestamp ?? entry.time) });
  }
  const changes = Array.isArray(entry.changes) ? entry.changes : [];
  for (const raw of changes) {
    if (!raw || typeof raw !== "object") continue;
    const change = raw as Record<string, unknown>;
    const value = change.value && typeof change.value === "object" ? change.value as Record<string, unknown> : {};
    const field = String(change.field ?? "unknown");
    const kind = field.includes("comment") || value.item === "comment" ? "comment" : field.includes("mention") ? "mention" : "unknown";
    const from = value.from && typeof value.from === "object" ? value.from as Record<string, unknown> : null;
    const id = String(value.comment_id ?? value.id ?? value.mid ?? "");
    if (!id) continue;
    events.push({ provider, event_kind: kind, provider_event_id: id, provider_sender_id: from?.id ? String(from.id) : null, sender_label: typeof from?.name === "string" ? from.name.slice(0, 180) : null, body: typeof value.message === "string" ? value.message.slice(0, 20000) : null, parent_provider_id: value.post_id ? String(value.post_id) : value.media_id ? String(value.media_id) : null, occurred_at: isoFromTimestamp(value.created_time ?? entry.time) });
  }
  return events;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode") ?? "";
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = getEnv("META_WEBHOOK_VERIFY_TOKEN");
  if (mode !== "subscribe" || !expected || !safeEqual(token, expected)) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) return new NextResponse("Invalid signature", { status: 401 });
  let payload: { object?: unknown; entry?: Array<Record<string, unknown>> };
  try { payload = JSON.parse(rawBody) as typeof payload; } catch { return new NextResponse("Invalid payload", { status: 400 }); }
  for (const entry of payload.entry ?? []) {
    const destinationId = String(entry.id ?? "");
    if (!destinationId) continue;
    const connections = await supabaseServiceRoleRequest<MetaConnection[]>(`/rest/v1/wovo_meta_connections?select=id,account_id,owner_scope,page_id,instagram_user_id&or=(page_id.eq.${encodeURIComponent(destinationId)},instagram_user_id.eq.${encodeURIComponent(destinationId)})&status=eq.healthy&revoked_at=is.null&limit=1`).catch(() => []);
    const connection = connections?.[0];
    if (!connection) continue;
    const rows = normalizeEntry(payload.object, entry).map((event) => ({ ...event, connection_id: connection.id, account_id: connection.account_id, owner_scope: connection.owner_scope }));
    if (rows.length) await supabaseServiceRoleRequest("/rest/v1/wovo_meta_inbox_events?on_conflict=provider,provider_event_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  }
  return NextResponse.json({ received: true });
}
