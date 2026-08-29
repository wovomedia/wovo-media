import { NextResponse } from "next/server";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { checkAiRateLimit } from "@/lib/wovo-ai/rate-limit";
import { generateTextWithProviders } from "@/lib/wovo-ai/provider-router";
import { getWovoAiRuntimeState } from "@/lib/wovo-ai/model-metering";
import { getEnv } from "@/lib/env";
import { startCreditCheckout } from "@/lib/portal/credit-checkout";
import { getValidatedCreditPacks } from "@/lib/portal/credit-packs";
import {
  getPortalPriceIdForFrequency,
  getValidatedPortalBillingOption,
  getValidatedPortalBillingOptions,
  isPortalBillingFrequency,
} from "@/lib/portal/billing-options";
import { deleteAuthUserById, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import {
  assertPortalAccountAccess,
  getPortalAccountIds,
  getPortalPriceId,
  isUuid,
  optionalString,
  parseIsoDate,
  PortalHttpError,
  requiredString,
  requirePortalContext,
  type PortalContext,
} from "@/lib/portal/server";
import type {
  PortalAccount,
  PortalAccessGrant,
  PortalAdminAudit,
  PortalAsset,
  PortalAiUsagePolicy,
  PortalAiUsageRequest,
  PortalClientInvite,
  PortalCommentContentWorkflow,
  PortalContentApproval,
  PortalContentItem,
  PortalCreditAccount,
  PortalCreditEntry,
  PortalEntitlement,
  PortalEvent,
  PortalMessage,
  PortalKnowledgeNote,
  PortalKnowledgeNoteVersion,
  PortalNotification,
  PortalOrder,
  PortalPublicInquiry,
  PortalPublicInquiryReply,
  PortalPostingTask,
  PortalSnapshot,
  PortalSubscription,
  PortalThread,
  PortalThreadAssignment,
  PortalWorkflowDraft,
} from "@/lib/portal/types";

export const runtime = "nodejs";

type ActionBody = Record<string, unknown> & { action?: string; accountId?: string };

const PLATFORM_VALUES = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "google_business", "other"];
const BUSINESS_TYPES = ["restaurant", "realtor", "contractor", "local_business", "other"];
const CONTENT_TYPES = ["social_post", "special", "property_marketing", "project_update"];
const ORDER_TYPES = ["website", "ad_video", "shoot", "drone", "extra_participant"] as const;
const WORKFLOW_TYPES = ["listing_ad", "website_site", "website_page", "post_plan", "mascot_series", "ugc_ad", "call_agent", "booking_request", "job_posting", "meeting"] as const;
const ONBOARDING_MODULES = ["content", "website_brief", "listing_ad", "meetings", "jobs"];
const ONBOARDING_ADDONS = ["dm_manager", "website_hosting", "personal_ai_assistant", "team_seats"];
const ONBOARDING_SERVICES = ["website_creation", "shoot", "drone", "custom_editing"];
const ONBOARDING_PERMISSIONS = ["view", "draft", "approve", "schedule"];
const NOTE_CATEGORIES = ["business_facts", "programs", "locations", "services", "history", "events", "voice_guidance", "faq", "other"];
const NOTE_GUIDANCE_KINDS = ["fact", "do_say", "dont_say", "context"];
const COMMENT_CATEGORIES = ["faq", "program", "service", "event", "education", "myth", "other"];
const COMMENT_OUTPUT_TYPES = ["faq_answer", "social_post", "caption", "content_theme"];
const COMMENT_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "website", "other"];

function restIn(ids: string[]): string {
  return `in.(${ids.map((id) => encodeURIComponent(id)).join(",")})`;
}

