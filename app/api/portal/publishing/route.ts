import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { publishMetaJob } from "@/lib/meta/publishing";
import {
  isUuid,
  optionalString,
  parseIsoDate,
  PortalHttpError,
  requiredString,
  requirePortalContext,
  type PortalContext,
} from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = Record<string, unknown> & { action?: string };

type MetaConnectionRow = {
  id: string;
  account_id: string | null;
  owner_scope: boolean;
  status: string;
  action_policy: string;
  page_name: string;
  instagram_username: string | null;
  instagram_user_id: string | null;
  kill_switch: boolean;
  e2e_verified_at: string | null;
};

type MetaJobRow = {
  id: string;
  account_id: string | null;
  owner_scope: boolean;
  connection_id: string | null;
  title: string | null;
  topic: string | null;
  destination: "facebook_page" | "instagram";
  content_format: string;
  source: string;
  status: string;
  caption: string;
  hashtags: string[];
  media_url: string | null;
  scheduled_for: string | null;
  approved_at: string | null;
  approved_by: string | null;
  provider_post_id: string | null;
  published_at: string | null;
  last_error_summary: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

function requireOwner(context: PortalContext) {
  if (context.mode !== "staff" || context.staffRole !== "owner") {
    throw new PortalHttpError(403, "President / owner access is required.");
  }
}

function publishingError(error: unknown, fallback: string) {
  if (error instanceof PortalHttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Missing bearer token") || message.includes("Unable to verify session")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function enumValue(value: unknown, values: readonly string[], label: string) {
  const normalized = requiredString(value, label, 80).toLowerCase();
  if (!values.includes(normalized)) throw new PortalHttpError(400, `Invalid ${label.toLowerCase()}.`);
  return normalized;
}

function hashtags(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : [];
  return [...new Set(values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/^#+/, "").replace(/[^a-zA-Z0-9_]/g, ""))
    .filter(Boolean))].slice(0, 20);
}

function normalizedHash(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");
}

function safeTimezone(value: unknown) {
  const timezone = optionalString(value, 80) ?? "America/Chicago";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new PortalHttpError(400, "Choose a valid timezone.");
  }
}

function scheduledIso(value: unknown, timezone: string) {
  if (value === undefined || value === null || value === "") return null;
  const raw = requiredString(value, "Scheduled time", 80);
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) return parseIsoDate(raw, "Scheduled time");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) throw new PortalHttpError(400, "Scheduled time must include a date and time.");
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let guess = desired;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const rendered = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    guess += desired - rendered;
  }
  if (!Number.isFinite(guess)) throw new PortalHttpError(400, "Scheduled time is invalid.");
  return new Date(guess).toISOString();
}

async function revision(input: {
  sourceType: "meta_job" | "content_item";
  sourceId: string;
  accountId: string | null;
  ownerScope: boolean;
  actorUserId: string;
  action: "created" | "edited" | "approved" | "scheduled" | "canceled" | "published" | "failed";
  snapshot: Record<string, unknown>;
}) {
  const versions = await supabaseServiceRoleRequest<Array<{ version: number }>>(
    `/rest/v1/wovo_publishing_revisions?select=version&source_type=eq.${input.sourceType}&source_id=eq.${encodeURIComponent(input.sourceId)}&order=version.desc&limit=1`,
  ).catch(() => []);
  await supabaseServiceRoleRequest("/rest/v1/wovo_publishing_revisions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      source_type: input.sourceType,
      source_id: input.sourceId,
      account_id: input.accountId,
      owner_scope: input.ownerScope,
      actor_user_id: input.actorUserId,
      action: input.action,
      version: (versions?.[0]?.version ?? 0) + 1,
      snapshot: input.snapshot,
      correlation_id: randomUUID(),
    }),
  });
}

async function getOwnerConnection(accountId: string | null) {
  const filter = accountId
    ? `owner_scope=eq.false&account_id=eq.${encodeURIComponent(accountId)}`
    : "owner_scope=eq.true&account_id=is.null";
  const rows = await supabaseServiceRoleRequest<MetaConnectionRow[]>(
    `/rest/v1/wovo_meta_connections?select=id,account_id,owner_scope,status,action_policy,page_name,instagram_username,instagram_user_id,kill_switch,e2e_verified_at&${filter}&limit=1`,
  ).catch(() => []);
  return rows?.[0] ?? null;
}

