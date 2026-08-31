import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveSocialOAuthTarget } from "@/lib/publishing/oauth";
import { listSocialConnections } from "@/lib/publishing/store";
import { loadSocialPublishJob, publishSocialJob, refreshSocialPublishJob, type SocialPublishJobRow } from "@/lib/publishing/service";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/publishing/types";
import { isUuid, parseIsoDate, PortalHttpError, requiredString } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

function visibleJob(job: SocialPublishJobRow & Record<string, unknown>) {
  return {
    id: job.id, provider: job.provider, publishType: job.publish_type, title: job.title, caption: job.caption,
    mediaUrl: job.media_url, privacyStatus: job.privacy_status, status: job.status, scheduledFor: job.scheduled_for,
    providerPublishId: job.provider_publish_id, providerPostId: job.provider_post_id,
    lastErrorCode: job.last_error_code ?? null, lastErrorMessage: job.last_error_message ?? null,
    publishedAt: job.published_at ?? null, createdAt: job.created_at ?? null, updatedAt: job.updated_at ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId") || undefined;
    const target = await resolveSocialOAuthTarget(request.headers.get("authorization"), accountId);
    const filter = target.ownerScope ? "owner_scope=eq.true&workspace_id=is.null" : `owner_scope=eq.false&workspace_id=eq.${encodeURIComponent(target.workspaceId!)}`;
    const jobs = await supabaseServiceRoleRequest<Array<SocialPublishJobRow & Record<string, unknown>>>(
      `/rest/v1/wovo_social_publish_jobs?select=*&${filter}&order=created_at.desc&limit=200`,
    ) ?? [];
    return NextResponse.json({ jobs: jobs.map(visibleJob) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof PortalHttpError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown> & { accountId?: string };
    const target = await resolveSocialOAuthTarget(request.headers.get("authorization"), body.accountId);
    const action = requiredString(body.action, "Action", 40);
    const allowedConnections = await listSocialConnections({ workspaceId: target.workspaceId ?? undefined, ownerScope: target.ownerScope });

    if (action === "create") {
      const connectionId = requiredString(body.connectionId, "Connection", 80);
      const connection = allowedConnections.find((item) => item.id === connectionId);
      if (!connection) throw new PortalHttpError(404, "Choose a connected destination in this workspace.");
      const provider = requiredString(body.provider, "Provider", 20) as SocialProvider;
      if (!SOCIAL_PROVIDERS.includes(provider) || provider !== connection.provider) throw new PortalHttpError(400, "Provider does not match the selected destination.");
      const publishType = requiredString(body.publishType, "Publish type", 20);
      if (!["text", "image", "video"].includes(publishType)) throw new PortalHttpError(400, "Choose text, image, or video.");
      const caption = typeof body.caption === "string" ? body.caption.trim() : "";
      if (!caption && publishType === "text") throw new PortalHttpError(400, "A caption is required for a text post.");
      if (caption.length > 5000) throw new PortalHttpError(400, "Caption is too long.");
      const mediaUrl = typeof body.mediaUrl === "string" && body.mediaUrl.trim() ? body.mediaUrl.trim() : null;
      if (publishType !== "text" && !mediaUrl) throw new PortalHttpError(400, "Choose saved WOVO media before creating this post.");
      const rows = await supabaseServiceRoleRequest<Array<SocialPublishJobRow & Record<string, unknown>>>(
        "/rest/v1/wovo_social_publish_jobs?on_conflict=workspace_id,owner_scope,provider,idempotency_key",
        {
          method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify({
            workspace_id: target.workspaceId, owner_scope: target.ownerScope, connection_id: connection.id,
            provider, created_by: target.context.user.id,
            idempotency_key: typeof body.idempotencyKey === "string" && body.idempotencyKey.length >= 12 ? body.idempotencyKey.slice(0, 220) : `manual:${target.context.user.id}:${randomUUID()}`,
            publish_type: publishType, title: typeof body.title === "string" ? body.title.trim().slice(0, 100) || null : null,
            caption, media_url: mediaUrl, media_mime_type: typeof body.mediaMimeType === "string" ? body.mediaMimeType.slice(0, 120) : null,
            privacy_status: typeof body.privacyStatus === "string" ? body.privacyStatus.slice(0, 80) : null,
            publish_options: body.options && typeof body.options === "object" && !Array.isArray(body.options) ? body.options : {}, status: "draft",
          }),
        },
      );
      if (!rows?.[0]) throw new PortalHttpError(409, "This post request already exists.");
      return NextResponse.json({ job: visibleJob(rows[0]) });
    }

    if (!isUuid(body.jobId)) throw new PortalHttpError(400, "A valid publish job is required.");
    const job = await loadSocialPublishJob(body.jobId);
    if (!job) throw new PortalHttpError(404, "Publish job not found.");
    if (job.workspace_id !== target.workspaceId || job.owner_scope !== target.ownerScope) throw new PortalHttpError(403, "This publish job belongs to another workspace.");

    if (action === "approve") {
      if (job.status !== "draft" && job.status !== "failed") throw new PortalHttpError(409, "Only a draft or corrected failed post can be approved.");
      const rows = await supabaseServiceRoleRequest<Array<SocialPublishJobRow & Record<string, unknown>>>(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "approved", approved_at: new Date().toISOString(), approved_by: target.context.user.id, last_error_code: null, last_error_message: null, updated_at: new Date().toISOString() }),
      });
      return NextResponse.json({ job: visibleJob(rows![0]) });
    }
    if (action === "schedule") {
      if (job.status !== "approved") throw new PortalHttpError(409, "Approve the exact post before scheduling it.");
      const scheduledFor = parseIsoDate(body.scheduledFor, "Schedule time");
      if (Date.parse(scheduledFor) < Date.now() + 60_000) throw new PortalHttpError(400, "Choose a time at least one minute in the future.");
      if (job.media_url && Date.parse(scheduledFor) > Date.now() + 28 * 24 * 60 * 60 * 1000) {
        throw new PortalHttpError(400, "Saved WOVO media can be scheduled up to 28 days ahead. Choose a closer time so the secure media link remains valid.");
      }
      const rows = await supabaseServiceRoleRequest<Array<SocialPublishJobRow & Record<string, unknown>>>(`/rest/v1/wovo_social_publish_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.approved`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "queued", scheduled_for: scheduledFor, updated_at: new Date().toISOString() }),
      });
      return NextResponse.json({ job: visibleJob(rows![0]) });
    }
    if (action === "publish_now") {
      if (body.confirmPublish !== true) throw new PortalHttpError(400, "Confirm this exact provider publish action.");
      if (!["approved", "queued"].includes(job.status)) throw new PortalHttpError(409, "Approve this post before publishing it.");
      const result = await publishSocialJob(job);
      return NextResponse.json({ result, job: visibleJob((await loadSocialPublishJob(job.id))! as SocialPublishJobRow & Record<string, unknown>) });
    }
    if (action === "check_status") {
      if (job.status !== "processing") throw new PortalHttpError(409, "This post is not waiting on provider processing.");
      const result = await refreshSocialPublishJob(job);
      return NextResponse.json({ result, job: visibleJob((await loadSocialPublishJob(job.id))! as SocialPublishJobRow & Record<string, unknown>) });
    }
    return NextResponse.json({ error: "Unsupported publish action." }, { status: 400 });
  } catch (error) {
    const status = error instanceof PortalHttpError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publishing action failed." }, { status });
  }
}