function siteUrl(request: Request): string {
  const configured = getEnv("NEXT_PUBLIC_SITE_URL") || getEnv("NEXT_PUBLIC_APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return forwardedHost ? `${protocol}://${forwardedHost}` : url.origin;
}

function enumValue(value: unknown, allowed: readonly string[], label: string): string {
  const normalized = requiredString(value, label, 80).toLowerCase();
  if (!allowed.includes(normalized)) throw new PortalHttpError(400, `Invalid ${label.toLowerCase()}.`);
  return normalized;
}

function numberValue(value: unknown, label: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new PortalHttpError(400, `${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function optionalHttpUrl(value: unknown, label: string): string | null {
  const raw = optionalString(value, 1000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
    return url.toString();
  } catch {
    throw new PortalHttpError(400, `${label} must be a valid http or https URL.`);
  }
}

function optionalDateOnly(value: unknown, label: string): string | null {
  const raw = optionalString(value, 20);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new PortalHttpError(400, `${label} must be a valid date.`);
  }
  return raw;
}

async function insertNotification(payload: Omit<PortalNotification, "id" | "read_at" | "created_at">): Promise<void> {
  await supabaseServiceRoleRequest("/rest/v1/wovo_portal_notifications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
}

async function loadSnapshot(context: PortalContext): Promise<PortalSnapshot> {
  const setup = await setupStatus();
  const owner = context.mode === "staff" && context.staffRole === "owner";
  if (context.mode === "client") {
    await supabaseServiceRoleRequest(
      `/rest/v1/wovo_portal_client_invites?invited_user_id=eq.${encodeURIComponent(context.user.id)}&status=eq.pending`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      }
    ).catch(() => null);
  }
  const publicInquiries = (context.mode === "staff"
    ? await supabaseServiceRoleRequest<PortalPublicInquiry[]>(
        `/rest/v1/wovo_public_inquiries?select=*${owner ? "" : `&archived_at=is.null&assigned_role=eq.${encodeURIComponent(context.staffRole ?? "")}`}&order=created_at.desc&limit=100`
      ).catch(() => [])
    : []) ?? [];
  const publicInquiryReplies = publicInquiries.length
    ? (await supabaseServiceRoleRequest<PortalPublicInquiryReply[]>(
        `/rest/v1/wovo_public_inquiry_replies?select=*&inquiry_id=${restIn(publicInquiries.map((inquiry) => inquiry.id))}&order=created_at.asc&limit=500`
      ).catch(() => [])) ?? []
    : [];
  const adminAudit = owner
    ? (await supabaseServiceRoleRequest<PortalAdminAudit[]>(
        "/rest/v1/wovo_portal_admin_audit?select=*&order=created_at.desc&limit=250"
      ).catch(() => [])) ?? []
    : [];
  const accountIds = await getPortalAccountIds(context);
  if (accountIds.length === 0) {
    return {
      user: { id: context.user.id, email: context.user.email ?? null },
      mode: context.mode,
      staffRole: context.staffRole,
      accounts: [],
      content: [],
      contentApprovals: [],
      events: [],
      threads: [],
      threadAssignments: [],
      messages: [],
      orders: [],
      assets: [],
      subscriptions: [],
      notifications: [],
      publicInquiries,
      publicInquiryReplies,
      adminAudit,
      accessGrants: [],
      clientInvites: [],
      postingTasks: [],
      creditAccounts: [],
      creditLedger: [],
      entitlements: [],
      workflowDrafts: [],
      aiUsagePolicies: [],
      aiUsageRequests: [],
      knowledgeNotes: [],
      knowledgeNoteVersions: [],
      commentContentWorkflows: [],
      setup,
    };
  }
  const accountFilter = restIn(accountIds);
  const [accountRows, subscriptionRows, accessGrantRows, inviteRows, postingTaskRows] = await Promise.all([
    supabaseServiceRoleRequest<PortalAccount[]>(`/rest/v1/wovo_portal_accounts?select=*&id=${accountFilter}&order=created_at.desc`),
    supabaseServiceRoleRequest<PortalSubscription[]>(`/rest/v1/wovo_portal_subscriptions?select=account_id,status,stripe_price_id,current_period_end,cancel_at_period_end&account_id=${accountFilter}`),
    supabaseServiceRoleRequest<PortalAccessGrant[]>(
      `/rest/v1/wovo_portal_access_grants?select=*&account_id=${accountFilter}&order=created_at.desc`
    ).catch(() => []),
    owner
      ? supabaseServiceRoleRequest<PortalClientInvite[]>(
          `/rest/v1/wovo_portal_client_invites?select=*&account_id=${accountFilter}&order=created_at.desc`
        ).catch(() => [])
      : Promise.resolve([]),
    owner
      ? supabaseServiceRoleRequest<PortalPostingTask[]>(
          `/rest/v1/wovo_portal_posting_tasks?select=*&account_id=${accountFilter}&order=due_at.asc&limit=300`
        ).catch(() => [])
      : Promise.resolve([]),
  ]);
  const visibleAccounts = (accountRows ?? []).filter((account) => owner || !account.archived_at);
  const paidAccountIds = new Set(
    (subscriptionRows ?? [])
      .filter((subscription) => ["active", "trialing"].includes(subscription.status))
      .map((subscription) => subscription.account_id)
  );
  const now = Date.now();
  const grantedAccountIds = new Set(
    (accessGrantRows ?? [])
      .filter((grant) => !grant.revoked_at && Date.parse(grant.starts_at) <= now && Date.parse(grant.expires_at) > now)
      .map((grant) => grant.account_id)
  );
  const dataAccountIds = context.mode === "staff"
    ? visibleAccounts.filter((account) => !account.archived_at).map((account) => account.id)
    : visibleAccounts
        .map((account) => account.id)
        .filter((accountId) => paidAccountIds.has(accountId) || grantedAccountIds.has(accountId));
  if (dataAccountIds.length === 0) {
    return {
      user: { id: context.user.id, email: context.user.email ?? null },
      mode: context.mode,
      staffRole: context.staffRole,
      accounts: visibleAccounts,
      content: [],
      contentApprovals: [],
      events: [],
      threads: [],
      threadAssignments: [],
      messages: [],
      orders: [],
      assets: [],
      subscriptions: subscriptionRows ?? [],
      notifications: [],
      publicInquiries,
      publicInquiryReplies,
      adminAudit,
      accessGrants: accessGrantRows ?? [],
      clientInvites: inviteRows ?? [],
      postingTasks: postingTaskRows ?? [],
      creditAccounts: [],
      creditLedger: [],
      entitlements: [],
      workflowDrafts: [],
      aiUsagePolicies: [],
      aiUsageRequests: [],
      knowledgeNotes: [],
      knowledgeNoteVersions: [],
      commentContentWorkflows: [],
      setup,
    };
  }
  const filter = restIn(dataAccountIds);
  const messageVisibility = context.mode === "staff" ? "" : "&visibility=eq.client";
  const archiveFilter = owner ? "" : "&archived_at=is.null";
  const [
    content,
    contentApprovals,
    events,
    threads,
    threadAssignments,
    rawMessages,
    orders,
    assets,
    notifications,
    members,
    creditAccounts,
    creditLedger,
    entitlements,
    workflowDrafts,
    aiUsagePolicies,
    aiUsageRequests,
    knowledgeNotes,
    knowledgeNoteVersions,
    commentContentWorkflows,
  ] = await Promise.all([
    supabaseServiceRoleRequest<PortalContentItem[]>(`/rest/v1/wovo_portal_content_items?select=*&account_id=${filter}${archiveFilter}&order=scheduled_for.asc.nullslast,created_at.desc&limit=300`),
    supabaseServiceRoleRequest<PortalContentApproval[]>(`/rest/v1/wovo_portal_content_approvals?select=id,account_id,content_item_id,approved_by,approved_at,approval_version,approval_scope,range_start,range_end,revoked_at,revocation_reason,correlation_id&account_id=${filter}&order=approved_at.desc&limit=1000`).catch(() => []),
    supabaseServiceRoleRequest<PortalEvent[]>(`/rest/v1/wovo_portal_events?select=*&account_id=${filter}&order=starts_at.asc&limit=300`),
    supabaseServiceRoleRequest<PortalThread[]>(`/rest/v1/wovo_portal_threads?select=*&account_id=${filter}&order=last_message_at.desc`),
    supabaseServiceRoleRequest<PortalThreadAssignment[]>(`/rest/v1/wovo_portal_thread_assignments?select=*&account_id=${filter}&order=created_at.desc&limit=300`),
    supabaseServiceRoleRequest<Array<Omit<PortalMessage, "sender_label">>>(`/rest/v1/wovo_portal_messages?select=*&account_id=${filter}${messageVisibility}&order=created_at.asc&limit=500`),
    supabaseServiceRoleRequest<PortalOrder[]>(`/rest/v1/wovo_portal_orders?select=*&account_id=${filter}&order=created_at.desc&limit=200`),
    supabaseServiceRoleRequest<PortalAsset[]>(`/rest/v1/wovo_portal_assets?select=id,account_id,file_name,mime_type,size_bytes,asset_kind,rights_confirmed,people_consent_confirmed,archived_at,archived_by,created_at&account_id=${filter}${archiveFilter}&order=created_at.desc&limit=200`),
    context.mode === "staff"
      ? supabaseServiceRoleRequest<PortalNotification[]>(`/rest/v1/wovo_portal_notifications?select=*&account_id=${filter}&order=created_at.desc&limit=100`)
      : Promise.resolve([]),
    supabaseServiceRoleRequest<Array<{ user_id: string }>>(`/rest/v1/wovo_portal_members?select=user_id&account_id=${filter}&active=eq.true`),
    supabaseServiceRoleRequest<PortalCreditAccount[]>(`/rest/v1/wovo_portal_credit_accounts?select=account_id,balance,updated_at&account_id=${filter}`),
    supabaseServiceRoleRequest<PortalCreditEntry[]>(`/rest/v1/wovo_portal_credit_ledger?select=id,account_id,delta,balance_after,entry_type,idempotency_key,description,workflow_id,created_at&account_id=${filter}&order=created_at.desc&limit=300`),
    supabaseServiceRoleRequest<PortalEntitlement[]>(`/rest/v1/wovo_portal_entitlements?select=id,account_id,entitlement_key,status,current_period_end,cancel_at_period_end,provisioning_status,provisioned_url,created_at,updated_at&account_id=${filter}`),
    supabaseServiceRoleRequest<PortalWorkflowDraft[]>(`/rest/v1/wovo_portal_workflow_drafts?select=id,account_id,workflow_type,title,status,brief,source_url,source_authorized,rights_confirmed,people_consent_confirmed,voice_consent_confirmed,input_data,generated_output,provider_status,published_url,created_at,updated_at&account_id=${filter}&order=created_at.desc&limit=300`),
    supabaseServiceRoleRequest<PortalAiUsagePolicy[]>(`/rest/v1/wovo_ai_usage_policies?select=account_id,enabled,plan_key,daily_unit_limit,monthly_included_units,requests_per_minute,monthly_provider_cost_cap_micros,provider_ready,moderation_ready,telemetry_ready,code_sandbox_ready,advanced_mode_selection,period_start,period_end,updated_at&account_id=${filter}`).catch(() => []),
    context.mode === "staff"
      ? supabaseServiceRoleRequest<PortalAiUsageRequest[]>(`/rest/v1/wovo_ai_usage_requests?select=id,account_id,actor_user_id,feature,mode,status,estimated_units,actual_units,estimated_provider_cost_micros,actual_provider_cost_micros,reserved_at,completed_at&account_id=${filter}&order=reserved_at.desc&limit=500`).catch(() => [])
      : Promise.resolve([]),
    supabaseServiceRoleRequest<PortalKnowledgeNote[]>(`/rest/v1/wovo_knowledge_notes?select=id,account_id,title,category,status,current_version,approved_version_id,approved_at,archived_at,created_at,updated_at&account_id=${filter}&order=updated_at.desc&limit=500`).catch(() => []),
    supabaseServiceRoleRequest<PortalKnowledgeNoteVersion[]>(`/rest/v1/wovo_knowledge_note_versions?select=id,note_id,account_id,version_number,title,body,source_url,source_date,guidance_kind,change_note,created_by,created_at&account_id=${filter}&order=created_at.desc&limit=1000`).catch(() => []),
    supabaseServiceRoleRequest<PortalCommentContentWorkflow[]>(`/rest/v1/wovo_comment_content_workflows?select=id,account_id,source_platform,source_url,source_date,redacted_question,category,output_type,approved_note_ids,factual_support_status,draft_output,status,privacy_confirmed,created_at,updated_at&account_id=${filter}&order=created_at.desc&limit=500`).catch(() => []),
  ]);
  const clientUserIds = new Set((members ?? []).map((member) => member.user_id));
  const messages: PortalMessage[] = (rawMessages ?? []).map((message) => ({
    ...message,
    sender_label: clientUserIds.has(message.sender_user_id) ? "Client" : "WOVO team",
  }));
  return {
    user: { id: context.user.id, email: context.user.email ?? null },
    mode: context.mode,
    staffRole: context.staffRole,
    accounts: visibleAccounts,
    content: content ?? [],
    contentApprovals: contentApprovals ?? [],
    events: events ?? [],
    threads: threads ?? [],
    threadAssignments: threadAssignments ?? [],
    messages,
    orders: orders ?? [],
    assets: assets ?? [],
    subscriptions: subscriptionRows ?? [],
    notifications: notifications ?? [],
    publicInquiries,
    publicInquiryReplies,
    adminAudit,
    accessGrants: accessGrantRows ?? [],
    clientInvites: inviteRows ?? [],
    postingTasks: postingTaskRows ?? [],
    creditAccounts: creditAccounts ?? [],
    creditLedger: creditLedger ?? [],
    entitlements: entitlements ?? [],
    workflowDrafts: workflowDrafts ?? [],
    aiUsagePolicies: aiUsagePolicies ?? [],
    aiUsageRequests: aiUsageRequests ?? [],
    knowledgeNotes: knowledgeNotes ?? [],
    knowledgeNoteVersions: knowledgeNoteVersions ?? [],
    commentContentWorkflows: commentContentWorkflows ?? [],
    setup,
  };
}

async function setupStatus(): Promise<PortalSnapshot["setup"]> {
  const aiRuntime = getWovoAiRuntimeState();
  const [billingOptions, creditPacks] = await Promise.all([
    getValidatedPortalBillingOptions(),
    getValidatedCreditPacks(),
  ]);
  const monthlyPrice = billingOptions.find((option) => option.frequency === "monthly") ?? null;
  return {
    monthlyCheckoutConfigured: Boolean(monthlyPrice),
    monthlyPrice: monthlyPrice
      ? { amountCents: monthlyPrice.amountCents, currency: monthlyPrice.currency, interval: monthlyPrice.interval }
      : null,
    billingOptions,
    addonsConfigured: {
      website: Boolean(getPortalPriceId("website")),
      ad_video: Boolean(getPortalPriceId("ad_video")),
      shoot: Boolean(getPortalPriceId("shoot")),
      drone: Boolean(getPortalPriceId("drone")),
      extra_participant: Boolean(getPortalPriceId("extra_participant")),
    },
    aiConfigured: aiRuntime.aiReady,
    meetingProviders: ["Google Meet", "Zoom", "Microsoft Teams"],
    awardsReviewDate: getEnv("WOVO_AWARDS_REVIEW_DATE") || "2027-07-30",
    awardsRubricRequired: true,
    expansion: {
      creditPurchaseReady: creditPacks.length === 3,
      dmManagerCheckoutReady: false,
      websiteHostingCheckoutReady: false,
      personalAssistantCheckoutReady: false,
      wovoAiRuntimeReady: aiRuntime.aiReady,
      wovoCodeRuntimeReady: aiRuntime.codeReady,
      aiCreditTopupReady: aiRuntime.topupReady,
      websiteProvisioningReady: false,
      metaPublishingReady: false,
    },
  };
}

async function assertKnowledgePermission(context: PortalContext, accountId: string, approval = false): Promise<void> {
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  if (context.mode === "staff") {
    if (!["owner", "admin", "manager"].includes(context.staffRole ?? "")) {
      throw new PortalHttpError(403, "Owner, admin, or manager knowledge access is required.");
    }
    return;
  }
  const accountRows = await supabaseServiceRoleRequest<Array<{ owner_user_id: string }>>(
    `/rest/v1/wovo_portal_accounts?select=owner_user_id&id=eq.${encodeURIComponent(accountId)}&limit=1`
  ).catch(() => []);
  if (accountRows?.[0]?.owner_user_id === context.user.id) return;
  const permissions = await supabaseServiceRoleRequest<Array<{ can_edit: boolean; can_approve: boolean }>>(
    `/rest/v1/wovo_knowledge_note_permissions?select=can_edit,can_approve&account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(context.user.id)}&limit=1`
  ).catch(() => []);
  const permission = permissions?.[0];
  if (!permission?.can_edit || (approval && !permission.can_approve)) {
    throw new PortalHttpError(403, approval ? "Note approval permission is required." : "Note editing permission is required.");
  }
}

async function saveKnowledgeNote(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  const approve = body.approve === true;
  await assertKnowledgePermission(context, accountId, approve);
  const title = requiredString(body.title, "Note title", 180);
  const category = enumValue(body.category, NOTE_CATEGORIES, "Note category");
  const noteBody = requiredString(body.body, "Note", 20000);
  const guidanceKind = enumValue(body.guidanceKind ?? "fact", NOTE_GUIDANCE_KINDS, "Guidance type");
  const sourceUrl = optionalHttpUrl(body.sourceUrl, "Source URL");
  const sourceDate = optionalDateOnly(body.sourceDate, "Source date");
  const changeNote = optionalString(body.changeNote, 500);
  const noteId = typeof body.noteId === "string" && body.noteId ? body.noteId : null;
  if (noteId && !isUuid(noteId)) throw new PortalHttpError(400, "Invalid note.");

  let note: PortalKnowledgeNote;
  let versionNumber = 1;
  if (noteId) {
    const rows = await supabaseServiceRoleRequest<PortalKnowledgeNote[]>(
      `/rest/v1/wovo_knowledge_notes?select=*&id=eq.${encodeURIComponent(noteId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`
    ).catch(() => []);
    if (!rows?.[0]) throw new PortalHttpError(404, "Knowledge note not found.");
    note = rows[0];
    versionNumber = note.current_version + 1;
  } else {
    const rows = await supabaseServiceRoleRequest<PortalKnowledgeNote[]>("/rest/v1/wovo_knowledge_notes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        account_id: accountId,
        title,
        category,
        status: "draft",
        current_version: 1,
        created_by: context.user.id,
        updated_by: context.user.id,
      }),
    });
    if (!rows?.[0]) throw new Error("Unable to create the knowledge note.");
    note = rows[0];
  }

  const versionRows = await supabaseServiceRoleRequest<PortalKnowledgeNoteVersion[]>("/rest/v1/wovo_knowledge_note_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      note_id: note.id,
      account_id: accountId,
      version_number: versionNumber,
      title,
      body: noteBody,
      source_url: sourceUrl,
      source_date: sourceDate,
      guidance_kind: guidanceKind,
      change_note: changeNote,
      created_by: context.user.id,
    }),
  });
  const version = versionRows?.[0];
  if (!version) throw new Error("Unable to save the note version.");
  const patch: Record<string, unknown> = {
    title,
    category,
    current_version: versionNumber,
    updated_by: context.user.id,
    updated_at: new Date().toISOString(),
    archived_at: null,
    archived_by: null,
  };
  if (note.status === "archived") patch.status = "draft";
  if (approve) {
    patch.status = "approved";
    patch.approved_version_id = version.id;
    patch.approved_by = context.user.id;
    patch.approved_at = new Date().toISOString();
  }
  const updatedRows = await supabaseServiceRoleRequest<PortalKnowledgeNote[]>(
    `/rest/v1/wovo_knowledge_notes?id=eq.${encodeURIComponent(note.id)}&account_id=eq.${encodeURIComponent(accountId)}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }
  );
  const updated = updatedRows?.[0];
  if (!updated) throw new Error("Unable to update the knowledge note.");
  await insertAdminAudit(context, approve ? "approve_knowledge_note" : "save_knowledge_note", "knowledge_note", note.id, title, {
    accountId,
    versionNumber,
    approved: approve,
    sourceRecorded: Boolean(sourceUrl || sourceDate),
  });
  return { note: updated, version };
}

async function setKnowledgeNoteArchive(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertKnowledgePermission(context, accountId);
  const noteId = requiredString(body.noteId, "Note", 80);
  if (!isUuid(noteId)) throw new PortalHttpError(400, "Invalid note.");
  const archive = body.archive === true;
  const rows = await supabaseServiceRoleRequest<PortalKnowledgeNote[]>(
    `/rest/v1/wovo_knowledge_notes?select=*&id=eq.${encodeURIComponent(noteId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`
  ).catch(() => []);
  const note = rows?.[0];
  if (!note) throw new PortalHttpError(404, "Knowledge note not found.");
  const status = archive ? "archived" : (note.approved_version_id ? "approved" : "draft");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_knowledge_notes?id=eq.${encodeURIComponent(noteId)}&account_id=eq.${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status,
      archived_at: archive ? new Date().toISOString() : null,
      archived_by: archive ? context.user.id : null,
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    }),
  });
  await insertAdminAudit(context, archive ? "archive_knowledge_note" : "restore_knowledge_note", "knowledge_note", note.id, note.title, { accountId });
  return { archived: archive };
}

