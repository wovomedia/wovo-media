import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { enqueueWovoDailyImagePost, loadMetaConnection, processMetaPublishJobs, publishMetaJob } from "@/lib/meta/publishing";
import { assertPortalAccountAccess, isUuid, requiredString, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const accountId = typeof body.accountId === "string" ? body.accountId : undefined;
    const ownerScope = !accountId && context.mode === "staff" && context.staffRole === "owner";
    if (!ownerScope && !isUuid(accountId)) return NextResponse.json({ error: "A valid workspace is required." }, { status: 400 });
    if (!ownerScope) await assertPortalAccountAccess(context, accountId!);
    const connection = await loadMetaConnection({ accountId, ownerScope });
    if (!connection) return NextResponse.json({ error: "Connect an official Facebook Page first." }, { status: 409 });

    if (body.action === "update_policy") {
      const actionPolicy = ["draft_only", "approve_each", "scheduled_auto_publish"].includes(String(body.actionPolicy)) ? String(body.actionPolicy) : "approve_each";
      if (!ownerScope && actionPolicy === "scheduled_auto_publish" && (!connection.e2e_verified_at || !connection.e2e_verified_provider_post_id)) {
        return NextResponse.json({ error: "Approve and publish one real test through this workspace connection before enabling automatic publishing." }, { status: 409 });
      }
      const now = new Date().toISOString();
      await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_connections?id=eq.${encodeURIComponent(connection.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ action_policy: actionPolicy, kill_switch: body.killSwitch !== false, auto_publish_opted_in_at: actionPolicy === "scheduled_auto_publish" && body.killSwitch === false ? now : null, updated_at: now }) });
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
    console.error("Meta publication failed", { message: error instanceof Error ? error.message.slice(0, 160) : "Unknown" });
    return NextResponse.json({ error: "Meta did not confirm publication. WOVO did not mark the post as published." }, { status: 502 });
  }
}
