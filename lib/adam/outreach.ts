import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getEnv, getEnvAny } from "@/lib/env";
import { ADAM_AI_DISCLOSURE, ADAM_OUTREACH_ADDRESS, ADAM_OUTREACH_SIGNATURE, ADAM_SENDER_IDENTITY } from "@/lib/adam/identity";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

type OutreachMessage = {
  id: string;
  adam_workspace_id: string;
  campaign_id: string;
  lead_id: string;
  idempotency_key: string;
  recipient_email: string;
  recipient_hash: string;
  source_url: string;
  source_retrieved_at: string;
  status: string;
  provider_message_id: string | null;
  attempt_count: number;
};

type Campaign = {
  id: string;
  adam_workspace_id: string;
  subject_template: string;
  message_template: string;
  opt_out_copy: string | null;
  launch_enabled: boolean;
  kill_switch: boolean;
  daily_rate_limit: number;
  daily_spend_cap_cents: number;
  sender_authorized: boolean;
  audience_approved: boolean;
  template_approved: boolean;
  compliance_reviewed: boolean;
  rate_policy_approved: boolean;
  sender_domain_verified_at: string | null;
  webhook_verified_at: string | null;
  unsubscribe_verified_at: string | null;
  test_delivery_verified_at: string | null;
  reply_handling_verified_at: string | null;
};

type Lead = {
  id: string;
  adam_workspace_id: string;
  business_name: string;
  website_url: string | null;
  public_business_email: string | null;
  source_url: string;
  location: string;
  status: string;
  created_at: string;
  created_by: string;
};

export function outreachRuntimeStatus() {
  const required = {
    resendApi: Boolean(getEnv("RESEND_API_KEY")),
    signedWebhook: Boolean(getEnv("RESEND_WEBHOOK_SECRET")),
    unsubscribeSigning: /^[a-f0-9]{64}$/i.test(getEnv("WOVO_OUTREACH_UNSUBSCRIBE_SECRET")),
    senderAddress: getEnv("WOVO_ADAM_OUTREACH_SENDER").toLowerCase() === ADAM_OUTREACH_ADDRESS,
    explicitFeatureGate: getEnv("WOVO_OUTREACH_ENABLED") === "true",
  };
  return { ...required, ready: Object.values(required).every(Boolean) };
}