async function saveCommentContentWorkflow(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertKnowledgePermission(context, accountId);
  if (body.privacyConfirmed !== true) {
    throw new PortalHttpError(400, "Confirm that private commenter details have been removed.");
  }
  const question = requiredString(body.redactedQuestion, "Public question", 4000);
  if (/@[a-z0-9_.-]{2,}|[^\s@]+@[^\s@]+\.[^\s@]+|(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/i.test(question)) {
    throw new PortalHttpError(400, "Remove handles, email addresses, and phone numbers before saving this question.");
  }
  const noteIds = Array.isArray(body.noteIds)
    ? [...new Set(body.noteIds.filter((value): value is string => typeof value === "string" && isUuid(value)))].slice(0, 20)
    : [];
  const approvedNotes = noteIds.length
    ? await supabaseServiceRoleRequest<PortalKnowledgeNote[]>(
        `/rest/v1/wovo_knowledge_notes?select=id,title,approved_version_id,status,account_id&id=${restIn(noteIds)}&account_id=eq.${encodeURIComponent(accountId)}&status=eq.approved&approved_version_id=not.is.null`
      ).catch(() => [])
    : [];
  if ((approvedNotes ?? []).length !== noteIds.length) {
    throw new PortalHttpError(400, "Every linked note must be approved in this workspace.");
  }
  const category = enumValue(body.category, COMMENT_CATEGORIES, "Question category");
  const outputType = enumValue(body.outputType, COMMENT_OUTPUT_TYPES, "Output type");
  const sourcePlatform = body.sourcePlatform ? enumValue(body.sourcePlatform, COMMENT_PLATFORMS, "Source platform") : null;
  const sourceUrl = optionalHttpUrl(body.sourceUrl, "Source URL");
  const sourceDate = optionalDateOnly(body.sourceDate, "Source date");
  const draftOutput = optionalString(body.draftOutput, 10000);
  const requestedStatus = body.status ? enumValue(body.status, ["draft", "brief_ready", "owner_review", "approved", "queued", "archived"], "Workflow status") : "brief_ready";
  if (["approved", "queued"].includes(requestedStatus) && (!draftOutput || noteIds.length === 0)) {
    throw new PortalHttpError(400, "Approved Notes and a reviewed draft are required before approval or queueing.");
  }
  const factualStatus = noteIds.length ? (draftOutput ? "owner_review" : "supported") : "needs_notes";
  const record = {
    account_id: accountId,
    source_platform: sourcePlatform,
    source_url: sourceUrl,
    source_date: sourceDate,
    redacted_question: question,
    category,
    output_type: outputType,
    approved_note_ids: noteIds,
    factual_support_status: factualStatus,
    draft_output: draftOutput,
    status: requestedStatus,
    privacy_confirmed: true,
    updated_at: new Date().toISOString(),
  };
  const workflowId = typeof body.workflowId === "string" && body.workflowId ? body.workflowId : null;
  let rows: PortalCommentContentWorkflow[] | null;
  if (workflowId) {
    if (!isUuid(workflowId)) throw new PortalHttpError(400, "Invalid comment workflow.");
    rows = await supabaseServiceRoleRequest<PortalCommentContentWorkflow[]>(
      `/rest/v1/wovo_comment_content_workflows?id=eq.${encodeURIComponent(workflowId)}&account_id=eq.${encodeURIComponent(accountId)}`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(record) }
    );
  } else {
    rows = await supabaseServiceRoleRequest<PortalCommentContentWorkflow[]>("/rest/v1/wovo_comment_content_workflows", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...record, created_by: context.user.id }),
    });
  }
  const workflow = rows?.[0];
  if (!workflow) throw new Error("Unable to save the comment-to-content workflow.");
  await insertAdminAudit(context, "save_comment_content_workflow", "comment_content_workflow", workflow.id, `${category}: ${question.slice(0, 80)}`, {
    accountId,
    noteCount: noteIds.length,
    status: requestedStatus,
    directSocialIngestion: false,
  });
  if (["owner_review", "queued"].includes(requestedStatus)) {
    await insertNotification({
      account_id: accountId,
      notification_type: "content_ready",
      title: "Comment-backed content needs review",
      body: "A privacy-minimized question is paired with approved WOVO Notes. Review factual support before manual publishing.",
      target_role: "manager",
      related_table: "wovo_comment_content_workflows",
      related_id: workflow.id,
    });
  }
  return { workflow };
}

export async function GET(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    return NextResponse.json(await loadSnapshot(context));
  } catch (error) {
    return portalError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as ActionBody;
    switch (body.action) {
      case "onboard":
        return NextResponse.json(await onboard(context, body), { status: 201 });
      case "update_account_profile":
        return NextResponse.json(await updateAccountProfile(context, body));
      case "create_content":
        return NextResponse.json(await createContent(context, body), { status: 201 });
      case "update_content":
        return NextResponse.json(await updateContent(context, body));
      case "approve_content_range":
        return NextResponse.json(await approveContentRange(context, body));
      case "revoke_content_approval":
        return NextResponse.json(await revokeContentApproval(context, body));
      case "generate_calendar":
        return NextResponse.json(await generateCalendar(context, body), { status: 201 });
      case "send_message":
        return NextResponse.json(await sendMessage(context, body), { status: 201 });
      case "assign_thread":
        return NextResponse.json(await assignThread(context, body));
      case "create_event":
        return NextResponse.json(await createEvent(context, body), { status: 201 });
      case "update_event":
        return NextResponse.json(await updateEvent(context, body));
      case "create_order":
        return NextResponse.json(await createOrder(context, body), { status: 201 });
      case "create_workflow_draft":
        return NextResponse.json(await createWorkflowDraft(context, body), { status: 201 });
      case "save_knowledge_note":
        return NextResponse.json(await saveKnowledgeNote(context, body), { status: body.noteId ? 200 : 201 });
      case "set_knowledge_note_archive":
        return NextResponse.json(await setKnowledgeNoteArchive(context, body));
      case "save_comment_content_workflow":
        return NextResponse.json(await saveCommentContentWorkflow(context, body), { status: body.workflowId ? 200 : 201 });
      case "start_checkout":
        return NextResponse.json(await startCheckout(request, context, body));
      case "start_credit_checkout":
        return NextResponse.json(await startCreditCheckout(request, context, body));
      case "billing_portal":
        return NextResponse.json(await openBillingPortal(request, context, body));
      case "reply_public_inquiry":
        return NextResponse.json(await replyPublicInquiry(context, body));
      case "update_public_inquiry":
        return NextResponse.json(await updatePublicInquiry(context, body));
      case "update_thread_status":
        return NextResponse.json(await updateThreadStatus(context, body));
      case "archive_owner_item":
        return NextResponse.json(await updateOwnerArchive(context, body, true));
      case "restore_owner_item":
        return NextResponse.json(await updateOwnerArchive(context, body, false));
      case "grant_access":
        return NextResponse.json(await grantTemporaryAccess(context, body), { status: 201 });
      case "revoke_access":
        return NextResponse.json(await revokeTemporaryAccess(context, body));
      case "create_client_invite":
        return NextResponse.json(await createClientInvite(request, context, body), { status: 201 });
      case "resend_client_invite":
        return NextResponse.json(await resendClientInvite(request, context, body));
      case "revoke_client_invite":
        return NextResponse.json(await revokeClientInvite(context, body));
      case "update_posting_task":
        return NextResponse.json(await updatePostingTask(context, body));
      default:
        throw new PortalHttpError(400, "Unknown portal action.");
    }
  } catch (error) {
    return portalError(error);
  }
}

async function replyPublicInquiry(context: PortalContext, body: ActionBody) {
  if (context.mode !== "staff" || !["owner", "admin", "manager", "support"].includes(context.staffRole ?? "")) {
    throw new PortalHttpError(403, "Staff support access is required.");
  }
  const inquiryId = requiredString(body.inquiryId, "Inquiry", 80);
  if (!isUuid(inquiryId)) throw new PortalHttpError(400, "Invalid inquiry.");
  const reply = requiredString(body.reply, "Reply", 5000);
  const assignmentFilter = context.staffRole === "owner"
    ? ""
    : `&assigned_role=eq.${encodeURIComponent(context.staffRole ?? "")}`;
  const rows = await supabaseServiceRoleRequest<PortalPublicInquiry[]>(
    `/rest/v1/wovo_public_inquiries?select=*&id=eq.${encodeURIComponent(inquiryId)}${assignmentFilter}&limit=1`
  );
  const inquiry = rows?.[0];
  if (!inquiry) throw new PortalHttpError(404, "Inquiry not found.");
  const key = getEnv("RESEND_API_KEY");
  if (!key) throw new PortalHttpError(503, "Email delivery is not configured.");
  const replyRows = await supabaseServiceRoleRequest<PortalPublicInquiryReply[]>("/rest/v1/wovo_public_inquiry_replies", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      inquiry_id: inquiry.id,
      author_user_id: context.user.id,
      author_role: context.staffRole,
      message: reply,
      delivery_status: "pending",
    }),
  });
  const replyRecord = replyRows?.[0];
  if (!replyRecord) throw new PortalHttpError(500, "The reply could not be recorded.");
  let mail: Response;
  try {
    mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "WOVO Media <support@wovomedia.com>",
        to: [inquiry.email],
        reply_to: "support@wovomedia.com",
        subject: `WOVO response · ${inquiry.case_reference} · ${inquiry.subject}`,
        html: `<div style="background:#f3efe6;padding:32px;font-family:Arial,sans-serif;color:#191714"><div style="max-width:620px;margin:auto;background:#fffdf8;border:1px solid #ded6c8;border-radius:18px;padding:28px"><div style="width:48px;height:5px;border-radius:99px;background:#f05a3a"></div><p style="margin:20px 0 4px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d94326">WOVO Media · ${inquiry.case_reference}</p><h1 style="font-size:24px;margin:10px 0 18px">A response from the WOVO team</h1><div style="white-space:pre-wrap;line-height:1.7;color:#4d473f">${escapeHtml(reply)}</div><p style="margin-top:24px;font-size:12px;line-height:1.6;color:#756e64">Reply to this email or use the inquiry form at wovomedia.com/contact. WOVO staff personal contact details are never exposed.</p></div></div>`,
      }),
      cache: "no-store",
    });
  } catch {
    await updatePublicInquiryReplyDelivery(replyRecord.id, "failed");
    throw new PortalHttpError(502, "The reply could not be delivered. No case status was changed.");
  }
  if (!mail.ok) {
    await updatePublicInquiryReplyDelivery(replyRecord.id, "failed");
    throw new PortalHttpError(502, "The reply could not be delivered. No case status was changed.");
  }
  await updatePublicInquiryReplyDelivery(replyRecord.id, "delivered");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_public_inquiries?id=eq.${encodeURIComponent(inquiryId)}${assignmentFilter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "replied",
      staff_reply: reply,
      replied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  await insertAdminAudit(context, "reply_case", "inquiry", inquiry.id, inquiry.case_reference, {
    delivery: "delivered",
  });
  return { delivered: true };
}

