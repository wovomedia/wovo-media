import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { signMetaClientMedia } from "@/lib/meta/creative";
import { enqueueWovoDailyImagePost, loadMetaConnection, loadMetaConnections, processMetaPublishJobs, publishMetaJob } from "@/lib/meta/publishing";
import { assertPortalAccountAccess, isUuid, parseIsoDate, PortalHttpError, requiredString, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type ContentItem = {
  id: string;
  account_id: string;
  title: string;
  caption: string;
  platform: string;
  content_type: string;
  scheduled_for: string | null;
  status: string;
  hashtags: string[];
  timezone: string;
  approval_version: number;
  approved_snapshot_id: string | null;
  source_rights_confirmed: boolean;
  asset_id: string | null;
};

type Asset = { id: string; account_id: string; mime_type: string; rights_confirmed: boolean; archived_at: string | null };

function combinedCaption(item: ContentItem) {
  const tags = [...new Set((item.hashtags ?? []).map((tag) => tag.trim().replace(/^#+/, "")).filter(Boolean))].slice(0, 20);
  return tags.length ? `${item.caption}\n\n${tags.map((tag) => `#${tag}`).join(" ")}` : item.caption;
}

async function deliverApprovedContent(request: Request, context: Awaited<ReturnType<typeof requirePortalContext>>, accountId: string, body: Record<string, unknown>) {
  await assertPortalAccountAccess(context, accountId);
  const contentId = requiredString(body.contentId, "Content item", 80);
  if (!isUuid(contentId)) throw new PortalHttpError(400, "Choose a valid content item.");
  const items = await supabaseServiceRoleRequest<ContentItem[]>(`/rest/v1/wovo_portal_content_items?select=id,account_id,title,caption,platform,content_type,scheduled_for,status,hashtags,timezone,approval_version,approved_snapshot_id,source_rights_confirmed,asset_id&id=eq.${encodeURIComponent(contentId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);
  const item = items?.[0];
  if (!item) throw new PortalHttpError(404, "Content item not found.");
  if (item.status !== "approved" || !item.approved_snapshot_id) throw new PortalHttpError(409, "Approve the exact post version before publishing or scheduling it.");
  const destination = item.platform === "facebook" ? "facebook_page" : item.platform === "instagram" ? "instagram" : null;
  if (!destination) throw new PortalHttpError(400, "Only Facebook and Instagram drafts can use this Meta connection.");
  const connections = await loadMetaConnections({ accountId, ownerScope: false });
  const requestedConnectionId = typeof body.connectionId === "string" ? body.connectionId : "";
  const connection = requestedConnectionId ? connections.find((item) => item.id === requestedConnectionId) : connections[0];
  if (!connection || connection.status !== "healthy") throw new PortalHttpError(409, "Connect this workspace to Meta before scheduling posts.");
  if (connection.kill_switch || connection.action_policy === "draft_only") throw new PortalHttpError(409, "Enable approved Meta scheduling in Profile before sending posts.");
  if (destination === "instagram" && (!connection.instagram_user_id || !connection.instagram_username)) throw new PortalHttpError(409, "The connected Page does not include an Instagram professional account.");

  let asset: Asset | null = null;
  if (item.asset_id) {
    const assets = await supabaseServiceRoleRequest<Asset[]>(`/rest/v1/wovo_portal_assets?select=id,account_id,mime_type,rights_confirmed,archived_at&id=eq.${encodeURIComponent(item.asset_id)}&account_id=eq.${encodeURIComponent(accountId)}&rights_confirmed=eq.true&archived_at=is.null&limit=1`);
    asset = assets?.[0] ?? null;
    if (!asset || (!asset.mime_type.startsWith("image/") && !asset.mime_type.startsWith("video/"))) throw new PortalHttpError(409, "The approved media asset is unavailable.");
  }
  if (destination === "instagram" && !asset) throw new PortalHttpError(409, "Instagram publishing requires a rights-confirmed image or video.");

  const action = body.action === "publish_content" ? "publish" : "schedule";
  let scheduledFor: string | null = null;
  if (action === "schedule") {
    scheduledFor = parseIsoDate(body.scheduledFor ?? item.scheduled_for, "Scheduled time");
    if (Date.parse(scheduledFor) < Date.now() + 60_000) throw new PortalHttpError(400, "Choose a schedule time at least one minute from now.");
    if (Date.parse(scheduledFor) > Date.now() + 366 * 86_400_000) throw new PortalHttpError(400, "Choose a schedule time within the next year.");
  }
  const jobId = randomUUID();
  const origin = new URL(request.url).origin;
  const mediaUrl = asset ? `${origin}/api/integrations/meta/media/${jobId}?sig=${signMetaClientMedia(jobId)}` : null;
  const caption = combinedCaption(item);
  const idempotencyKey = `client-content:${item.id}:v${item.approval_version}:${destination}:${scheduledFor ?? "now"}`;
  const rows = await supabaseServiceRoleRequest<Array<{ id: string; connection_id: string; destination: string; caption: string; media_url: string | null; attempt_count: number; content_format: string }>>(
    "/rest/v1/wovo_meta_publish_jobs?on_conflict=account_id,owner_scope,idempotency_key",
    {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        id: jobId,
        account_id: accountId,
        owner_scope: false,
        connection_id: connection.id,
        created_by: context.user.id,
        idempotency_key: idempotencyKey,
        destination,
        content_format: asset?.mime_type.startsWith("video/") ? "reel" : asset ? "single_image" : "text",
        source: "manual",
        status: action === "schedule" ? "queued" : "approved",
        title: item.title,
        topic: `Approved workspace content · v${item.approval_version}`,
        caption,
        hashtags: item.hashtags ?? [],
        media_url: mediaUrl,
        scheduled_for: scheduledFor,
        timezone: item.timezone || "America/Chicago",
        rights_confirmed: Boolean(asset ? item.source_rights_confirmed : true),
        approved_at: new Date().toISOString(),
        approved_by: context.user.id,
        source_content_item_id: item.id,
        source_asset_id: asset?.id ?? null,
      }),
    },
  );
  const job = rows?.[0];
  if (!job) throw new PortalHttpError(409, "This exact approved post was already submitted. Review its delivery status before retrying.");
  if (action === "schedule") return NextResponse.json({ scheduled: true, jobId: job.id, scheduledFor });
  try {
    const result = await publishMetaJob(job, { explicitApproval: true });
    return NextResponse.json({ published: true, jobId: job.id, providerPostId: result.providerPostId });
  } catch {
    throw new PortalHttpError(502, "Meta did not confirm publication. The failed attempt is recorded and is not marked published.");
  }
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const context = await requirePortalContext(authorization);
    const body = await request.json() as Record<string, unknown>;
    const accountId = typeof body.accountId === "string" ? body.accountId : undefined;
    const ownerScope = !accountId && context.mode === "staff" && context.staffRole === "owner";
    if (!ownerScope && !isUuid(accountId)) return NextResponse.json({ error: "A valid workspace is required." }, { status: 400 });
    if (!ownerScope) await assertPortalAccountAccess(context, accountId!);
    const connection = await loadMetaConnection({ accountId, ownerScope });
    if (!connection) return NextResponse.json({ error: "Connect an official Facebook Page first." }, { status: 409 });

    if (!ownerScope && (body.action === "schedule_content" || body.action === "publish_content")) {
      return deliverApprovedContent(request, context, accountId!, body);
    }

    if (body.action === "update_policy") {
      const actionPolicy = ["draft_only", "approve_each", "scheduled_auto_publish"].includes(String(body.actionPolicy)) ? String(body.actionPolicy) : "approve_each";
      if (!ownerScope && actionPolicy === "scheduled_auto_publish" && (!connection.e2e_verified_at || !connection.e2e_verified_provider_post_id)) {
        return NextResponse.json({ error: "Approve and publish one real test through this workspace connection before enabling automatic publishing." }, { status: 409 });
      }
      const now = new Date().toISOString();
      const policyFilter = ownerScope ? "owner_scope=eq.true&account_id=is.null" : `owner_scope=eq.false&account_id=eq.${encodeURIComponent(accountId!)}`;
      await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_connections?${policyFilter}&status=eq.healthy`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ action_policy: actionPolicy, kill_switch: body.killSwitch !== false, auto_publish_opted_in_at: actionPolicy === "scheduled_auto_publish" && body.killSwitch === false ? now : null, updated_at: now }) });
      return NextResponse.json({ saved: true });
    }

    if (body.action === "publish_image_test" && body.confirmed === true) {
      if (!ownerScope) return NextResponse.json({ error: "The WOVO-owned image test is owner-only." }, { status: 403 });
      if (connection.kill_switch || connection.action_policy !== "scheduled_auto_publish") {
        return NextResponse.json({ error: "Select Scheduled automatic posts and turn off the kill switch first." }, { status: 409 });
      }
      const queued = await enqueueWovoDailyImagePost({ force: true });
      if (queued.enqueued < 1) return NextResponse.json({ error: "Today's image post was already queued or the connection is not ready." }, { status: 409 });
      const result = await processMetaPublishJobs(3);
      if (result.published < queued.enqueued) {
        return NextResponse.json({ error: "Meta did not confirm every image post. Review the publish log before retrying." }, { status: 502 });
      }
      return NextResponse.json({ published: true, publishedCount: result.published, queued, correlationId: randomUUID() });
    }

    if (body.action !== "publish_test" || body.confirmed !== true) return NextResponse.json({ error: "Explicit publication confirmation is required." }, { status: 400 });
    if (connection.kill_switch) return NextResponse.json({ error: "Turn off the Meta kill switch before the test post." }, { status: 409 });
    const caption = requiredString(body.caption, "Post text", 5000);
    const idempotencyKey = `meta-test-${connection.id}-${new Date().toISOString().slice(0, 13)}`;
    const rows = await supabaseServiceRoleRequest<Array<{ id: string; connection_id: string; destination: string; caption: string; media_url: null; attempt_count: number }>>("/rest/v1/wovo_meta_publish_jobs?on_conflict=account_id,owner_scope,idempotency_key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ account_id: ownerScope ? null : accountId, owner_scope: ownerScope, connection_id: connection.id, created_by: context.user.id, idempotency_key: idempotencyKey, destination: "facebook_page", status: "approved", source: "manual", caption, approved_at: new Date().toISOString(), approved_by: context.user.id }) });
    const job = rows?.[0];
    if (!job) return NextResponse.json({ error: "This test post was already submitted. Check the Page before trying again." }, { status: 409 });
    const result = await publishMetaJob(job, { explicitApproval: true });
    return NextResponse.json({ published: true, providerPostId: result.providerPostId, correlationId: randomUUID() });
  } catch (error) {
    if (error instanceof PortalHttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Meta publication failed", { message: error instanceof Error ? error.message.slice(0, 160) : "Unknown" });
    return NextResponse.json({ error: "Meta did not confirm publication. WOVO did not mark the post as published." }, { status: 502 });
  }
}