export function hashRecipient(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function unsubscribeSecret() {
  const value = getEnv("WOVO_OUTREACH_UNSUBSCRIBE_SECRET");
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("OUTREACH_UNSUBSCRIBE_NOT_CONFIGURED");
  return Buffer.from(value, "hex");
}

export function createUnsubscribeToken(messageId: string) {
  const signature = createHmac("sha256", unsubscribeSecret()).update(`wovo-outreach:${messageId}`).digest("base64url");
  return `${messageId}.${signature}`;
}

export function verifyUnsubscribeToken(token: string) {
  const [messageId, supplied] = token.split(".");
  if (!/^[0-9a-f-]{36}$/i.test(messageId || "") || !supplied) return null;
  const expected = createHmac("sha256", unsubscribeSecret()).update(`wovo-outreach:${messageId}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(supplied, "base64url"); } catch { return null; }
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? messageId : null;
}

function webhookSecretBytes() {
  const value = getEnv("RESEND_WEBHOOK_SECRET");
  if (!value) throw new Error("RESEND_WEBHOOK_NOT_CONFIGURED");
  const encoded = value.startsWith("whsec_") ? value.slice(6) : value;
  return Buffer.from(encoded, "base64");
}

export function verifyResendWebhook(payload: string, headers: Headers) {
  const id = headers.get("svix-id") ?? "";
  const timestamp = headers.get("svix-timestamp") ?? "";
  const signatureHeader = headers.get("svix-signature") ?? "";
  if (!id || !/^\d+$/.test(timestamp) || !signatureHeader) throw new Error("INVALID_WEBHOOK_HEADERS");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 5 * 60) throw new Error("STALE_WEBHOOK");
  const expected = createHmac("sha256", webhookSecretBytes()).update(`${id}.${timestamp}.${payload}`).digest();
  const valid = signatureHeader.split(" ").some((part) => {
    const encoded = part.startsWith("v1,") ? part.slice(3) : "";
    if (!encoded) return false;
    try {
      const supplied = Buffer.from(encoded, "base64");
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    } catch { return false; }
  });
  if (!valid) throw new Error("INVALID_WEBHOOK_SIGNATURE");
  return { id, event: JSON.parse(payload) as { type: string; created_at: string; data?: { email_id?: string; from?: string; to?: string[] } } };
}

export async function recordResendEvent(providerEventId: string, event: { type: string; created_at: string; data?: { email_id?: string; from?: string; to?: string[] } }) {
  const providerMessageId = event.data?.email_id ?? null;
  let messages: OutreachMessage[] = [];
  if (providerMessageId) {
    messages = (await supabaseServiceRoleRequest<OutreachMessage[]>(`/rest/v1/wovo_adam_outreach_messages?select=*&provider=eq.resend&provider_message_id=eq.${encodeURIComponent(providerMessageId)}&limit=1`).catch(() => [])) ?? [];
  }
  if (!messages[0] && event.type === "email.received" && event.data?.from) {
    const address = event.data.from.match(/<([^>]+)>/)?.[1] ?? event.data.from;
    messages = (await supabaseServiceRoleRequest<OutreachMessage[]>(`/rest/v1/wovo_adam_outreach_messages?select=*&recipient_hash=eq.${hashRecipient(address)}&status=in.(sent,delivered)&order=sent_at.desc&limit=1`).catch(() => [])) ?? [];
  }
  const message = messages[0];
  if (!message) return { accepted: true, matched: false };
  const createdAt = new Date(event.created_at || Date.now()).toISOString();
  const inserted = await supabaseServiceRoleRequest<Array<{ id: string }>>("/rest/v1/wovo_adam_outreach_webhook_events?on_conflict=provider,provider_event_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ adam_workspace_id: message.adam_workspace_id, message_id: message.id, provider: "resend", provider_event_id: providerEventId, event_type: event.type, provider_message_id: providerMessageId, event_created_at: createdAt, metadata: { matched: true } }) });
  if (!inserted?.[0]) return { accepted: true, matched: true, duplicate: true };
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (event.type === "email.delivered") Object.assign(updates, { status: "delivered", delivered_at: createdAt });
  if (event.type === "email.delivery_delayed") Object.assign(updates, { status: "delayed" });
  if (event.type === "email.bounced") Object.assign(updates, { status: "bounced", bounced_at: createdAt });
  if (event.type === "email.complained") Object.assign(updates, { status: "complained", complained_at: createdAt });
  if (event.type === "email.failed") Object.assign(updates, { status: "failed", last_error_code: "RESEND_FAILED", last_error_summary: "The provider reported a failed outreach delivery." });
  if (event.type === "email.received") Object.assign(updates, { status: "replied", replied_at: createdAt });
  await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_outreach_messages?id=eq.${encodeURIComponent(message.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(updates) });
  if (["email.bounced", "email.complained"].includes(event.type)) {
    const leads = await supabaseServiceRoleRequest<Lead[]>(`/rest/v1/wovo_adam_leads?select=*&id=eq.${encodeURIComponent(message.lead_id)}&limit=1`).catch(() => []);
    const lead = leads?.[0];
    if (lead) {
      await supabaseServiceRoleRequest("/rest/v1/wovo_adam_suppressions?on_conflict=adam_workspace_id,suppression_key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ adam_workspace_id: message.adam_workspace_id, lead_id: lead.id, suppression_key: message.recipient_hash, reason: event.type === "email.complained" ? "Provider complaint" : "Permanent provider bounce", created_by: lead.created_by }) }).catch(() => null);
      await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_leads?id=eq.${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "suppressed", suppression_reason: event.type, suppressed_at: createdAt, updated_at: new Date().toISOString() }) }).catch(() => null);
    }
  }
  return { accepted: true, matched: true, duplicate: false };
}

export async function unsubscribeOutreach(token: string) {
  const messageId = verifyUnsubscribeToken(token);
  if (!messageId) return false;
  const rows = await supabaseServiceRoleRequest<OutreachMessage[]>(`/rest/v1/wovo_adam_outreach_messages?select=*&id=eq.${encodeURIComponent(messageId)}&limit=1`).catch(() => []);
  const message = rows?.[0];
  if (!message) return false;
  const now = new Date().toISOString();
  const leads = await supabaseServiceRoleRequest<Lead[]>(`/rest/v1/wovo_adam_leads?select=*&id=eq.${encodeURIComponent(message.lead_id)}&limit=1`).catch(() => []);
  const lead = leads?.[0];
  if (lead) {
    await supabaseServiceRoleRequest("/rest/v1/wovo_adam_suppressions?on_conflict=adam_workspace_id,suppression_key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ adam_workspace_id: message.adam_workspace_id, lead_id: lead.id, suppression_key: message.recipient_hash, reason: "Recipient unsubscribed", created_by: lead.created_by }) }).catch(() => null);
    await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_leads?id=eq.${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "suppressed", suppression_reason: "recipient_unsubscribed", suppressed_at: now, updated_at: now }) }).catch(() => null);
  }
  await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_outreach_messages?id=eq.${encodeURIComponent(message.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "unsubscribed", unsubscribed_at: now, updated_at: now }) });
  return true;
}

function renderTemplate(value: string, lead: Lead) {
  return value.replaceAll("{{business_name}}", lead.business_name).replaceAll("{{website}}", lead.website_url ?? "").replaceAll("{{location}}", lead.location);
}

function campaignIsReady(campaign: Campaign) {
  return campaign.launch_enabled && !campaign.kill_switch && campaign.sender_authorized && campaign.audience_approved && campaign.template_approved && campaign.compliance_reviewed && campaign.rate_policy_approved && Boolean(campaign.sender_domain_verified_at && campaign.webhook_verified_at && campaign.unsubscribe_verified_at && campaign.test_delivery_verified_at && campaign.reply_handling_verified_at);
}

export async function processOutreachQueue(limit = 5) {
  const runtime = outreachRuntimeStatus();
  if (!runtime.ready) return { sent: 0, blocked: "runtime_not_verified" };
  const messages = await supabaseServiceRoleRequest<OutreachMessage[]>(`/rest/v1/wovo_adam_outreach_messages?select=*&status=eq.queued&order=created_at.asc&limit=${Math.max(1, Math.min(limit, 5))}`).catch(() => []);
  let sent = 0;
  for (const message of messages ?? []) {
    const [campaigns, leads, suppressions] = await Promise.all([
      supabaseServiceRoleRequest<Campaign[]>(`/rest/v1/wovo_adam_campaign_drafts?select=*&id=eq.${encodeURIComponent(message.campaign_id)}&adam_workspace_id=eq.${encodeURIComponent(message.adam_workspace_id)}&limit=1`).catch(() => []),
      supabaseServiceRoleRequest<Lead[]>(`/rest/v1/wovo_adam_leads?select=*&id=eq.${encodeURIComponent(message.lead_id)}&adam_workspace_id=eq.${encodeURIComponent(message.adam_workspace_id)}&limit=1`).catch(() => []),
      supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_adam_suppressions?select=id&adam_workspace_id=eq.${encodeURIComponent(message.adam_workspace_id)}&suppression_key=eq.${message.recipient_hash}&active=eq.true&limit=1`).catch(() => []),
    ]);
    const campaign = campaigns?.[0]; const lead = leads?.[0];
    if (!campaign || !lead || !campaignIsReady(campaign) || suppressions?.[0] || lead.status === "suppressed") continue;
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const sentToday = await supabaseServiceRoleRequest<Array<{ actual_cost_micros: number | null }>>(`/rest/v1/wovo_adam_outreach_messages?select=actual_cost_micros&campaign_id=eq.${campaign.id}&sent_at=gte.${encodeURIComponent(dayStart.toISOString())}&limit=100`).catch(() => []);
    if ((sentToday?.length ?? 0) >= campaign.daily_rate_limit) continue;
    if ((sentToday ?? []).reduce((sum, row) => sum + (row.actual_cost_micros ?? 0), 0) >= campaign.daily_spend_cap_cents * 10_000) continue;
    const locked = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_adam_outreach_messages?id=eq.${message.id}&status=eq.queued`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "sending", attempt_count: message.attempt_count + 1, updated_at: new Date().toISOString() }) });
    if (!locked?.[0]) continue;
    const unsubscribeUrl = `${getEnvAny(["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"]).replace(/\/$/, "")}/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(message.id))}`;
    const text = `${renderTemplate(campaign.message_template, lead)}\n\n${ADAM_AI_DISCLOSURE}\n\n${ADAM_OUTREACH_SIGNATURE}\n\n${campaign.opt_out_copy ?? "You can stop future outreach at any time."}\n${unsubscribeUrl}`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotency_key }, body: JSON.stringify({ from: `${ADAM_SENDER_IDENTITY} <${ADAM_OUTREACH_ADDRESS}>`, to: [message.recipient_email], reply_to: ADAM_OUTREACH_ADDRESS, subject: renderTemplate(campaign.subject_template, lead), text, headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }) });
    if (!response.ok) {
      await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_outreach_messages?id=eq.${message.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", last_error_code: `RESEND_HTTP_${response.status}`, last_error_summary: "Provider rejected the outreach request.", updated_at: new Date().toISOString() }) });
      continue;
    }
    const result = await response.json() as { id?: string };
    if (!result.id) continue;
    const now = new Date().toISOString();
    await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_outreach_messages?id=eq.${message.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "sent", provider_message_id: result.id, sent_at: now, updated_at: now }) });
    sent += 1;
  }
  return { sent, blocked: null };
}

export function outreachIdempotencyKey(campaignId: string, leadId: string) {
  return `adam_outreach_${createHash("sha256").update(`${campaignId}:${leadId}`).digest("hex").slice(0, 48)}`;
}

export function newOutreachMessageId() { return randomUUID(); }