async function updatePublicInquiryReplyDelivery(replyId: string, deliveryStatus: "delivered" | "failed") {
  await supabaseServiceRoleRequest(`/rest/v1/wovo_public_inquiry_replies?id=eq.${encodeURIComponent(replyId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ delivery_status: deliveryStatus }),
  }).catch(() => null);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function requireOwner(context: PortalContext) {
  if (context.mode !== "staff" || context.staffRole !== "owner") {
    throw new PortalHttpError(403, "President / owner access is required.");
  }
}

async function insertAdminAudit(
  context: PortalContext,
  action: string,
  targetType: string,
  targetId: string,
  targetLabel: string,
  metadata: Record<string, unknown> = {}
) {
  await supabaseServiceRoleRequest("/rest/v1/wovo_portal_admin_audit", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: context.user.id,
      action: action,
      target_type: targetType,
      target_id: targetId,
      target_label: targetLabel,
      metadata,
    }),
  });
}

async function updateOwnerArchive(context: PortalContext, body: ActionBody, archive: boolean) {
  requireOwner(context);
  const targetType = enumValue(body.targetType, ["workspace", "content", "asset", "inquiry"], "Target type");
  const targetId = requiredString(body.targetId, "Target", 80);
  if (!isUuid(targetId)) throw new PortalHttpError(400, "Invalid archive target.");
  const confirmationLabel = requiredString(body.confirmationLabel, "Confirmation label", 240);
  const targets = {
    workspace: { table: "wovo_portal_accounts", label: "business_name" },
    content: { table: "wovo_portal_content_items", label: "title" },
    asset: { table: "wovo_portal_assets", label: "file_name" },
    inquiry: { table: "wovo_public_inquiries", label: "case_reference" },
  } as const;
  const target = targets[targetType as keyof typeof targets];
  const rows = await supabaseServiceRoleRequest<Array<Record<string, unknown>>>(
    `/rest/v1/${target.table}?select=id,${target.label},archived_at&id=eq.${encodeURIComponent(targetId)}&limit=1`
  ).catch(() => []);
  const row = rows?.[0];
  if (!row) throw new PortalHttpError(404, "The selected item no longer exists.");
  const canonicalLabel = String(row[target.label] ?? "");
  if (canonicalLabel !== confirmationLabel) {
    throw new PortalHttpError(409, "The confirmation name no longer matches. Refresh and try again.");
  }
  const currentlyArchived = Boolean(row.archived_at);
  if (archive === currentlyArchived) return { unchanged: true };
  await supabaseServiceRoleRequest(`/rest/v1/${target.table}?id=eq.${encodeURIComponent(targetId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      archived_at: archive ? new Date().toISOString() : null,
      archived_by: archive ? context.user.id : null,
    }),
  });
  await insertAdminAudit(context, archive ? "archive" : "restore", targetType, targetId, canonicalLabel);
  return { archived: archive };
}

async function updatePublicInquiry(context: PortalContext, body: ActionBody) {
  if (context.mode !== "staff" || !["owner", "admin", "manager", "support"].includes(context.staffRole ?? "")) {
    throw new PortalHttpError(403, "Staff support access is required.");
  }
  const inquiryId = requiredString(body.inquiryId, "Inquiry", 80);
  if (!isUuid(inquiryId)) throw new PortalHttpError(400, "Invalid inquiry.");
  const assignmentFilter = context.staffRole === "owner"
    ? ""
    : `&assigned_role=eq.${encodeURIComponent(context.staffRole ?? "")}`;
  const rows = await supabaseServiceRoleRequest<PortalPublicInquiry[]>(
    `/rest/v1/wovo_public_inquiries?select=*&id=eq.${encodeURIComponent(inquiryId)}&archived_at=is.null${assignmentFilter}&limit=1`
  ).catch(() => []);
  const inquiry = rows?.[0];
  if (!inquiry) throw new PortalHttpError(404, "Inquiry not found.");
  const assignedRole = body.assignedRole === undefined
    ? inquiry.assigned_role
    : enumValue(body.assignedRole, ["owner", "admin", "manager", "support"], "Assigned role");
  const status = body.status === undefined
    ? inquiry.status
    : enumValue(body.status, ["new", "open", "in_progress", "replied", "resolved"], "Status");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_public_inquiries?id=eq.${encodeURIComponent(inquiryId)}${assignmentFilter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ assigned_role: assignedRole, status, updated_at: new Date().toISOString() }),
  });
  if (assignedRole !== inquiry.assigned_role) {
    await insertAdminAudit(context, "assign_case", "inquiry", inquiry.id, inquiry.case_reference, {
      from: inquiry.assigned_role,
      to: assignedRole,
    });
  }
  if (status !== inquiry.status) {
    await insertAdminAudit(context, "change_case_status", "inquiry", inquiry.id, inquiry.case_reference, {
      from: inquiry.status,
      to: status,
    });
  }
  return { updated: true };
}

async function updateThreadStatus(context: PortalContext, body: ActionBody) {
  if (context.mode !== "staff" || !["owner", "admin", "manager"].includes(context.staffRole ?? "")) {
    throw new PortalHttpError(403, "Owner, admin, or manager access is required.");
  }
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  const threadId = requiredString(body.threadId, "Thread", 80);
  if (!isUuid(threadId)) throw new PortalHttpError(400, "Invalid support case.");
  const status = enumValue(body.status, ["open", "in_progress", "resolved"], "Status");
  const rows = await supabaseServiceRoleRequest<PortalThread[]>(
    `/rest/v1/wovo_portal_threads?select=*&id=eq.${encodeURIComponent(threadId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`
  ).catch(() => []);
  const thread = rows?.[0];
  if (!thread) throw new PortalHttpError(404, "Support case not found.");
  await supabaseServiceRoleRequest(
    `/rest/v1/wovo_portal_threads?id=eq.${encodeURIComponent(threadId)}&account_id=eq.${encodeURIComponent(accountId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    }
  );
  await insertAdminAudit(context, "change_case_status", "thread", thread.id, thread.case_reference, {
    from: thread.status,
    to: status,
    accountId,
  });
  return { updated: true };
}

async function grantTemporaryAccess(context: PortalContext, body: ActionBody) {
  requireOwner(context);
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  const grantType = enumValue(body.grantType, ["test", "trial", "staff_assisted"], "Access type");
  const reason = requiredString(body.reason, "Reason", 500);
  const days = numberValue(body.days, "Access days", 1, 30);
  const accountRows = await supabaseServiceRoleRequest<PortalAccount[]>(
    `/rest/v1/wovo_portal_accounts?select=*&id=eq.${encodeURIComponent(accountId)}&archived_at=is.null&limit=1`
  ).catch(() => []);
  const account = accountRows?.[0];
  if (!account) throw new PortalHttpError(404, "Client workspace not found.");
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const rows = await supabaseServiceRoleRequest<PortalAccessGrant[]>("/rest/v1/wovo_portal_access_grants", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      account_id: accountId,
      grant_type: grantType,
      reason,
      expires_at: expiresAt,
      granted_by: context.user.id,
    }),
  });
  const grant = rows?.[0];
  if (!grant) throw new Error("Unable to create the access grant.");
  await insertAdminAudit(context, "grant_access", "access_grant", grant.id, account.business_name, {
    accountId,
    grantType,
    expiresAt,
    reason,
  });
  return { grant };
}

async function revokeTemporaryAccess(context: PortalContext, body: ActionBody) {
  requireOwner(context);
  const grantId = requiredString(body.grantId, "Access grant", 80);
  if (!isUuid(grantId)) throw new PortalHttpError(400, "Invalid access grant.");
  const rows = await supabaseServiceRoleRequest<PortalAccessGrant[]>(
    `/rest/v1/wovo_portal_access_grants?select=*&id=eq.${encodeURIComponent(grantId)}&revoked_at=is.null&limit=1`
  ).catch(() => []);
  const grant = rows?.[0];
  if (!grant) throw new PortalHttpError(404, "Active access grant not found.");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_portal_access_grants?id=eq.${encodeURIComponent(grantId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ revoked_at: new Date().toISOString(), revoked_by: context.user.id }),
  });
  const accountRows = await supabaseServiceRoleRequest<Array<{ business_name: string }>>(
    `/rest/v1/wovo_portal_accounts?select=business_name&id=eq.${encodeURIComponent(grant.account_id)}&limit=1`
  ).catch(() => []);
  await insertAdminAudit(
    context,
    "revoke_access",
    "access_grant",
    grant.id,
    accountRows?.[0]?.business_name ?? "Client workspace",
    { accountId: grant.account_id }
  );
  return { revoked: true };
}

type GeneratedAuthLink = {
  action_link?: string;
  user?: { id?: string; email?: string };
};

async function generateInviteLink(email: string, redirectTo: string): Promise<{ actionLink: string; userId: string }> {
  const generated = await supabaseServiceRoleRequest<GeneratedAuthLink>("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({
      type: "invite",
      email,
      redirect_to: redirectTo,
      data: { invitation_source: "wovo_owner_migration" },
    }),
  });
  const actionLink = generated?.action_link;
  const userId = generated?.user?.id;
  if (!actionLink || !userId) throw new PortalHttpError(502, "Supabase could not create a secure client invitation.");
  return { actionLink, userId };
}

async function deliverClientInvite(email: string, businessName: string, actionLink: string) {
  const key = getEnv("RESEND_API_KEY");
  if (!key) throw new PortalHttpError(503, "Client invitation email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "WOVO Media <support@wovomedia.com>",
      to: [email],
      reply_to: "support@wovomedia.com",
      subject: `Set up your private ${businessName} workspace`,
      html: `<div style="background:#f3efe6;padding:32px;font-family:Arial,sans-serif;color:#191714"><div style="max-width:620px;margin:auto;background:#fffdf8;border:1px solid #ded6c8;border-radius:18px;padding:28px"><div style="width:48px;height:5px;border-radius:99px;background:#f05a3a"></div><p style="margin:20px 0 4px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d94326">Private WOVO client invitation</p><h1 style="font-size:24px;margin:10px 0 18px">Your workspace is ready to claim.</h1><p style="line-height:1.7;color:#4d473f">WOVO Media prepared a private workspace for <strong>${escapeHtml(businessName)}</strong>. Use the secure, expiring link below to verify your email and choose your own password. WOVO will never create or send a shared password.</p><a href="${escapeHtml(actionLink)}" style="display:inline-block;margin-top:18px;background:#f05a3a;color:#191714;text-decoration:none;border-radius:12px;padding:14px 20px;font-weight:700">Verify email and set password</a><p style="margin-top:24px;font-size:12px;line-height:1.6;color:#756e64">If you did not expect this invitation, ignore this message or contact support@wovomedia.com. The link expires and can be revoked by WOVO.</p></div></div>`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new PortalHttpError(502, "The secure invitation was created, but email delivery failed.");
}

async function createClientInvite(request: Request, context: PortalContext, body: ActionBody) {
  requireOwner(context);
  const email = requiredString(body.email, "Client email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PortalHttpError(400, "Enter a valid client email.");
  const businessName = requiredString(body.businessName, "Business name", 120);
  const businessType = enumValue(body.businessType ?? "local_business", BUSINESS_TYPES, "Business type");
  const location = requiredString(body.location, "Service area", 240);
  const existing = await supabaseServiceRoleRequest<Array<{ id: string }>>(
    `/rest/v1/wovo_portal_client_invites?select=id&invited_email=eq.${encodeURIComponent(email)}&status=eq.pending&limit=1`
  ).catch(() => []);
  if (existing?.[0]) throw new PortalHttpError(409, "A pending invitation already exists for this email. Resend or revoke it instead.");
  const { actionLink, userId } = await generateInviteLink(email, `${siteUrl(request)}/auth/callback?next=/reset-password`);
  let account: PortalAccount | undefined;
  try {
    const accountRows = await supabaseServiceRoleRequest<PortalAccount[]>("/rest/v1/wovo_portal_accounts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        owner_user_id: userId,
        contact_email: email,
        business_name: businessName,
        business_type: businessType,
        location,
        timezone: "America/Chicago",
        posting_cadence_per_week: 3,
        preferred_platforms: [],
        asset_rights_confirmed: false,
      }),
    });
    account = accountRows?.[0];
    if (!account) throw new Error("Unable to create the draft client workspace.");
    await Promise.all([
      supabaseServiceRoleRequest("/rest/v1/wovo_portal_members", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ account_id: account.id, user_id: userId, role: "client", active: true }),
      }),
      supabaseServiceRoleRequest("/rest/v1/wovo_portal_subscriptions", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ account_id: account.id, user_id: userId, status: "inactive" }),
      }),
      supabaseServiceRoleRequest("/rest/v1/wovo_portal_threads", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ account_id: account.id, subject: "WOVO team support", status: "open", priority: "normal" }),
      }),
    ]);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const inviteRows = await supabaseServiceRoleRequest<PortalClientInvite[]>("/rest/v1/wovo_portal_client_invites", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        account_id: account.id,
        invited_email: email,
        invited_user_id: userId,
        invited_by: context.user.id,
        expires_at: expiresAt,
      }),
    });
    const invite = inviteRows?.[0];
    if (!invite) throw new Error("Unable to record the client invitation.");
    await deliverClientInvite(email, businessName, actionLink);
    await insertAdminAudit(context, "create_client_invite", "client_invite", invite.id, businessName, {
      accountId: account.id,
      expiresAt,
    });
    return { account, invite };
  } catch (error) {
    if (account?.id) {
      await supabaseServiceRoleRequest(`/rest/v1/wovo_portal_accounts?id=eq.${encodeURIComponent(account.id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      }).catch(() => null);
    }
    await deleteAuthUserById(userId).catch(() => null);
    throw error;
  }
}

