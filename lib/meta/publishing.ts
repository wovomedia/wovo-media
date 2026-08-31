import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { creativeForDate, videoPromptForCreative, type WovoDailyCreative } from "@/lib/meta/creative";
import { decryptMetaToken, metaGraph } from "@/lib/meta/integration";
import { getEnv } from "@/lib/env";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { createFalVideoJob } from "@/lib/wovo-ai/fal-video";
import { asRecord, asString } from "@/lib/wovo-ai/feed-utils";
import { signedMediaUrl } from "@/lib/wovo-ai/media-token";

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
  attempt_count: number; scheduled_for?: string | null; source?: string; content_format?: string;
};

type AutomationVideoJob = {
  id: string;
  user_id: string;
  provider_job_id: string | null;
  status: string;
  result_payload: Record<string, unknown> | null;
  created_at?: string;
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

export async function loadMetaConnections(options: { accountId?: string; ownerScope?: boolean }) {
  const filter = options.ownerScope ? "owner_scope=eq.true&account_id=is.null" : `owner_scope=eq.false&account_id=eq.${encodeURIComponent(options.accountId || "")}`;
  const rows = await supabaseServiceRoleRequest<MetaConnection[]>(`/rest/v1/wovo_meta_connections?select=*&${filter}&status=eq.healthy&revoked_at=is.null&order=created_at.desc&limit=100`).catch(() => []);
  return rows ?? [];
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

function isVideoMediaUrl(value: string | null | undefined) {
  return Boolean(value && /\.(mp4|mov)(?:\?|$)/i.test(value));
}

async function publishFacebookReel(connection: MetaConnection, mediaUrl: string, caption: string, token: string) {
  const initialized = await metaGraph<{ video_id?: string; upload_url?: string }>(`${connection.page_id}/video_reels`, token, {
    method: "POST",
    body: new URLSearchParams({ upload_phase: "start", access_token: token }),
  });
  const videoId = initialized.video_id?.trim() ?? "";
  const uploadUrl = initialized.upload_url?.trim() ?? "";
  if (!videoId || !uploadUrl) throw new Error("META_REEL_UPLOAD_SESSION_INVALID");
  const parsedUploadUrl = new URL(uploadUrl);
  if (parsedUploadUrl.protocol !== "https:" || parsedUploadUrl.hostname !== "rupload.facebook.com") {
    throw new Error("META_REEL_UPLOAD_HOST_INVALID");
  }

  const uploaded = await metaGraph<{ success?: boolean }>(uploadUrl, token, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      file_url: mediaUrl,
    },
  });
  if (uploaded.success !== true) throw new Error("META_REEL_UPLOAD_NOT_CONFIRMED");

  const finished = await metaGraph<{ success?: boolean }>(`${connection.page_id}/video_reels`, token, {
    method: "POST",
    body: new URLSearchParams({
      access_token: token,
      video_id: videoId,
      upload_phase: "finish",
      video_state: "PUBLISHED",
      description: caption,
    }),
  });
  if (finished.success !== true) throw new Error("META_REEL_PUBLISH_NOT_CONFIRMED");
  return videoId;
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
      if (job.content_format === "reel" || isVideoMediaUrl(job.media_url)) {
        providerPostId = await publishFacebookReel(connection, job.media_url!, job.caption, token);
      } else {
        const path = job.media_url ? `${connection.page_id}/photos` : `${connection.page_id}/feed`;
        const body = new URLSearchParams({ message: job.caption, access_token: token });
        if (job.media_url) body.set("url", job.media_url);
        const result = await metaGraph<{ id: string }>(path, token, { method: "POST", body });
        providerPostId = result.id;
      }
    } else {
      if (!connection.instagram_user_id || !job.media_url) throw new Error("META_INSTAGRAM_MEDIA_REQUIRED");
      const isVideo = job.content_format === "reel" || isVideoMediaUrl(job.media_url);
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
    `/rest/v1/wovo_meta_publish_jobs?select=id,connection_id,destination,caption,media_url,attempt_count,scheduled_for,source,content_format&connection_id=not.is.null&source=in.(scheduled_automation,manual)&status=eq.queued&scheduled_for=not.is.null&scheduled_for=gte.${encodeURIComponent(recentCutoff)}&scheduled_for=lte.${encodeURIComponent(now)}&order=scheduled_for.asc&limit=${Math.max(1, Math.min(limit, 6))}`,
  );
  let published = 0;
  const failures: Array<{ jobId: string; code: string }> = [];
  for (const job of jobs ?? []) {
    try {
      // A queued job reaches this worker only after the owner approved the exact
      // version and selected its publish time. Treat that durable approval as the
      // explicit action; generated drafts never enter this state automatically.
      await publishMetaJob(job, { explicitApproval: true });
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

function automationSlot(payload: Record<string, unknown> | null) {
  return asString(asRecord(payload).metaSlotKey);
}

function safeCreative(payload: Record<string, unknown> | null): WovoDailyCreative | null {
  const value = asRecord(asRecord(payload).metaCreative);
  const campaignKey = asString(value.campaignKey);
  const caption = asString(value.caption);
  const kicker = asString(value.kicker);
  const headline = asString(value.headline);
  const cta = asString(value.cta);
  const hashtags = Array.isArray(value.hashtags)
    ? value.hashtags.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
  if (!campaignKey || !caption || !kicker || !headline || !cta || hashtags.length !== 3) return null;
  return { campaignKey, caption, kicker, headline, cta, hashtags };
}

export async function enqueueWovoDailyVideoDraft(options: { force?: boolean; now?: Date } = {}) {
  const connection = await loadMetaConnection({ ownerScope: true });
  if (!connection || connection.status !== "healthy" || connection.kill_switch || connection.action_policy !== "scheduled_auto_publish") {
    return { enqueued: 0, reason: "policy_not_enabled" };
  }
  if (!connection.instagram_user_id) return { enqueued: 0, reason: "instagram_not_connected" };
  if (getEnv("WOVO_VIDEO_GENERATION_ENABLED") !== "true" || !(getEnv("FAL_KEY") || getEnv("FAL_API_KEY"))) {
    return { enqueued: 0, reason: "video_provider_not_enabled" };
  }
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

  const [existingPublishing, existingVideos] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ idempotency_key: string }>>(
      `/rest/v1/wovo_meta_publish_jobs?select=idempotency_key&owner_scope=eq.true&account_id=is.null&idempotency_key=like.${encodeURIComponent(`wovo-daily-*:${local.date}:*`)}`,
    ).catch(() => []),
    supabaseServiceRoleRequest<AutomationVideoJob[]>(
      `/rest/v1/video_jobs?select=id,user_id,provider_job_id,status,result_payload,created_at&user_id=eq.${encodeURIComponent(connection.connected_by)}&created_at=gte.${encodeURIComponent(new Date((options.now ?? new Date()).getTime() - 48 * 60 * 60 * 1000).toISOString())}&order=created_at.desc&limit=100`,
    ).catch(() => []),
  ]);
  const usedSlots = new Set<string>();
  for (const row of existingPublishing ?? []) {
    const parts = row.idempotency_key.split(":");
    if (parts[1] === local.date && parts[2]) usedSlots.add(parts[2]);
  }
  for (const row of existingVideos ?? []) {
    const key = automationSlot(row.result_payload);
    const parts = key.split(":");
    if (parts[0] === local.date && parts[1] && row.status !== "failed") usedSlots.add(parts[1]);
  }
  if (!options.force && usedSlots.size >= 3) return { enqueued: 0, reason: "daily_limit_reached" };
  const slotLabel = String(slotHour).padStart(2, "0");
  if ((existingVideos ?? []).some((row) => automationSlot(row.result_payload) === `${local.date}:${slotLabel}` && row.status !== "failed")) {
    return { enqueued: 0, reason: "slot_already_generated" };
  }

  const creative = creativeForDate(local.date, Math.max(0, slotIndex));
  const topicHash = contentHash(creative.campaignKey);
  const recentTopicCollision = await supabaseServiceRoleRequest<Array<{ id: string }>>(
    `/rest/v1/wovo_meta_publish_jobs?select=id&owner_scope=eq.true&account_id=is.null&topic_hash=eq.${topicHash}&created_at=gte.${encodeURIComponent(new Date((options.now ?? new Date()).getTime() - 48 * 60 * 60 * 1000).toISOString())}&status=not.eq.canceled&limit=1`,
  ).catch(() => []);
  if (recentTopicCollision?.[0]) return { enqueued: 0, reason: "topic_collision_requires_rewrite", topic: creative.campaignKey };
  const jobId = randomUUID();
  const basePayload = {
    wovoMetaAutomation: true,
    metaSlotKey: `${local.date}:${slotLabel}`,
    metaConnectionId: connection.id,
    metaCreative: creative,
    topicHash,
    ownerExempt: true,
    reviewRequired: true,
  };
  const inserted = await supabaseServiceRoleRequest<AutomationVideoJob[]>(
    "/rest/v1/video_jobs?select=id,user_id,provider_job_id,status,result_payload,created_at",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: jobId,
        user_id: connection.connected_by,
        account_id: null,
        provider: "fal",
        provider_job_id: null,
        prompt: videoPromptForCreative(creative),
        status: "queued",
        result_url: null,
        result_payload: basePayload,
      }),
    },
  );
  if (!inserted?.[0]) throw new Error("WOVO_VIDEO_DRAFT_LEDGER_CREATE_FAILED");
  try {
    const provider = await createFalVideoJob({ prompt: videoPromptForCreative(creative), durationSeconds: 4 });
    const updated = await supabaseServiceRoleRequest<AutomationVideoJob[]>(
      `/rest/v1/video_jobs?id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(connection.connected_by)}&select=id,user_id,provider_job_id,status,result_payload,created_at`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          provider_job_id: provider.providerJobId,
          status: provider.status,
          result_payload: {
            ...basePayload,
            model: provider.model,
            modelPricingVersion: provider.pricingVersion,
            modelRegistryVersion: provider.registryVersion,
            estimatedProviderCostMicros: provider.estimatedProviderCostMicros,
            quotedCredits: provider.quotedCredits,
            durationSeconds: provider.seconds,
          },
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!updated?.[0]) throw new Error("WOVO_VIDEO_DRAFT_LEDGER_UPDATE_FAILED");
    await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_connections?id=eq.${encodeURIComponent(connection.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ auto_publish_last_slot: local.date, auto_publish_last_slot_key: slotKey, updated_at: new Date().toISOString() }),
    });
    return { enqueued: 1, date: local.date, slotHour, campaignKey: creative.campaignKey, videoJobId: jobId, reviewRequired: true };
  } catch (error) {
    await supabaseServiceRoleRequest(`/rest/v1/video_jobs?id=eq.${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", error: "WOVO_VIDEO_DRAFT_PROVIDER_SUBMISSION_FAILED", updated_at: new Date().toISOString() }),
    }).catch(() => undefined);
    throw error;
  }
}

export async function createMetaReviewDraftsForAutomationVideo(row: AutomationVideoJob) {
  const payload = asRecord(row.result_payload);
  if (payload.wovoMetaAutomation !== true || payload.metaDraftsCreated === true) return [] as string[];
  const creative = safeCreative(row.result_payload);
  const connectionId = asString(payload.metaConnectionId);
  const slotKey = asString(payload.metaSlotKey);
  if (!creative || !connectionId || !/^\d{4}-\d{2}-\d{2}:\d{2}$/.test(slotKey)) {
    throw new Error("WOVO_VIDEO_DRAFT_METADATA_INVALID");
  }
  const mediaUrl = signedMediaUrl(
    `${(getEnv("NEXT_PUBLIC_SITE_URL") || getEnv("NEXT_PUBLIC_APP_URL") || "https://wovomedia.com").replace(/\/$/, "")}/api/cron/video-jobs`,
    { kind: "video", jobId: row.id, ownerUserId: row.user_id, lifetimeSeconds: 30 * 24 * 60 * 60 },
  );
  const caption = `${creative.caption}\n\n${creative.hashtags.join(" ")}`;
  const captionHash = contentHash(caption);
  const topicHash = contentHash(creative.campaignKey);
  const destinations = ["facebook_page", "instagram"] as const;
  const rows = await supabaseServiceRoleRequest<Array<{ id: string; destination: string }>>(
    "/rest/v1/wovo_meta_publish_jobs?on_conflict=account_id,owner_scope,idempotency_key&select=id,destination",
    {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(destinations.map((destination) => ({
        id: randomUUID(),
        account_id: null,
        owner_scope: true,
        connection_id: connectionId,
        created_by: row.user_id,
        idempotency_key: `wovo-daily-video:${slotKey}:${destination}`,
        destination,
        status: "draft",
        source: "scheduled_automation",
        title: `${creative.headline} · AI Reel`,
        caption,
        topic: creative.campaignKey,
        hashtags: creative.hashtags,
        normalized_caption_hash: captionHash,
        topic_hash: topicHash,
        creative_hash: contentHash(`${creative.kicker}|${creative.headline}|${creative.cta}|${row.id}`),
        content_format: "reel",
        media_url: mediaUrl,
        campaign_key: creative.campaignKey,
        creative_kicker: creative.kicker,
        creative_headline: creative.headline,
        creative_cta: creative.cta,
        rights_confirmed: true,
        scheduled_for: null,
        approved_at: null,
        approved_by: null,
      }))),
    },
  );
  for (const draft of rows ?? []) {
    await supabaseServiceRoleRequest("/rest/v1/wovo_publishing_revisions", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        source_type: "meta_job",
        source_id: draft.id,
        account_id: null,
        owner_scope: true,
        actor_user_id: row.user_id,
        action: "created",
        version: 1,
        snapshot: { destination: draft.destination, contentFormat: "reel", videoJobId: row.id, reviewRequired: true },
        correlation_id: randomUUID(),
      }),
    }).catch(() => undefined);
  }
  return (rows ?? []).map((draft) => draft.id);
}
