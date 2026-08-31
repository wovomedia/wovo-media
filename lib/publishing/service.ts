import "server-only";

import { facebookPublisher } from "@/lib/publishing/providers/facebook";
import { instagramPublisher } from "@/lib/publishing/providers/instagram";
import { tiktokPublisher } from "@/lib/publishing/providers/tiktok";
import { youtubePublisher } from "@/lib/publishing/providers/youtube";
import { loadSocialConnection, updateSocialConnection } from "@/lib/publishing/store";
import type { PublisherAdapter, SocialProvider } from "@/lib/publishing/types";
import { normalizeProviderErrorCode } from "@/lib/publishing/types";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

const adapters: Record<SocialProvider, PublisherAdapter> = {
  facebook: facebookPublisher,
  instagram: instagramPublisher,
  tiktok: tiktokPublisher,
  youtube: youtubePublisher,
};

export function publisherFor(provider: SocialProvider) {
  return adapters[provider];
}

export async function verifyAndPersistSocialConnection(connectionId: string) {
  const connection = await loadSocialConnection(connectionId);
  if (!connection) throw new Error("SOCIAL_CONNECTION_NOT_FOUND");
  const verification = await publisherFor(connection.provider).verifyConnection(connection);
  const updated = await updateSocialConnection(connection.id, {
    status: verification.status,
    provider_account_id: verification.accountId ?? connection.provider_account_id,
    provider_account_name: verification.accountName ?? connection.provider_account_name,
    scopes: verification.scopes ?? connection.scopes,
    last_verified_at: new Date().toISOString(),
    last_error_code: verification.errorCode ?? null,
    last_error_message: verification.userMessage ?? null,
    metadata_json: { ...connection.metadata_json, ...(verification.metadata ?? {}) },
  });
  return { connection: updated, verification };
}

export async function markConnectionVerificationFailure(connectionId: string, error: unknown) {
  const code = normalizeProviderErrorCode(error);
  return updateSocialConnection(connectionId, {
    status: /TOKEN|AUTH|SCOPE/.test(code) ? "action_required" : "error",
    last_verified_at: new Date().toISOString(),
    last_error_code: code,
    last_error_message: "The provider could not verify this connection. No publishing action was taken.",
  });
}

export type SocialPublishJobRow = {
  id: string;
  workspace_id: string | null;
  owner_scope: boolean;
  connection_id: string;
  provider: SocialProvider;
  publish_type: "text" | "image" | "video";
  title: string | null;
  caption: string;
  media_url: string | null;
  media_mime_type: string | null;
  privacy_status: string | null;
  publish_options: Record<string, unknown>;
  status: string;
  scheduled_for: string | null;
  provider_publish_id: string | null;
  provider_post_id: string | null;
  attempt_count: number;
  updated_at: string;
};

const SOCIAL_DELIVERY_WINDOW_MS = 75 * 60 * 1000;
const SOCIAL_PROCESSING_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function loadSocialPublishJob(id: string) {
  const rows = await supabaseServiceRoleRequest<SocialPublishJobRow[]>(
    `/rest/v1/wovo_social_publish_jobs?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function publishSocialJob(job: SocialPublishJobRow) {
  const currentConnection = await loadSocialConnection(job.connection_id);
  if (!currentConnection || currentConnection.provider !== job.provider) throw new Error("SOCIAL_CONNECTION_NOT_ACTIONABLE");
  let verified: Awaited<ReturnType<typeof verifyAndPersistSocialConnection>>;
  try {
    verified = await verifyAndPersistSocialConnection(currentConnection.id);
    if (!verified.verification.ok || !["publishing_ready", "test_mode"].includes(verified.connection.status)) {
      throw new Error(verified.verification.errorCode ?? "SOCIAL_CONNECTION_NOT_PUBLISHING_READY");
    }
  } catch (error) {
    const code = normalizeProviderErrorCode(error, "SOCIAL_CONNECTION_NOT_PUBLISHING_READY");
    await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}&status=in.(approved,queued)`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", last_error_code: code, last_error_message: "Publishing access could not be verified. Nothing was sent.", updated_at: new Date().toISOString() }),
    }).catch(() => null);
    throw error;
  }
  const locked = await supabaseServiceRoleRequest<SocialPublishJobRow[]>(
    `/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}&status=in.(approved,queued)`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "uploading", attempt_count: Math.min((job.attempt_count ?? 0) + 1, 8), updated_at: new Date().toISOString() }),
    },
  );
  const claimed = locked?.[0];
  if (!claimed) throw new Error("SOCIAL_JOB_ALREADY_CLAIMED");
  const adapter = publisherFor(job.provider);
  try {
    const result = await adapter.publishPost({
      connectionId: job.connection_id,
      provider: job.provider,
      publishType: job.publish_type,
      title: job.title ?? undefined,
      caption: job.caption,
      mediaUrl: job.media_url ?? undefined,
      mediaMimeType: job.media_mime_type ?? undefined,
      privacyStatus: job.privacy_status ?? undefined,
      options: job.publish_options,
    }, verified.connection);
    const now = new Date().toISOString();
    if (result.state === "published" && result.providerPostId) {
      await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "published", provider_post_id: result.providerPostId, provider_publish_id: result.providerPublishId ?? null, published_at: now, last_error_code: null, last_error_message: null, updated_at: now }),
      });
      return { state: "published" as const, providerPostId: result.providerPostId };
    }
    if (!result.providerPublishId) throw new Error("PROVIDER_PUBLISH_ID_MISSING");
    await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "processing", provider_publish_id: result.providerPublishId, last_error_code: null, last_error_message: null, updated_at: now }),
    });
    return { state: "processing" as const, providerPublishId: result.providerPublishId };
  } catch (error) {
    const code = normalizeProviderErrorCode(error);
    await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", last_error_code: code, last_error_message: "The provider did not accept this post. Nothing was marked published.", updated_at: new Date().toISOString() }),
    }).catch(() => null);
    throw error;
  }
}

