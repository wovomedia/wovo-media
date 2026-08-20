import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { creativeForDate, signMetaCreative } from "@/lib/meta/creative";
import { decryptMetaToken, metaGraph } from "@/lib/meta/integration";
import { getEnv } from "@/lib/env";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export type MetaConnection = {
  id: string; account_id: string | null; owner_scope: boolean; status: string; action_policy: string;
  page_id: string; page_name: string; instagram_user_id: string | null; instagram_username: string | null;
  token_ciphertext: string; token_iv: string; token_tag: string; token_expires_at: string | null; kill_switch: boolean;
  last_checked_at: string; last_action_at: string | null; last_error_code: string | null;
  connected_by: string; auto_publish_timezone: string; auto_publish_hour: number; auto_publish_last_slot: string | null;
  auto_publish_slots: number[]; auto_publish_last_slot_key: string | null;
  granted_scopes: string[]; e2e_verified_at: string | null; e2e_verified_provider_post_id: string | null;
  auto_publish_opted_in_at: string | null;
};

export type MetaPublishJob = {
  id: string; connection_id: string; destination: string; caption: string; media_url: string | null;
  attempt_count: number; scheduled_for?: string | null;
};

const AUTOMATION_DELIVERY_WINDOW_MS = 75 * 60 * 1000;

function safeProviderErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "META_PUBLISH_FAILED";
  return message.split(":")[0].replace(/[^A-Z0-9_]/gi, "_").slice(0, 80) || "META_PUBLISH_FAILED";
}

export async function loadMetaConnection(options: { accountId?: string; ownerScope?: boolean }) {
  const filter = options.ownerScope ? "owner_scope=eq.true&account_id=is.null" : `owner_scope=eq.false&account_id=eq.${encodeURIComponent(options.accountId || "")}`;
  const rows = await supabaseServiceRoleRequest<MetaConnection[]>(`/rest/v1/wovo_meta_connections?select=*&${filter}&limit=1`).catch(() => []);
  return rows?.[0] ?? null;
}

async function waitForInstagramContainer(containerId: string, token: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await metaGraph<{ status_code?: string }>(`${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`, token);
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`META_CONTAINER_${status.status_code}`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("META_CONTAINER_TIMEOUT");
}