async function resendClientInvite(request: Request, context: PortalContext, body: ActionBody) {
  requireOwner(context);
  const inviteId = requiredString(body.inviteId, "Invitation", 80);
  if (!isUuid(inviteId)) throw new PortalHttpError(400, "Invalid invitation.");
  const rows = await supabaseServiceRoleRequest<PortalClientInvite[]>(
    `/rest/v1/wovo_portal_client_invites?select=*&id=eq.${encodeURIComponent(inviteId)}&status=eq.pending&limit=1`
  ).catch(() => []);
  const invite = rows?.[0];
  if (!invite) throw new PortalHttpError(404, "Pending invitation not found.");
  const accounts = await supabaseServiceRoleRequest<Array<{ business_name: string }>>(
    `/rest/v1/wovo_portal_accounts?select=business_name&id=eq.${encodeURIComponent(invite.account_id)}&limit=1`
  ).catch(() => []);
  const businessName = accounts?.[0]?.business_name ?? "client";
  const { actionLink, userId } = await generateInviteLink(
    invite.invited_email,
    `${siteUrl(request)}/auth/callback?next=/reset-password`
  );
  if (invite.invited_user_id && userId !== invite.invited_user_id) {
    throw new PortalHttpError(409, "The invitation identity changed. Revoke it and create a new invite.");
  }
  await deliverClientInvite(invite.invited_email, businessName, actionLink);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabaseServiceRoleRequest(`/rest/v1/wovo_portal_client_invites?id=eq.${encodeURIComponent(invite.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_sent_at: new Date().toISOString(), expires_at: expiresAt, updated_at: new Date().toISOString() }),
  });
  await insertAdminAudit(context, "resend_client_invite", "client_invite", invite.id, businessName, {
    accountId: invite.account_id,
    expiresAt,
  });
  return { resent: true };
}

async function revokeClientInvite(context: PortalContext, body: ActionBody) {
  requireOwner(context);
  const inviteId = requiredString(body.inviteId, "Invitation", 80);
  if (!isUuid(inviteId)) throw new PortalHttpError(400, "Invalid invitation.");
  const rows = await supabaseServiceRoleRequest<PortalClientInvite[]>(
    `/rest/v1/wovo_portal_client_invites?select=*&id=eq.${encodeURIComponent(inviteId)}&status=eq.pending&limit=1`
  ).catch(() => []);
  const invite = rows?.[0];
  if (!invite) throw new PortalHttpError(404, "Pending invitation not found.");
  const accounts = await supabaseServiceRoleRequest<Array<{ business_name: string }>>(
    `/rest/v1/wovo_portal_accounts?select=business_name&id=eq.${encodeURIComponent(invite.account_id)}&limit=1`
  ).catch(() => []);
  await Promise.all([
    supabaseServiceRoleRequest(`/rest/v1/wovo_portal_client_invites?id=eq.${encodeURIComponent(invite.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: context.user.id,
        updated_at: new Date().toISOString(),
      }),
    }),
    supabaseServiceRoleRequest(
      `/rest/v1/wovo_portal_members?account_id=eq.${encodeURIComponent(invite.account_id)}&user_id=eq.${encodeURIComponent(invite.invited_user_id ?? "")}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ active: false }),
      }
    ),
  ]);
  const businessName = accounts?.[0]?.business_name ?? "Client workspace";
  await insertAdminAudit(context, "revoke_client_invite", "client_invite", invite.id, businessName, {
    accountId: invite.account_id,
  });
  return { revoked: true };
}

async function updatePostingTask(context: PortalContext, body: ActionBody) {
  requireOwner(context);
  const taskId = requiredString(body.taskId, "Posting task", 80);
  if (!isUuid(taskId)) throw new PortalHttpError(400, "Invalid posting task.");
  const status = enumValue(body.status, ["pending", "in_progress", "completed", "canceled"], "Status");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_portal_posting_tasks?id=eq.${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      completed_by: status === "completed" ? context.user.id : null,
      updated_at: new Date().toISOString(),
    }),
  });
  return { updated: true };
}

async function onboard(context: PortalContext, body: ActionBody) {
  if (context.mode === "staff") throw new PortalHttpError(403, "Staff accounts cannot create a client workspace.");
  const existing = await getPortalAccountIds(context);
  if (existing.length > 0) throw new PortalHttpError(409, "This account already has a client workspace.");
  const contactEmail = requiredString(context.user.email, "Verified account email", 320);
  const businessName = requiredString(body.businessName, "Business name", 120);
  const businessType = enumValue(body.businessType, BUSINESS_TYPES, "Business type");
  const location = requiredString(body.location, "Location", 240);
  const cadence = numberValue(body.cadence, "Posting cadence", 1, 7);
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((item): item is string => typeof item === "string" && PLATFORM_VALUES.includes(item)).slice(0, 7)
    : [];
  const rightsConfirmed = body.rightsConfirmed === true;
  if (!rightsConfirmed) throw new PortalHttpError(400, "Confirm that you own or have permission to use submitted business assets.");
  const rawPlan = body.onboardingPlan && typeof body.onboardingPlan === "object" && !Array.isArray(body.onboardingPlan)
    ? body.onboardingPlan as Record<string, unknown>
    : {};
  const list = (value: unknown, allowed: string[]) => Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && allowed.includes(item)))].slice(0, allowed.length)
    : [];
  const logoStatus = rawPlan.logoStatus === "needs_help" ? "needs_help" : "ready_to_upload";
  const rawColors = Array.isArray(rawPlan.brandColors) ? rawPlan.brandColors : [];
  const brandColors = rawColors.filter((item): item is string => typeof item === "string" && /^#[0-9a-f]{6}$/i.test(item)).slice(0, 2);
  const rawWebsiteBrief = rawPlan.websiteBrief && typeof rawPlan.websiteBrief === "object" && !Array.isArray(rawPlan.websiteBrief)
    ? rawPlan.websiteBrief as Record<string, unknown>
    : {};
  const rawInvites = Array.isArray(rawPlan.employeeInviteDrafts) ? rawPlan.employeeInviteDrafts : [];
  const employeeInviteDrafts = rawInvites.slice(0, 3).map((value) => {
    const invite = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const email = requiredString(invite.email, "Employee invite email", 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PortalHttpError(400, "Enter a valid employee invite email.");
    return { email, permission: enumValue(invite.permission, ONBOARDING_PERMISSIONS, "Employee permission") };
  });
  const onboardingPlan = {
    coreModules: list(rawPlan.coreModules, ONBOARDING_MODULES),
    recurringAddons: list(rawPlan.recurringAddons, ONBOARDING_ADDONS),
    quoteServices: list(rawPlan.quoteServices, ONBOARDING_SERVICES),
    logoStatus,
    brandColors: brandColors.length === 2 ? brandColors : ["#f05a3a", "#191714"],
    websiteInterest: rawPlan.websiteInterest === true,
    websiteBrief: {
      sections: optionalString(rawWebsiteBrief.sections, 600),
      goals: optionalString(rawWebsiteBrief.goals, 1000),
    },
    employeeInviteDrafts,
    confirmedAt: new Date().toISOString(),
  };
  const rows = await supabaseServiceRoleRequest<PortalAccount[]>("/rest/v1/wovo_portal_accounts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_user_id: context.user.id,
      contact_email: contactEmail,
      business_name: businessName,
      business_type: businessType,
      website_url: optionalString(body.websiteUrl, 300),
      location,
      timezone: optionalString(body.timezone, 80) ?? "America/Chicago",
      brand_voice: optionalString(body.brandVoice, 1000),
      audience: optionalString(body.audience, 1000),
      goals: optionalString(body.goals, 1500),
      posting_cadence_per_week: cadence,
      preferred_platforms: platforms,
      asset_rights_confirmed: true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_plan: onboardingPlan,
    }),
  });
  const account = rows?.[0];
  if (!account) throw new Error("Unable to create client workspace.");
  try {
    await Promise.all([
      supabaseServiceRoleRequest("/rest/v1/wovo_portal_members", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ account_id: account.id, user_id: context.user.id, role: "client_owner" }),
      }),
      supabaseServiceRoleRequest("/rest/v1/wovo_portal_consents", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          account_id: account.id,
          user_id: context.user.id,
          consent_type: "asset_rights",
          confirmation: "I confirm that I own or have permission to use the business and brand assets I submit to WOVO Media.",
        }),
      }),
      supabaseServiceRoleRequest("/rest/v1/wovo_portal_threads", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ account_id: account.id }),
      }),
    ]);
    await insertNotification({
      account_id: account.id,
      notification_type: "new_client",
      title: `New client: ${account.business_name}`,
      body: "Onboarding is complete. Assign a representative and review the brand profile.",
      target_role: "manager",
      related_table: "wovo_portal_accounts",
      related_id: account.id,
    });
    return { account };
  } catch (error) {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_portal_accounts?id=eq.${encodeURIComponent(account.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }).catch(() => null);
    throw error;
  }
}

async function assertPaid(context: PortalContext, accountId: string): Promise<void> {
  if (context.mode === "staff") return;
  const [subscriptions, grants] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ status: string }>>(
      `/rest/v1/wovo_portal_subscriptions?select=status&account_id=eq.${encodeURIComponent(accountId)}&status=in.(active,trialing)&limit=1`
    ).catch(() => []),
    supabaseServiceRoleRequest<Array<{ id: string }>>(
      `/rest/v1/wovo_portal_access_grants?select=id&account_id=eq.${encodeURIComponent(accountId)}&revoked_at=is.null&starts_at=lte.${encodeURIComponent(new Date().toISOString())}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`
    ).catch(() => []),
  ]);
  if (!subscriptions?.[0] && !grants?.[0]) {
    throw new PortalHttpError(402, "An active WOVO subscription or owner-approved temporary access grant is required.");
  }
}

async function updateAccountProfile(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const cadence = numberValue(body.cadence, "Posting cadence", 1, 7);
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((item): item is string => typeof item === "string" && PLATFORM_VALUES.includes(item)).slice(0, 7)
    : [];
  const rows = await supabaseServiceRoleRequest<PortalAccount[]>(
    `/rest/v1/wovo_portal_accounts?id=eq.${encodeURIComponent(accountId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        brand_voice: optionalString(body.brandVoice, 1000),
        audience: optionalString(body.audience, 1000),
        goals: optionalString(body.goals, 1500),
        posting_cadence_per_week: cadence,
        preferred_platforms: platforms,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!rows?.[0]) throw new PortalHttpError(404, "Workspace not found.");
  return { account: rows[0] };
}

async function createContent(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const contentType = enumValue(body.contentType ?? "social_post", CONTENT_TYPES, "Content type");
  const rightsConfirmed = body.rightsConfirmed === true;
  if ((contentType === "property_marketing" || body.assetId) && !rightsConfirmed) {
    throw new PortalHttpError(400, "Confirm that the client has rights to the supplied property or brand assets.");
  }
  let assetId: string | null = null;
  if (body.assetId) {
    if (!isUuid(body.assetId)) throw new PortalHttpError(400, "Choose a valid workspace asset.");
    const assets = await supabaseServiceRoleRequest<Array<{ id: string; mime_type: string }>>(
      `/rest/v1/wovo_portal_assets?select=id,mime_type&id=eq.${encodeURIComponent(body.assetId)}&account_id=eq.${encodeURIComponent(accountId)}&rights_confirmed=eq.true&archived_at=is.null&limit=1`,
    );
    const asset = assets?.[0];
    if (!asset || (!asset.mime_type.startsWith("image/") && !asset.mime_type.startsWith("video/"))) {
      throw new PortalHttpError(409, "Choose a rights-confirmed image or video from this workspace.");
    }
    assetId = asset.id;
  }
  const rows = await supabaseServiceRoleRequest<PortalContentItem[]>("/rest/v1/wovo_portal_content_items", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      account_id: accountId,
      created_by: context.user.id,
      title: requiredString(body.title, "Title", 160),
      caption: requiredString(body.caption, "Caption", 5000),
      platform: enumValue(body.platform, PLATFORM_VALUES, "Platform"),
      content_type: contentType,
      scheduled_for: body.scheduledFor ? parseIsoDate(body.scheduledFor, "Scheduled date") : null,
      status: "client_review",
      creative_brief: optionalString(body.creativeBrief, 3000),
      hashtags: Array.isArray(body.hashtags)
        ? body.hashtags.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 30)
        : [],
      timezone: optionalString(body.timezone, 80) ?? "America/Chicago",
      asset_id: assetId,
      source_rights_confirmed: rightsConfirmed,
      ai_generated: false,
    }),
  });
  const item = rows?.[0];
  if (!item) throw new Error("Unable to create content item.");
  await insertNotification({
    account_id: accountId,
    notification_type: "content_ready",
    title: `Content ready: ${item.title}`,
    body: "Review the exact caption, asset, platform, and scheduled time before approval.",
    target_role: "manager",
    related_table: "wovo_portal_content_items",
    related_id: item.id,
  });
  return { item };
}