export async function refreshSocialPublishJob(job: SocialPublishJobRow) {
  if (job.status !== "processing" || !job.provider_publish_id) return { state: job.status };
  const connection = await loadSocialConnection(job.connection_id);
  if (!connection) throw new Error("SOCIAL_CONNECTION_NOT_FOUND");
  try {
    const status = await publisherFor(job.provider).getPublishStatus(connection, job.provider_publish_id);
    const now = new Date().toISOString();
    if (status.state === "published" && status.providerPostId) {
      await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "published", provider_post_id: status.providerPostId, published_at: now, last_error_code: null, last_error_message: null, updated_at: now }),
      });
    } else if (status.state === "failed") {
      await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed", last_error_code: status.errorCode ?? "PROVIDER_PROCESSING_FAILED", last_error_message: "Provider processing failed. Nothing was marked published.", updated_at: now }),
      });
    }
    return status;
  } catch (error) {
    const code = normalizeProviderErrorCode(error);
    await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_error_code: code, last_error_message: "Provider status could not be checked yet.", updated_at: new Date().toISOString() }),
    }).catch(() => null);
    throw error;
  }
}

export async function processScheduledSocialJobs(limit = 6, now = new Date()) {
  const recent = new Date(now.getTime() - SOCIAL_DELIVERY_WINDOW_MS).toISOString();
  const jobs = await supabaseServiceRoleRequest<SocialPublishJobRow[]>(
    `/rest/v1/wovo_social_publish_jobs?select=*&status=eq.queued&scheduled_for=gte.${encodeURIComponent(recent)}&scheduled_for=lte.${encodeURIComponent(now.toISOString())}&order=scheduled_for.asc&limit=${Math.max(1, Math.min(limit, 8))}`,
  ) ?? [];
  const results: Array<{ jobId: string; state: string; code?: string }> = [];
  for (const job of jobs) {
    try { const result = await publishSocialJob(job); results.push({ jobId: job.id, state: result.state }); }
    catch (error) { results.push({ jobId: job.id, state: "failed", code: normalizeProviderErrorCode(error) }); }
  }
  return { found: jobs.length, results };
}

export async function reconcileSocialPublishJobs(limit = 12, now = new Date()) {
  const cutoff = new Date(now.getTime() - SOCIAL_PROCESSING_WINDOW_MS).toISOString();
  const jobs = await supabaseServiceRoleRequest<SocialPublishJobRow[]>(
    `/rest/v1/wovo_social_publish_jobs?select=*&status=eq.processing&provider_publish_id=not.is.null&updated_at=gte.${encodeURIComponent(cutoff)}&order=updated_at.asc&limit=${Math.max(1, Math.min(limit, 20))}`,
  ) ?? [];
  const results: Array<{ jobId: string; state: string; code?: string }> = [];
  for (const job of jobs) {
    try { const result = await refreshSocialPublishJob(job); results.push({ jobId: job.id, state: result.state }); }
    catch (error) { results.push({ jobId: job.id, state: "check_failed", code: normalizeProviderErrorCode(error) }); }
  }
  return { found: jobs.length, results };
}

export async function reconcileStaleSocialPublishJobs(limit = 4, now = new Date()) {
  const cutoff = new Date(now.getTime() - SOCIAL_PROCESSING_WINDOW_MS).toISOString();
  const jobs = await supabaseServiceRoleRequest<SocialPublishJobRow[]>(
    `/rest/v1/wovo_social_publish_jobs?select=*&status=eq.processing&provider_publish_id=not.is.null&updated_at=lt.${encodeURIComponent(cutoff)}&order=updated_at.asc&limit=${Math.max(1, Math.min(limit, 8))}`,
  ) ?? [];
  const results: Array<{ jobId: string; state: string; code?: string }> = [];
  for (const job of jobs) {
    try {
      const status = await refreshSocialPublishJob(job);
      if (status.state === "processing") {
        await supabaseServiceRoleRequest(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.processing`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed", last_error_code: "PROVIDER_PROCESSING_TIMEOUT", last_error_message: "The provider did not return final proof within six hours. Review the provider before retrying.", updated_at: new Date().toISOString() }),
        });
        results.push({ jobId: job.id, state: "failed", code: "PROVIDER_PROCESSING_TIMEOUT" });
      } else {
        results.push({ jobId: job.id, state: status.state, code: "errorCode" in status ? status.errorCode : undefined });
      }
    } catch (error) {
      results.push({ jobId: job.id, state: "check_failed", code: normalizeProviderErrorCode(error) });
    }
  }
  return { found: jobs.length, results };
}