async function loadJob(id: string) {
  const rows = await supabaseServiceRoleRequest<MetaJobRow[]>(
    `/rest/v1/wovo_meta_publish_jobs?select=id,account_id,owner_scope,connection_id,title,topic,destination,content_format,source,status,caption,hashtags,media_url,scheduled_for,approved_at,approved_by,provider_post_id,published_at,last_error_summary,timezone,created_at,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!rows?.[0]) throw new PortalHttpError(404, "Publishing item not found.");
  return rows[0];
}

function publicAssetUrl(request: Request, selection: string | null) {
  if (!selection) return null;
  const path = selection === "cover" ? "/images/social/wovo-facebook-cover.png" : "/images/social/wovo-cover-background-v1.png";
  return new URL(path, request.url).toString();
}

async function createOwnerItem(request: Request, context: PortalContext, body: Body) {
  const scope = enumValue(body.scope ?? "wovo", ["wovo", "client"], "Workspace scope");
  const accountId = scope === "client" ? requiredString(body.accountId, "Client workspace", 80) : null;
  if (accountId && !isUuid(accountId)) throw new PortalHttpError(400, "Invalid client workspace.");
  if (accountId) {
    const accounts = await supabaseServiceRoleRequest<Array<{ id: string }>>(
      `/rest/v1/wovo_portal_accounts?select=id&id=eq.${encodeURIComponent(accountId)}&archived_at=is.null&limit=1`,
    );
    if (!accounts?.[0]) throw new PortalHttpError(404, "Client workspace not found.");
  }
  const title = requiredString(body.title, "Title", 160);
  const caption = requiredString(body.caption, "Caption", 5000);
  const destination = enumValue(body.destination, ["facebook_page", "instagram"], "Platform") as MetaJobRow["destination"];
  const timezone = safeTimezone(body.timezone);
  const scheduledFor = accountId ? scheduledIso(body.scheduledFor, timezone) : null;
  const tags = hashtags(body.hashtags);
  const rightsConfirmed = body.rightsConfirmed === true;
  const assetId = optionalString(body.assetId, 80);
  if (assetId && (!isUuid(assetId) || !accountId)) throw new PortalHttpError(400, "Choose a valid client asset.");
  if (assetId) {
    const assets = await supabaseServiceRoleRequest<Array<{ id: string }>>(
      `/rest/v1/wovo_portal_assets?select=id&id=eq.${encodeURIComponent(assetId)}&account_id=eq.${encodeURIComponent(accountId!)}&rights_confirmed=eq.true&archived_at=is.null&limit=1`,
    );
    if (!assets?.[0]) throw new PortalHttpError(400, "The selected asset is not an active rights-confirmed asset for that workspace.");
  }
  const presetAsset = optionalString(body.presetAsset, 20);
  if ((assetId || presetAsset) && !rightsConfirmed) throw new PortalHttpError(400, "Confirm the right to use the selected media.");

  if (accountId) {
    const rows = await supabaseServiceRoleRequest<Array<Record<string, unknown>>>("/rest/v1/wovo_portal_content_items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        account_id: accountId,
        created_by: context.user.id,
        title,
        caption,
        platform: destination === "facebook_page" ? "facebook" : "instagram",
        content_type: "social_post",
        scheduled_for: scheduledFor,
        status: "draft",
        hashtags: tags,
        platform_variant: {
          facebook: { caption, hashtags: tags.slice(0, 8) },
          instagram: { caption, hashtags: tags },
        },
        timezone,
        asset_id: assetId,
        source_rights_confirmed: rightsConfirmed,
        ai_generated: false,
      }),
    });
    const item = rows?.[0];
    if (!item || typeof item.id !== "string") throw new Error("Unable to save the client draft.");
    await revision({ sourceType: "content_item", sourceId: item.id, accountId, ownerScope: false, actorUserId: context.user.id, action: "created", snapshot: item });
    return { item, sourceType: "content_item" };
  }

  const connection = await getOwnerConnection(null);
  const mediaUrl = publicAssetUrl(request, presetAsset);
  if (destination === "instagram" && !mediaUrl) throw new PortalHttpError(400, "Instagram drafts need an approved image. Choose a WOVO brand image.");
  const id = randomUUID();
  const combinedCaption = tags.length ? `${caption}\n\n${tags.map((tag) => `#${tag}`).join(" ")}` : caption;
  const rows = await supabaseServiceRoleRequest<MetaJobRow[]>("/rest/v1/wovo_meta_publish_jobs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      account_id: null,
      owner_scope: true,
      connection_id: connection?.id ?? null,
      created_by: context.user.id,
      idempotency_key: `owner-manual:${id}`,
      destination,
      content_format: mediaUrl ? "single_image" : "text",
      source: "manual",
      status: "draft",
      title,
      topic: optionalString(body.topic, 180),
      caption: combinedCaption,
      hashtags: tags,
      media_url: mediaUrl,
      scheduled_for: scheduledFor,
      timezone,
      rights_confirmed: rightsConfirmed,
      normalized_caption_hash: normalizedHash(combinedCaption),
      topic_hash: normalizedHash(optionalString(body.topic, 180) ?? title),
      creative_hash: mediaUrl ? normalizedHash(mediaUrl) : null,
    }),
  });
  const job = rows?.[0];
  if (!job) throw new Error("Unable to save the WOVO draft.");
  await revision({ sourceType: "meta_job", sourceId: job.id, accountId: null, ownerScope: true, actorUserId: context.user.id, action: "created", snapshot: job as unknown as Record<string, unknown> });
  return { item: job, sourceType: "meta_job" };
}

async function updateOwnerMetaItem(context: PortalContext, body: Body) {
  const id = requiredString(body.itemId, "Publishing item", 80);
  if (!isUuid(id)) throw new PortalHttpError(400, "Invalid publishing item.");
  const job = await loadJob(id);
  if (!job.owner_scope) throw new PortalHttpError(403, "Open client content in its tenant workspace.");
  const action = enumValue(body.action, ["approve_meta_item", "schedule_meta_item", "cancel_meta_item", "publish_meta_item"], "Action");
  if (action === "cancel_meta_item") {
    if (["published", "publishing"].includes(job.status)) throw new PortalHttpError(409, "A provider-confirmed or in-flight post cannot be canceled here.");
    const now = new Date().toISOString();
    const rows = await supabaseServiceRoleRequest<MetaJobRow[]>(
      `/rest/v1/wovo_meta_publish_jobs?id=eq.${encodeURIComponent(id)}&status=not.in.(published,publishing,canceled)`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "canceled", canceled_at: now, canceled_by: context.user.id, updated_at: now }) },
    );
    if (!rows?.[0]) throw new PortalHttpError(409, "This item is no longer cancelable.");
    await revision({ sourceType: "meta_job", sourceId: id, accountId: null, ownerScope: true, actorUserId: context.user.id, action: "canceled", snapshot: rows[0] as unknown as Record<string, unknown> });
    return { item: rows[0] };
  }
  const connection = await getOwnerConnection(null);
  if (action === "approve_meta_item") {
    if (job.status !== "draft") throw new PortalHttpError(409, "Only a draft can be approved.");
    const now = new Date().toISOString();
    const rows = await supabaseServiceRoleRequest<MetaJobRow[]>(
      `/rest/v1/wovo_meta_publish_jobs?id=eq.${encodeURIComponent(id)}&status=eq.draft`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ connection_id: connection?.id ?? null, status: "approved", approved_at: now, approved_by: context.user.id, scheduled_for: null, updated_at: now }) },
    );
    if (!rows?.[0]) throw new PortalHttpError(409, "This draft changed before approval.");
    await revision({ sourceType: "meta_job", sourceId: id, accountId: null, ownerScope: true, actorUserId: context.user.id, action: "approved", snapshot: rows[0] as unknown as Record<string, unknown> });
    return { item: rows[0], providerReady: Boolean(connection) };
  }
  if (action === "schedule_meta_item") {
    if (job.status !== "approved") throw new PortalHttpError(409, "Approve the exact draft before scheduling it.");
    if (!connection || connection.status !== "healthy" || connection.kill_switch) {
      throw new PortalHttpError(409, "Connect a healthy WOVO Meta account and turn off its publishing kill switch before scheduling.");
    }
    if (connection.action_policy === "draft_only") throw new PortalHttpError(409, "Change the WOVO Meta policy from Draft only before scheduling.");
    const scheduledFor = scheduledIso(body.scheduledFor, job.timezone);
    if (!scheduledFor || Date.parse(scheduledFor) < Date.now() + 60_000) throw new PortalHttpError(400, "Choose a schedule time at least one minute from now.");
    if (Date.parse(scheduledFor) > Date.now() + 366 * 86_400_000) throw new PortalHttpError(400, "Choose a schedule time within the next year.");
    if (job.media_url?.includes("/api/wovo/video/")) {
      const mediaExpiresAt = Number(new URL(job.media_url).searchParams.get("expires")) * 1000;
      if (!Number.isFinite(mediaExpiresAt) || Date.parse(scheduledFor) > mediaExpiresAt - 60 * 60 * 1000) {
        throw new PortalHttpError(400, "Choose a time before this private video link expires, or generate a fresh video draft.");
      }
    }
    const now = new Date().toISOString();
    const rows = await supabaseServiceRoleRequest<MetaJobRow[]>(
      `/rest/v1/wovo_meta_publish_jobs?id=eq.${encodeURIComponent(id)}&status=eq.approved`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ connection_id: connection.id, status: "queued", scheduled_for: scheduledFor, updated_at: now }) },
    );
    if (!rows?.[0]) throw new PortalHttpError(409, "This approved post changed before it could be scheduled.");
    await revision({ sourceType: "meta_job", sourceId: id, accountId: null, ownerScope: true, actorUserId: context.user.id, action: "scheduled", snapshot: rows[0] as unknown as Record<string, unknown> });
    return { item: rows[0] };
  }
  if (!connection || connection.status !== "healthy" || connection.kill_switch) {
    throw new PortalHttpError(409, "Connect a healthy WOVO Meta account and turn off its publishing kill switch before publishing.");
  }
  if (connection.action_policy === "draft_only") throw new PortalHttpError(409, "Change the WOVO Meta policy from Draft only before publishing.");
  if (!job.approved_at || !job.approved_by) throw new PortalHttpError(409, "Approve the exact draft before publishing.");
  if (job.connection_id !== connection.id) {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_publish_jobs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ connection_id: connection.id, updated_at: new Date().toISOString() }),
    });
  }
  try {
    const result = await publishMetaJob({ id, connection_id: connection.id, destination: job.destination, caption: job.caption, media_url: job.media_url, attempt_count: 0 }, { explicitApproval: true });
    const saved = await loadJob(id);
    await revision({ sourceType: "meta_job", sourceId: id, accountId: null, ownerScope: true, actorUserId: context.user.id, action: "published", snapshot: saved as unknown as Record<string, unknown> });
    return { item: saved, providerPostId: result.providerPostId };
  } catch {
    const failed = await loadJob(id);
    await revision({ sourceType: "meta_job", sourceId: id, accountId: null, ownerScope: true, actorUserId: context.user.id, action: "failed", snapshot: failed as unknown as Record<string, unknown> }).catch(() => null);
    throw new PortalHttpError(502, "Meta did not confirm publication. The ledger shows the failed state and nothing is marked published.");
  }
}

export async function GET(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    requireOwner(context);
    const [jobs, connections, revisions] = await Promise.all([
      supabaseServiceRoleRequest<MetaJobRow[]>("/rest/v1/wovo_meta_publish_jobs?select=id,account_id,owner_scope,connection_id,title,topic,destination,content_format,source,status,caption,hashtags,media_url,scheduled_for,approved_at,approved_by,provider_post_id,published_at,last_error_summary,timezone,created_at,updated_at&order=created_at.desc&limit=500").catch(() => []),
      supabaseServiceRoleRequest<MetaConnectionRow[]>("/rest/v1/wovo_meta_connections?select=id,account_id,owner_scope,status,action_policy,page_name,instagram_username,instagram_user_id,kill_switch,e2e_verified_at&order=created_at.desc&limit=300").catch(() => []),
      supabaseServiceRoleRequest<Array<Record<string, unknown>>>("/rest/v1/wovo_publishing_revisions?select=id,source_type,source_id,account_id,owner_scope,actor_user_id,action,version,correlation_id,created_at&order=created_at.desc&limit=500").catch(() => []),
    ]);
    return NextResponse.json({ jobs: jobs ?? [], connections: connections ?? [], revisions: revisions ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return publishingError(error, "Publishing data could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    requireOwner(context);
    const body = await request.json() as Body;
    if (body.action === "create_owner_item") return NextResponse.json(await createOwnerItem(request, context, body), { status: 201 });
    if (["approve_meta_item", "schedule_meta_item", "cancel_meta_item", "publish_meta_item"].includes(String(body.action))) {
      return NextResponse.json(await updateOwnerMetaItem(context, body));
    }
    throw new PortalHttpError(400, "Unknown publishing action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Missing bearer token") && !message.includes("Unable to verify session") && !(error instanceof PortalHttpError)) {
      console.error("Owner publishing request failed", { message: message.slice(0, 180) || "unknown" });
    }
    return publishingError(error, "The publishing action could not be completed.");
  }
}