async function updateContent(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  const contentId = requiredString(body.contentId, "Content item", 80);
  await assertPortalAccountAccess(context, accountId);
  const status = requiredString(body.status, "Status", 40);
  if (status === "approved") return approveContent(context, body, "item");
  const allowed = context.mode === "staff"
    ? ["queued", "revision_requested", "manual_posted", "canceled"]
    : ["revision_requested"];
  if (!allowed.includes(status)) throw new PortalHttpError(403, "That status change is not allowed.");
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    client_feedback: optionalString(body.feedback, 1500),
  };
  if (status === "manual_posted") patch.posted_at = new Date().toISOString();
  const rows = await supabaseServiceRoleRequest<PortalContentItem[]>(
    `/rest/v1/wovo_portal_content_items?id=eq.${encodeURIComponent(contentId)}&account_id=eq.${encodeURIComponent(accountId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    }
  );
  if (!rows?.[0]) throw new PortalHttpError(404, "Content item not found.");
  return { item: rows[0] };
}

function firstRpcRow<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function approveContent(
  context: PortalContext,
  body: ActionBody,
  scope: "item" | "date_range",
  range?: { start: string; end: string; correlationId: string }
) {
  const accountId = requiredString(body.accountId, "Account", 80);
  const contentId = requiredString(body.contentId, "Content item", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const result = await supabaseServiceRoleRequest<PortalContentApproval | PortalContentApproval[]>(
    "/rest/v1/rpc/wovo_approve_content_item",
    {
      method: "POST",
      body: JSON.stringify({
        p_account_id: accountId,
        p_content_item_id: contentId,
        p_approved_by: context.user.id,
        p_approval_scope: scope,
        p_range_start: range?.start ?? null,
        p_range_end: range?.end ?? null,
        p_correlation_id: range?.correlationId ?? crypto.randomUUID(),
      }),
    }
  );
  const approval = firstRpcRow(result);
  if (!approval) throw new Error("Unable to record the approval snapshot.");
  const itemRows = await supabaseServiceRoleRequest<PortalContentItem[]>(
    `/rest/v1/wovo_portal_content_items?select=*&id=eq.${encodeURIComponent(contentId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`
  );
  const item = itemRows?.[0];
  if (!item) throw new PortalHttpError(404, "Content item not found.");
  await insertNotification({
    account_id: accountId,
    notification_type: "content_approved",
    title: `Approved: ${item.title}`,
    body: "The exact approved version is ready for the WOVO manual posting workflow. Any edit requires a new approval.",
    target_role: "manager",
    related_table: "wovo_portal_content_items",
    related_id: item.id,
  });
  return { item, approval };
}

async function approveContentRange(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const startDate = optionalDateOnly(body.startDate, "Approval start");
  const endDate = optionalDateOnly(body.endDate, "Approval end");
  if (!startDate || !endDate) throw new PortalHttpError(400, "Choose an approval start and end date.");
  const start = new Date(`${startDate}T00:00:00.000Z`).toISOString();
  const end = new Date(`${endDate}T23:59:59.999Z`).toISOString();
  if (Date.parse(end) < Date.parse(start)) throw new PortalHttpError(400, "Approval end must be after the start.");
  if (Date.parse(end) - Date.parse(start) > 93 * 86400000) throw new PortalHttpError(400, "Approve at most 93 days at once.");
  const correlationId = crypto.randomUUID();
  const approvals = await supabaseServiceRoleRequest<PortalContentApproval[]>(
    "/rest/v1/rpc/wovo_approve_content_range",
    {
      method: "POST",
      body: JSON.stringify({
        p_account_id: accountId,
        p_approved_by: context.user.id,
        p_range_start: start,
        p_range_end: end,
        p_correlation_id: correlationId,
      }),
    }
  );
  if (!approvals?.length) throw new PortalHttpError(404, "No review-ready scheduled posts were found in that range.");
  await insertNotification({
    account_id: accountId,
    notification_type: "content_approved",
    title: `${approvals.length} scheduled posts approved`,
    body: "The exact versions in this date range are now eligible for the manual posting workflow. Any edit requires reapproval.",
    target_role: "manager",
    related_table: "wovo_portal_accounts",
    related_id: accountId,
  });
  return { approvedCount: approvals.length, correlationId, approvals };
}

async function revokeContentApproval(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  const contentId = requiredString(body.contentId, "Content item", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const result = await supabaseServiceRoleRequest<PortalContentItem | PortalContentItem[]>(
    "/rest/v1/rpc/wovo_revoke_content_approval",
    {
      method: "POST",
      body: JSON.stringify({
        p_account_id: accountId,
        p_content_item_id: contentId,
        p_revoked_by: context.user.id,
        p_reason: optionalString(body.reason, 500) ?? "Approval revoked for revision",
      }),
    }
  );
  const item = firstRpcRow(result);
  if (!item) throw new Error("Unable to revoke the content approval.");
  await insertNotification({
    account_id: accountId,
    notification_type: "content_revision",
    title: `Approval revoked: ${item.title}`,
    body: "This item returned to review. It cannot be queued or published until its current version is approved again.",
    target_role: "manager",
    related_table: "wovo_portal_content_items",
    related_id: item.id,
  });
  return { item };
}

type GeneratedIdea = { date?: string; title?: string; caption?: string; platform?: string; content_type?: string };

async function generateCalendar(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const rate = checkAiRateLimit(context.user.id, "portal_calendar");
  if (!rate.allowed) throw new PortalHttpError(429, "Please wait before generating another calendar.");
  const accounts = await supabaseServiceRoleRequest<PortalAccount[]>(
    `/rest/v1/wovo_portal_accounts?select=*&id=eq.${encodeURIComponent(accountId)}&limit=1`
  );
  const account = accounts?.[0];
  if (!account) throw new PortalHttpError(404, "Client workspace not found.");
  const requiredAssets = await supabaseServiceRoleRequest<Array<{ asset_kind: string }>>(
    `/rest/v1/wovo_portal_assets?select=asset_kind&account_id=eq.${encodeURIComponent(accountId)}&asset_kind=in.(brand,food)&rights_confirmed=eq.true&archived_at=is.null`
  ).catch(() => []);
  if (!requiredAssets?.some((asset) => asset.asset_kind === "brand")) {
    throw new PortalHttpError(428, "Upload a rights-confirmed brand/logo asset before generating a content plan.");
  }
  if (account.business_type === "restaurant" && !requiredAssets.some((asset) => asset.asset_kind === "food")) {
    throw new PortalHttpError(428, "Restaurant workspaces need at least one rights-confirmed food photo before generating a content plan.");
  }
  const start = new Date(parseIsoDate(body.startDate, "Start date"));
  const end = new Date(parseIsoDate(body.endDate, "End date"));
  const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (rangeDays < 0 || rangeDays > 31) throw new PortalHttpError(400, "Calendar range must be between 1 and 31 days.");
  const cadence = numberValue(body.cadence ?? account.posting_cadence_per_week, "Posting cadence", 1, 7);
  const maxItems = Math.min(14, Math.max(1, Math.ceil(((rangeDays + 1) / 7) * cadence)));
  const propertyRule = account.business_type === "realtor"
    ? "Only suggest property marketing based on client-supplied, authorized facts and assets. Never scrape Zillow or invent listing details."
    : "";
  const result = await generateTextWithProviders({
    provider: "openai",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: [
          "You are WOVO Media's human-in-the-loop content planner.",
          `Return ONLY a valid JSON array with exactly ${maxItems} objects.`,
          "Each object must include date (ISO 8601), title, caption, platform, and content_type.",
          "Allowed platforms: facebook, instagram, linkedin, tiktok, youtube, google_business, other.",
          "Allowed content_type values: social_post, special, property_marketing, project_update.",
          "Do not claim automatic publishing. Do not invent prices, availability, reviews, results, listing facts, or business claims.",
          "Keep captions ready for a human team member to review and manually post.",
          propertyRule,
        ].filter(Boolean).join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          business_name: account.business_name,
          business_type: account.business_type,
          location: account.location,
          brand_voice: account.brand_voice,
          audience: account.audience,
          goals: account.goals,
          preferred_platforms: account.preferred_platforms,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          cadence_per_week: cadence,
        }),
      },
    ],
  });
  let ideas: GeneratedIdea[];
  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    ideas = JSON.parse(cleaned) as GeneratedIdea[];
  } catch {
    throw new PortalHttpError(502, "The AI planner returned an invalid calendar. No posts were saved.");
  }
  if (!Array.isArray(ideas) || ideas.length === 0 || ideas.length > 14) {
    throw new PortalHttpError(502, "The AI planner returned an invalid number of posts. No posts were saved.");
  }
  const payload = ideas.map((idea, index) => {
    const date = new Date(parseIsoDate(idea.date, `Post ${index + 1} date`));
    if (date < start || date > new Date(end.getTime() + 86400000)) {
      throw new PortalHttpError(502, "The AI planner returned a date outside the requested range. No posts were saved.");
    }
    const contentType = enumValue(idea.content_type ?? "social_post", CONTENT_TYPES, "Content type");
    return {
      account_id: accountId,
      created_by: context.user.id,
      title: requiredString(idea.title, "Generated title", 160),
      caption: requiredString(idea.caption, "Generated caption", 5000),
      platform: enumValue(idea.platform ?? "instagram", PLATFORM_VALUES, "Platform"),
      content_type: contentType,
      scheduled_for: date.toISOString(),
      status: "client_review",
      source_rights_confirmed: contentType !== "property_marketing" || account.asset_rights_confirmed,
      ai_generated: true,
      ai_provider: result.provider,
      ai_model: result.model,
    };
  });
  const saved = await supabaseServiceRoleRequest<PortalContentItem[]>("/rest/v1/wovo_portal_content_items", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  await insertNotification({
    account_id: accountId,
    notification_type: "content_ready",
    title: `${saved?.length ?? payload.length} AI-assisted posts ready for review`,
    body: "Review every caption and asset before moving it to the manual publishing queue.",
    target_role: "manager",
    related_table: "wovo_portal_accounts",
    related_id: accountId,
  });
  return { items: saved ?? [], provider: result.provider, model: result.model };
}

async function sendMessage(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const threadId = requiredString(body.threadId, "Thread", 80);
  const threadRows = await supabaseServiceRoleRequest<Array<{ id: string; case_reference: string }>>(
    `/rest/v1/wovo_portal_threads?select=id,case_reference&id=eq.${encodeURIComponent(threadId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`
  );
  const thread = threadRows?.[0];
  if (!thread) throw new PortalHttpError(404, "Support case not found.");
  const visibility = context.mode === "staff" && body.visibility === "internal" ? "internal" : "client";
  const rows = await supabaseServiceRoleRequest<PortalMessage[]>(
    "/rest/v1/wovo_portal_messages",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        thread_id: threadId,
        account_id: accountId,
        sender_user_id: context.user.id,
        body: requiredString(body.message, "Message", 5000),
        visibility,
      }),
    }
  );
  const message = rows?.[0];
  if (!message) throw new Error("Unable to send message.");
  await supabaseServiceRoleRequest(
    `/rest/v1/wovo_portal_threads?id=eq.${encodeURIComponent(threadId)}&account_id=eq.${encodeURIComponent(accountId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_message_at: message.created_at, status: "open", updated_at: new Date().toISOString() }),
    }
  );
  if (context.mode === "client") {
    await insertNotification({
      account_id: accountId,
      notification_type: "support_message",
      title: `New client message · ${thread.case_reference}`,
      body: `Open ${thread.case_reference} in the WOVO operations portal. Message content is intentionally omitted from notifications.`,
      target_role: "support",
      related_table: "wovo_portal_threads",
      related_id: threadId,
    });
  }
  return { message: { ...message, sender_label: context.mode === "staff" ? "WOVO team" : "Client" } };
}

async function assignThread(context: PortalContext, body: ActionBody) {
  if (context.mode !== "staff" || !["owner", "admin", "manager"].includes(context.staffRole ?? "")) {
    throw new PortalHttpError(403, "Owner, admin, or manager access is required.");
  }
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  const threadId = requiredString(body.threadId, "Thread", 80);
  const assignedRole = enumValue(
    body.assignedRole,
    ["owner", "admin", "manager", "video_editor", "website_designer", "support"],
    "Assigned role"
  );
  const note = optionalString(body.note, 1000);
  const rows = await supabaseServiceRoleRequest<PortalThread[]>(
    `/rest/v1/wovo_portal_threads?id=eq.${encodeURIComponent(threadId)}&account_id=eq.${encodeURIComponent(accountId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        assigned_role: assignedRole,
        assigned_staff_user_id: null,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      }),
    }
  );
  const thread = rows?.[0];
  if (!thread) throw new PortalHttpError(404, "Support case not found.");
  await supabaseServiceRoleRequest("/rest/v1/wovo_portal_thread_assignments", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      thread_id: thread.id,
      account_id: accountId,
      assigned_by: context.user.id,
      assigned_role: assignedRole,
      note,
    }),
  });
  await insertAdminAudit(context, "assign_case", "thread", thread.id, thread.case_reference, {
    accountId,
    assignedRole,
    note,
  });
  return { thread };
}

async function createEvent(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const eventType = enumValue(body.eventType, ["consultation", "shoot"], "Event type");
  const startsAt = new Date(parseIsoDate(body.startsAt, "Start time"));
  if (startsAt.getTime() < Date.now() + 60 * 60 * 1000) {
    throw new PortalHttpError(400, "Choose a time at least one hour in the future.");
  }
  const participantCount = eventType === "consultation"
    ? numberValue(body.participantCount ?? 1, "Participant count", 1, 10)
    : 1;
  const endsAt = new Date(startsAt.getTime() + (eventType === "consultation" ? 30 : 120) * 60000);
  const status = participantCount > 1 ? "pending_addon" : "requested";
  const location = optionalString(body.location, 240);
  if (eventType === "shoot" && !location) throw new PortalHttpError(400, "Shoot location is required.");
  const rows = await supabaseServiceRoleRequest<PortalEvent[]>("/rest/v1/wovo_portal_events", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      account_id: accountId,
      requested_by: context.user.id,
      event_type: eventType,
      title: eventType === "consultation" ? "Video consultation with WOVO Media" : "On-location content shoot",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      location,
      status,
      participant_count: participantCount,
      travel_estimate_note: eventType === "shoot"
        ? "Road-distance estimate pending from WOVO's private dispatch point. No flight pricing is included or inferred."
        : null,
    }),
  });
  const event = rows?.[0];
  if (!event) throw new Error("Unable to schedule request.");
  if (eventType === "shoot" || participantCount > 1) {
    const orderType = eventType === "shoot" ? "shoot" : "extra_participant";
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_orders", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        requested_by: context.user.id,
        order_type: orderType,
        status: getPortalPriceId(orderType) ? "checkout_pending" : "quote_required",
        description: eventType === "shoot"
          ? "Prepaid on-location content shoot. Travel is quoted separately using road distance from WOVO's private dispatch point."
          : `${participantCount - 1} additional consultation participant(s).`,
        location,
        related_event_id: event.id,
      }),
    });
  }
  await insertNotification({
    account_id: accountId,
    notification_type: "consultation_requested",
    title: eventType === "consultation" ? "Consultation requested" : "Shoot requested",
    body: "A manager should review availability, assign a qualified WOVO representative, and confirm the provider link.",
    target_role: "manager",
    related_table: "wovo_portal_events",
    related_id: event.id,
  });
  return { event };
}

async function updateEvent(context: PortalContext, body: ActionBody) {
  if (context.mode !== "staff" || !["owner", "admin", "manager"].includes(context.staffRole ?? "")) {
    throw new PortalHttpError(403, "Manager access is required.");
  }
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  const eventId = requiredString(body.eventId, "Event", 80);
  const status = enumValue(body.status, ["confirmed", "completed", "canceled"], "Status");
  const meetingProvider = optionalString(body.meetingProvider, 40);
  const meetingUrl = optionalString(body.meetingUrl, 500);
  if (meetingUrl) {
    let parsed: URL;
    try { parsed = new URL(meetingUrl); } catch { throw new PortalHttpError(400, "Meeting link must be a valid URL."); }
    if (parsed.protocol !== "https:") throw new PortalHttpError(400, "Meeting link must use HTTPS.");
  }
  if (status === "confirmed" && Boolean(meetingProvider) !== Boolean(meetingUrl)) {
    throw new PortalHttpError(400, "Provide both a meeting provider and its secure link.");
  }
  const rows = await supabaseServiceRoleRequest<PortalEvent[]>(
    `/rest/v1/wovo_portal_events?id=eq.${encodeURIComponent(eventId)}&account_id=eq.${encodeURIComponent(accountId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status,
        meeting_provider: meetingProvider,
        meeting_url: meetingUrl,
        assigned_staff_user_id: status === "confirmed" ? context.user.id : undefined,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!rows?.[0]) throw new PortalHttpError(404, "Event not found.");
  return { event: rows[0] };
}

async function createOrder(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const orderType = enumValue(body.orderType, ORDER_TYPES, "Order type") as PortalOrder["order_type"];
  const requestedFor = body.requestedFor ? parseIsoDate(body.requestedFor, "Requested date") : null;
  if (orderType === "drone") {
    if (!requestedFor) throw new PortalHttpError(400, "Drone requests need a requested date.");
    const minimumHours = Number(getEnv("WOVO_DRONE_MIN_NOTICE_HOURS") || "72");
    if (Date.parse(requestedFor) < Date.now() + Math.max(24, minimumHours) * 3600000) {
      throw new PortalHttpError(400, `Drone requests require at least ${Math.max(24, minimumHours)} hours of advance notice.`);
    }
    if (!optionalString(body.location, 240)) throw new PortalHttpError(400, "Drone location is required.");
  }
  const rows = await supabaseServiceRoleRequest<PortalOrder[]>("/rest/v1/wovo_portal_orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      account_id: accountId,
      requested_by: context.user.id,
      order_type: orderType,
      status: getPortalPriceId(orderType) ? "checkout_pending" : "quote_required",
      description: optionalString(body.description, 2000),
      location: optionalString(body.location, 240),
      requested_for: requestedFor,
      compliance_note: orderType === "drone"
        ? "Pending staff approval, location/airspace review, weather availability, and confirmation of compliant commercial drone operations."
        : null,
    }),
  });
  const order = rows?.[0];
  if (!order) throw new Error("Unable to create add-on request.");
  await insertNotification({
    account_id: accountId,
    notification_type: "addon_requested",
    title: `Add-on requested: ${orderType.replace("_", " ")}`,
    body: order.description,
    target_role: orderType === "website" ? "website_designer" : orderType === "ad_video" ? "video_editor" : "manager",
    related_table: "wovo_portal_orders",
    related_id: order.id,
  });
  return { order };
}

async function createWorkflowDraft(context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  await assertPaid(context, accountId);
  const workflowType = enumValue(body.workflowType, WORKFLOW_TYPES, "Workflow type") as PortalWorkflowDraft["workflow_type"];
  const title = requiredString(body.title, "Title", 180);
  const brief = requiredString(body.brief, "Brief", 5000);
  const sourceAuthorized = body.sourceAuthorized === true;
  const rightsConfirmed = body.rightsConfirmed === true;
  const peopleConsentConfirmed = body.peopleConsentConfirmed === true;
  const voiceConsentConfirmed = body.voiceConsentConfirmed === true;
  const sourceUrl = optionalString(body.sourceUrl, 1000);
  const channel = optionalString(body.channel, 40);
  const outputFormat = optionalString(body.outputFormat, 40);
  const aspect = optionalString(body.aspect, 10);
  const style = optionalString(body.style, 80);
  const startFrameAssetId = optionalString(body.startFrameAssetId, 80);
  const destinationConnectionId = optionalString(body.destinationConnectionId, 80);
  const durationSeconds = body.durationSeconds === undefined || body.durationSeconds === null || body.durationSeconds === ""
    ? null
    : numberValue(body.durationSeconds, "Duration", 4, 12);

  if (channel && ![...PLATFORM_VALUES, "website"].includes(channel)) throw new PortalHttpError(400, "Invalid creation channel.");
  if (outputFormat && ![
    "single_post", "carousel", "story",
    "campaign_plan", "launch_sequence", "weekly_series",
    "vertical_episode", "storyboard", "character_card",
    "landing_page", "storefront", "services_site", "portfolio",
    "vertical_video", "video_ad", "story_video",
  ].includes(outputFormat)) throw new PortalHttpError(400, "Invalid output format.");
  if (aspect && !["9:16", "16:9", "1:1"].includes(aspect)) throw new PortalHttpError(400, "Invalid output aspect.");
  if (startFrameAssetId) {
    if (!isUuid(startFrameAssetId)) throw new PortalHttpError(400, "Invalid private reference asset.");
    const frameAssets = await supabaseServiceRoleRequest<Array<{ id: string }>>(
      `/rest/v1/wovo_portal_assets?select=id&id=eq.${encodeURIComponent(startFrameAssetId)}&account_id=eq.${encodeURIComponent(accountId)}&rights_confirmed=eq.true&archived_at=is.null&limit=1`,
    ).catch(() => []);
    if (!frameAssets?.[0]) throw new PortalHttpError(400, "The selected reference frame is not available in this workspace.");
  }
  if (destinationConnectionId) {
    if (!isUuid(destinationConnectionId)) throw new PortalHttpError(400, "Invalid publishing destination.");
    const destinations = await supabaseServiceRoleRequest<Array<{ id: string }>>(
      `/rest/v1/wovo_meta_connections?select=id&id=eq.${encodeURIComponent(destinationConnectionId)}&account_id=eq.${encodeURIComponent(accountId)}&status=eq.healthy&limit=1`,
    ).catch(() => []);
    if (!destinations?.[0]) throw new PortalHttpError(400, "The selected Facebook or Instagram destination is not connected to this workspace.");
  }

  if (sourceUrl) {
    let parsed: URL;
    try { parsed = new URL(sourceUrl); } catch { throw new PortalHttpError(400, "Source URL must be valid."); }
    if (parsed.protocol !== "https:") throw new PortalHttpError(400, "Source URL must use HTTPS.");
  }
  if (workflowType === "listing_ad" && (!sourceUrl || !sourceAuthorized || !rightsConfirmed)) {
    throw new PortalHttpError(400, "Listing briefs require an HTTPS source URL plus confirmation that you are authorized to supply the facts and uploaded assets. WOVO does not scrape the listing page.");
  }
  if (["mascot_series", "ugc_ad"].includes(workflowType) && (!rightsConfirmed || !peopleConsentConfirmed)) {
    throw new PortalHttpError(400, "Character and UGC briefs require asset rights and consent from every identifiable person.");
  }
  if (workflowType === "mascot_series" && !voiceConsentConfirmed) {
    throw new PortalHttpError(400, "Mascot and episodic character briefs require explicit voice/likeness consent before WOVO can review references.");
  }
  if (["website_site", "website_page"].includes(workflowType)) {
    const brandAssets = await supabaseServiceRoleRequest<Array<{ id: string }>>(
      `/rest/v1/wovo_portal_assets?select=id&account_id=eq.${encodeURIComponent(accountId)}&asset_kind=eq.brand&rights_confirmed=eq.true&archived_at=is.null&limit=1`
    ).catch(() => []);
    if (!brandAssets?.length) throw new PortalHttpError(428, "Upload a rights-confirmed brand/logo asset before creating website drafts.");
  }

  const rows = await supabaseServiceRoleRequest<PortalWorkflowDraft[]>("/rest/v1/wovo_portal_workflow_drafts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      account_id: accountId,
      created_by: context.user.id,
      workflow_type: workflowType,
      title,
      brief,
      source_url: sourceUrl,
      source_authorized: sourceAuthorized,
      rights_confirmed: rightsConfirmed,
      people_consent_confirmed: peopleConsentConfirmed,
      voice_consent_confirmed: voiceConsentConfirmed,
      input_data: {
        cadence: optionalString(body.cadence, 80),
        mode: optionalString(body.mode, 80),
        channel,
        output_format: outputFormat,
        aspect,
        style,
        duration_seconds: durationSeconds,
        start_frame_asset_id: startFrameAssetId,
        destination_connection_id: destinationConnectionId,
      },
      provider_status: ["call_agent", "booking_request", "meeting"].includes(workflowType) ? "provider_required" : "not_started",
    }),
  });
  const draft = rows?.[0];
  if (!draft) throw new PortalHttpError(500, "The workflow draft could not be created.");
  await insertNotification({
    account_id: accountId,
    notification_type: "addon_requested",
    title: `Workflow draft: ${title}`,
    body: `${workflowType.replaceAll("_", " ")} · review required before any external action`,
    target_role: ["website_site", "website_page"].includes(workflowType) ? "website_designer" : ["listing_ad", "mascot_series", "ugc_ad"].includes(workflowType) ? "video_editor" : "manager",
    related_table: "wovo_portal_workflow_drafts",
    related_id: draft.id,
  });
  return { draft };
}