export async function publishMetaJob(job: MetaPublishJob, options: { explicitApproval?: boolean } = {}) {
  const rows = await supabaseServiceRoleRequest<MetaConnection[]>(`/rest/v1/wovo_meta_connections?select=*&id=eq.${encodeURIComponent(job.connection_id)}&status=eq.healthy&kill_switch=eq.false&limit=1`).catch(() => []);
  const connection = rows?.[0];
  if (!connection) throw new Error("META_CONNECTION_NOT_ACTIONABLE");
  if (options.explicitApproval) {
    if (connection.action_policy === "draft_only") throw new Error("META_POLICY_DRAFT_ONLY");
  } else if (connection.action_policy !== "scheduled_auto_publish" || !connection.auto_publish_opted_in_at) {
    throw new Error("META_AUTOMATION_NOT_AUTHORIZED");
  }
  const token = decryptMetaToken(connection);
  const locked = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_meta_publish_jobs?id=eq.${encodeURIComponent(job.id)}&status=in.(approved,queued)`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "publishing", attempt_count: Math.min((job.attempt_count ?? 0) + 1, 5), updated_at: new Date().toISOString() }) });
  if (!locked?.[0]) throw new Error("META_JOB_ALREADY_CLAIMED");
  try {
    let providerPostId: string;
    if (job.destination === "facebook_page") {
      const path = job.media_url ? `${connection.page_id}/photos` : `${connection.page_id}/feed`;
      const body = new URLSearchParams({ message: job.caption, access_token: token });
      if (job.media_url) body.set("url", job.media_url);
      const result = await metaGraph<{ id: string }>(path, token, { method: "POST", body });
      providerPostId = result.id;
    } else {
      if (!connection.instagram_user_id || !job.media_url) throw new Error("META_INSTAGRAM_MEDIA_REQUIRED");
      const isVideo = /\.(mp4|mov)(?:\?|$)/i.test(job.media_url);
      const fields = new URLSearchParams({ caption: job.caption, access_token: token });
      if (isVideo) {
        fields.set("media_type", "REELS");
        fields.set("video_url", job.media_url);
        fields.set("share_to_feed", "true");
      } else {
        fields.set("image_url", job.media_url);
      }
      const container = await metaGraph<{ id: string }>(`${connection.instagram_user_id}/media`, token, { method: "POST", body: fields });
      await waitForInstagramContainer(container.id, token);
      const published = await metaGraph<{ id: string }>(`${connection.instagram_user_id}/media_publish`, token, { method: "POST", body: new URLSearchParams({ creation_id: container.id, access_token: token }) });
      providerPostId = published.id;
    }
    const now = new Date().toISOString();
    await Promise.all([
      supabaseServiceRoleRequest(`/rest/v1/wovo_meta_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "published", provider_post_id: providerPostId, published_at: now, last_error_code: null, last_error_summary: null, updated_at: now }) }),
      supabaseServiceRoleRequest(`/rest/v1/wovo_meta_connections?id=eq.${encodeURIComponent(connection.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_action_at: now, last_checked_at: now, last_error_code: null, e2e_verified_at: connection.e2e_verified_at ?? now, e2e_verified_provider_post_id: connection.e2e_verified_provider_post_id ?? providerPostId, updated_at: now }) }),
    ]);
    return { providerPostId };
  } catch (error) {
    const summary = error instanceof Error ? error.message.slice(0, 240) : "Meta publishing failed.";
    await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", last_error_code: summary.split(":")[0], last_error_summary: "Meta did not accept this post. Nothing is marked published.", updated_at: new Date().toISOString() }) }).catch(() => null);
    throw error;
  }
}

export async function processMetaPublishJobs(limit = 3, options: { now?: Date } = {}) {
  const clock = options.now ?? new Date();
  const now = clock.toISOString();
  const recentCutoff = new Date(clock.getTime() - AUTOMATION_DELIVERY_WINDOW_MS).toISOString();
  // Automated delivery deliberately ignores stale jobs. This prevents a recovered
  // worker from bursting old scheduled posts after an outage. Those items remain
  // visible in the owner ledger for an explicit reschedule or cancellation.
  const jobs = await supabaseServiceRoleRequest<MetaPublishJob[]>(
    `/rest/v1/wovo_meta_publish_jobs?select=id,connection_id,destination,caption,media_url,attempt_count,scheduled_for&connection_id=not.is.null&source=eq.scheduled_automation&status=in.(approved,queued)&scheduled_for=not.is.null&scheduled_for=gte.${encodeURIComponent(recentCutoff)}&scheduled_for=lte.${encodeURIComponent(now)}&order=scheduled_for.asc&limit=${Math.max(1, Math.min(limit, 6))}`,
  );
  let published = 0;
  const failures: Array<{ jobId: string; code: string }> = [];
  for (const job of jobs ?? []) {
    try {
      await publishMetaJob(job);
      published += 1;
    } catch (error) {
      failures.push({ jobId: job.id, code: safeProviderErrorCode(error) });
    }
  }
  return { found: jobs?.length ?? 0, published, failed: failures.length, failures };
}

function localDateParts(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
}

function contentHash(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");
}

export async function enqueueWovoDailyImagePost(options: { force?: boolean; now?: Date } = {}) {
  const connection = await loadMetaConnection({ ownerScope: true });
  if (!connection || connection.status !== "healthy" || connection.kill_switch || connection.action_policy !== "scheduled_auto_publish") {
    return { enqueued: 0, reason: "policy_not_enabled" };
  }
  if (!connection.instagram_user_id) return { enqueued: 0, reason: "instagram_not_connected" };
  const local = localDateParts(connection.auto_publish_timezone || "America/Chicago", options.now);
  const slots = connection.auto_publish_slots?.length === 3 ? connection.auto_publish_slots : [9, 13, 18];
  const slotIndex = options.force ? Math.max(0, slots.indexOf(local.hour)) : slots.indexOf(local.hour);
  if (!options.force && slotIndex < 0) {
    return { enqueued: 0, reason: "not_due" };
  }
  const slotHour = slots[Math.max(0, slotIndex)];
  const slotKey = `${local.date}:${String(slotHour).padStart(2, "0")}`;
  if (!options.force && connection.auto_publish_last_slot_key === slotKey) {
    return { enqueued: 0, reason: "slot_already_processed" };
  }

  const existing = await supabaseServiceRoleRequest<Array<{ idempotency_key: string }>>(
    `/rest/v1/wovo_meta_publish_jobs?select=idempotency_key&owner_scope=eq.true&account_id=is.null&idempotency_key=like.${encodeURIComponent(`wovo-daily-image:${local.date}:*`)}`,
  ).catch(() => []);
  const usedSlots = new Set((existing ?? []).map((row) => row.idempotency_key.split(":")[2]).filter(Boolean));
  if (!options.force && usedSlots.size >= 3) return { enqueued: 0, reason: "daily_limit_reached" };

  const creative = creativeForDate(local.date, Math.max(0, slotIndex));
  const captionHash = contentHash(creative.caption);
  const topicHash = contentHash(creative.campaignKey);
  const recentTopicCollision = await supabaseServiceRoleRequest<Array<{ id: string }>>(
    `/rest/v1/wovo_meta_publish_jobs?select=id&owner_scope=eq.true&account_id=is.null&topic_hash=eq.${topicHash}&created_at=gte.${encodeURIComponent(new Date((options.now ?? new Date()).getTime() - 48 * 60 * 60 * 1000).toISOString())}&status=not.eq.canceled&limit=1`,
  ).catch(() => []);
  if (recentTopicCollision?.[0]) return { enqueued: 0, reason: "topic_collision_requires_rewrite", topic: creative.campaignKey };
  const siteUrl = (getEnv("NEXT_PUBLIC_APP_URL") || getEnv("NEXT_PUBLIC_SITE_URL") || "https://wovomedia.com").replace(/\/$/, "");
  const destinations = ["facebook_page", "instagram"] as const;
  let enqueued = 0;
  for (const destination of destinations) {
    const idempotencyKey = `wovo-daily-image:${local.date}:${String(slotHour).padStart(2, "0")}:${destination}`;
    const jobId = randomUUID();
    const mediaUrl = `${siteUrl}/api/integrations/meta/creative/${jobId}?signature=${signMetaCreative(jobId)}`;
    const created = await supabaseServiceRoleRequest<Array<{ id: string }>>("/rest/v1/wovo_meta_publish_jobs?on_conflict=account_id,owner_scope,idempotency_key", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        id: jobId,
        account_id: null,
        owner_scope: true,
        connection_id: connection.id,
        created_by: connection.connected_by,
        idempotency_key: idempotencyKey,
        destination,
        status: "queued",
        source: "scheduled_automation",
        caption: creative.caption,
        normalized_caption_hash: captionHash,
        topic_hash: topicHash,
        creative_hash: contentHash(`${creative.kicker}|${creative.headline}|${creative.cta}`),
        content_format: "single_image",
        media_url: mediaUrl,
        campaign_key: creative.campaignKey,
        creative_kicker: creative.kicker,
        creative_headline: creative.headline,
        creative_cta: creative.cta,
        approved_at: new Date().toISOString(),
        approved_by: connection.connected_by,
        rights_confirmed: true,
        scheduled_for: new Date().toISOString(),
      }),
    });
    const job = created?.[0];
    if (!job) continue;
    enqueued += 1;
  }
  if (enqueued > 0) {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_connections?id=eq.${encodeURIComponent(connection.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ auto_publish_last_slot: local.date, auto_publish_last_slot_key: slotKey, updated_at: new Date().toISOString() }),
    });
  }
  return { enqueued, date: local.date, slotHour, campaignKey: creative.campaignKey };
}