async function startCheckout(request: Request, context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  const purchaseType = enumValue(body.purchaseType, ["subscription", "addon"], "Purchase type");
  let priceId: string;
  let orderId: string | null = null;
  let metadata: Record<string, string>;
  if (purchaseType === "subscription") {
    if (body.planConfirmed !== true) throw new PortalHttpError(400, "Review and confirm the workspace plan before checkout.");
    const billingFrequency = isPortalBillingFrequency(body.billingFrequency) ? body.billingFrequency : "monthly";
    const billingOption = await getValidatedPortalBillingOption(billingFrequency);
    if (!billingOption) throw new PortalHttpError(503, "That billing period is not available. Choose one of the verified WOVO plans shown in the workspace.");
    priceId = getPortalPriceIdForFrequency(billingFrequency);
    const accountRows = await supabaseServiceRoleRequest<Array<{ onboarding_plan: Record<string, unknown> | null }>>(
      `/rest/v1/wovo_portal_accounts?select=onboarding_plan&id=eq.${encodeURIComponent(accountId)}&limit=1`
    ).catch(() => []);
    const savedPlan = accountRows?.[0]?.onboarding_plan;
    metadata = {
      product: "wovo_portal",
      portalAccountId: accountId,
      portalPurchaseType: "subscription",
      portalPlanConfirmed: "true",
      portalBillingFrequency: billingFrequency,
      portalSelectedAddons: Array.isArray(savedPlan?.recurringAddons) ? savedPlan.recurringAddons.filter((item): item is string => typeof item === "string").join(",").slice(0, 450) : "",
    };
  } else {
    orderId = requiredString(body.orderId, "Order", 80);
    const orders = await supabaseServiceRoleRequest<PortalOrder[]>(
      `/rest/v1/wovo_portal_orders?select=*&id=eq.${encodeURIComponent(orderId)}&account_id=eq.${encodeURIComponent(accountId)}&status=in.(requested,checkout_pending,quote_required)&limit=1`
    ).catch(() => []);
    const order = orders?.[0];
    if (!order) throw new PortalHttpError(404, "Add-on order not found.");
    priceId = getPortalPriceId(order.order_type);
    metadata = {
      product: "wovo_portal",
      portalAccountId: accountId,
      portalPurchaseType: "addon",
      portalOrderId: order.id,
      portalOrderType: order.order_type,
    };
  }
  if (!priceId) throw new PortalHttpError(503, "This Stripe price is not configured. Add the corresponding WOVO_PORTAL_*_PRICE_ID environment variable.");
  const customerId = await ensureStripeCustomerForUser(context.user.id, context.user.email);
  const base = siteUrl(request);
  const session = await createCheckoutSession({
    customerId,
    priceId,
    userId: context.user.id,
    successUrl: `${base}/portal?checkout=success`,
    cancelUrl: `${base}/portal?checkout=canceled`,
    mode: purchaseType === "subscription" ? "subscription" : "payment",
    metadata,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  if (orderId) {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_portal_orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "checkout_pending", stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() }),
    });
  }
  return { url: session.url };
}

async function openBillingPortal(request: Request, context: PortalContext, body: ActionBody) {
  const accountId = requiredString(body.accountId, "Account", 80);
  await assertPortalAccountAccess(context, accountId);
  const rows = await supabaseServiceRoleRequest<Array<{ stripe_customer_id: string | null }>>(
    `/rest/v1/wovo_portal_subscriptions?select=stripe_customer_id&account_id=eq.${encodeURIComponent(accountId)}&limit=1`
  ).catch(() => []);
  const customerId = rows?.[0]?.stripe_customer_id;
  if (!customerId) throw new PortalHttpError(400, "No portal billing profile is available yet.");
  const session = await createPortalSession(customerId, `${siteUrl(request)}/portal`);
  return { url: session.url };
}

function portalError(error: unknown) {
  if (error instanceof PortalHttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Unexpected portal error.";
  if (message.includes("Missing bearer token") || message.includes("Unable to verify session")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error("Portal request failed", error);
  return NextResponse.json({ error: "The portal could not complete that request." }, { status: 500 });
}
