import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getEnv, getEnvAny } from "@/lib/env";
import {
  isUuid,
  optionalString,
  PortalHttpError,
  requiredString,
  requirePortalContext,
  type PortalContext,
} from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { adamOpenAiConfigured, askAdam, loadAdamAiState, updateAdamAiPolicy } from "@/lib/adam/ai";
import { ADAM_AI_DISCLOSURE, ADAM_OUTREACH_ADDRESS, ADAM_OUTREACH_SIGNATURE, ADAM_SENDER_IDENTITY } from "@/lib/adam/identity";
import type {
  AdamApproval,
  AdamAuditEvent,
  AdamCampaignDraft,
  AdamDailyReport,
  AdamDeliveryDraft,
  AdamDeliveryVersion,
  AdamFailureAlert,
  AdamGoal,
  AdamIntegrationStatus,
  AdamKpiSnapshot,
  AdamMemoryItem,
  AdamMemoryVersion,
  AdamLead,
  AdamRecommendation,
  AdamSnapshot,
  AdamTask,
  AdamWeeklyReport,
  AdamWorkspace,
} from "@/lib/adam/types";

export type AdamActionBody = Record<string, unknown> & { action?: string };

const TASK_TYPES = [
  "internal_improvement",
  "support_draft",
  "content_draft",
  "seo_recommendation",
  "lead_research_draft",
  "outreach_campaign_draft",
  "proposal_draft",
  "deployment_proposal",
  "weekly_report",
] as const;
const TASK_STATUSES = ["queued", "in_progress", "blocked", "needs_approval", "completed", "failed", "dead_letter"] as const;
const MEMORY_CATEGORIES = ["company_fact", "policy", "decision", "goal_context", "operating_rule", "market_context", "integration_context"] as const;

type AdamContext = PortalContext & { staffRole: "owner" };

function enabled(name: string): boolean {
  return getEnv(name).toLowerCase() === "true";
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  const normalized = requiredString(value, label, 80).toLowerCase();
  if (!allowed.includes(normalized)) throw new PortalHttpError(400, `Invalid ${label.toLowerCase()}.`);
  return normalized as T[number];
}

function integerValue(value: unknown, label: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new PortalHttpError(400, `${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function optionalDate(value: unknown, label: string): string | null {
  const text = optionalString(value, 40);
  if (!text) return null;
  if (Number.isNaN(Date.parse(text))) throw new PortalHttpError(400, `${label} must be a valid date.`);
  return new Date(text).toISOString();
}

function optionalDateOnly(value: unknown, label: string): string | null {
  const text = optionalString(value, 20);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new PortalHttpError(400, `${label} must be a valid date.`);
  }
  return text;
}

function optionalHttpUrl(value: unknown, label: string): string | null {
  const text = optionalString(value, 1000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("protocol");
    return url.toString();
  } catch {
    throw new PortalHttpError(400, `${label} must be a valid http or https URL.`);
  }
}

export async function requireAdamOwner(authHeader: string | null): Promise<AdamContext> {
  const context = await requirePortalContext(authHeader);
  if (context.mode !== "staff" || context.staffRole !== "owner") {
    throw new PortalHttpError(403, "President / owner access is required for Adam Operations.");
  }
  return context as AdamContext;
}

async function ensureWorkspace(context: AdamContext): Promise<AdamWorkspace> {
  const existing = await supabaseServiceRoleRequest<AdamWorkspace[]>(
    `/rest/v1/wovo_adam_workspaces?select=*&owner_user_id=eq.${encodeURIComponent(context.user.id)}&limit=1`
  ).catch(() => []);
  if (existing?.[0]) return existing[0];
  const rows = await supabaseServiceRoleRequest<AdamWorkspace[]>("/rest/v1/wovo_adam_workspaces", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ owner_user_id: context.user.id, name: "WOVO Media" }),
  });
  if (!rows?.[0]) throw new Error("Unable to initialize Adam Operations.");
  await insertAudit(rows[0], context, {
    eventType: "workspace_initialized",
    subjectType: "adam_workspace",
    subjectId: rows[0].id,
    summary: "Adam Operations workspace initialized in approval-first mode.",
  });
  return rows[0];
}

async function insertAudit(
  workspace: AdamWorkspace,
  context: AdamContext,
  input: {
    eventType: string;
    subjectType: string;
    subjectId?: string | null;
    summary: string;
    correlationId?: string;
    actorKind?: "owner" | "adam_system" | "integration";
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await supabaseServiceRoleRequest("/rest/v1/wovo_adam_audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      actor_user_id: input.actorKind && input.actorKind !== "owner" ? null : context.user.id,
      actor_kind: input.actorKind ?? "owner",
      correlation_id: input.correlationId ?? randomUUID(),
      event_type: input.eventType,
      subject_type: input.subjectType,
      subject_id: input.subjectId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    }),
  });
}

function integrationStatuses(persisted: Array<{ integration_key: AdamIntegrationStatus["key"]; last_checked_at: string | null }> = [], aiHealthy = false): AdamIntegrationStatus[] {
  const lastChecked = new Map(persisted.map((item) => [item.integration_key, item.last_checked_at]));
  const configured = (value: string) => Boolean(value.trim());
  const openAiConfigured = adamOpenAiConfigured();
  const metaConfigured = configured(getEnv("META_APP_ID")) && configured(getEnv("META_APP_SECRET"));
  const metaEncryptionConfigured = configured(getEnv("META_TOKEN_ENCRYPTION_KEY"));
  const metaJobsConfigured = configured(getEnv("CRON_SECRET"));
  const metaFeatureRequested = enabled("WOVO_META_PUBLISHING_ENABLED");
  const googleMailConfigured = configured(getEnv("GOOGLE_WORKSPACE_CLIENT_ID")) && configured(getEnv("GOOGLE_WORKSPACE_CLIENT_SECRET")) && /^[a-f0-9]{64}$/i.test(getEnv("GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY"));
  const outreachWebhookConfigured = configured(getEnv("RESEND_WEBHOOK_SECRET"));
  const status = (
    key: AdamIntegrationStatus["key"],
    label: string,
    state: AdamIntegrationStatus["status"],
    detail: string,
    capabilities: string[]
  ): AdamIntegrationStatus => ({ key, label, status: state, detail, capabilities, lastCheckedAt: lastChecked.get(key) ?? null });
  return [
    status("openai", "OpenAI", aiHealthy ? "healthy" : openAiConfigured ? "configured" : "not_configured", openAiConfigured ? (aiHealthy ? "Owner-only drafting is producing metered requests within the hard budget." : "Server credential is present. Status becomes healthy after a successful metered owner request.") : "No server credential detected.", ["owner chat", "daily narrative", "internal drafts"]),
    status("stripe", "Stripe", configured(getEnv("STRIPE_SECRET_KEY")) && configured(getEnv("STRIPE_WEBHOOK_SECRET")) ? "configured" : "not_configured", "Subscription metrics use verified portal webhook records; Adam cannot change prices or customer billing.", ["subscription health", "revenue estimate"]),
    status("supabase", "Supabase", "healthy", "Authenticated owner route and service-side database access are working for this response.", ["tasks", "memory", "audit", "approvals"]),
    status("vercel", "Vercel", configured(getEnv("VERCEL_ENV")) ? "configured" : "not_configured", "Runtime/deployment context only. Adam cannot deploy code.", ["deployment context"]),
    status("resend", "Resend", configured(getEnv("RESEND_API_KEY")) && outreachWebhookConfigured ? "configured" : configured(getEnv("RESEND_API_KEY")) ? "blocked" : "not_configured", configured(getEnv("RESEND_API_KEY")) ? `A server credential is present. Outreach remains blocked because the signed bounce/complaint webhook is ${outreachWebhookConfigured ? "configured but not yet E2E verified" : "missing"}, and adam@ sender alignment/test delivery are not verified.` : "No server-side Resend credential detected.", ["transactional delivery", "signed delivery events", "suppression"]),
    status("google_mail", "Adam Google mailbox", googleMailConfigured ? "configured" : "not_configured", googleMailConfigured ? "OAuth client and encryption settings exist. Healthy still requires owner consent for the exact adam@ account using only gmail.send, encrypted refresh-token storage, and a revocation test." : "No Google mailbox OAuth connection is active. Raw passwords are never accepted or stored.", ["OAuth only", "gmail.send only", "revocation", "sent-mail audit"]),
    status("meta", "Meta", metaConfigured && metaEncryptionConfigured && metaJobsConfigured && metaFeatureRequested ? "configured" : metaConfigured ? "blocked" : "not_configured", metaConfigured ? `Official app credentials are server-side. OAuth callback ${metaFeatureRequested ? "is enabled" : "is disabled"}; encrypted token storage ${metaEncryptionConfigured ? "is configured" : "is missing"}; durable daily queue ${metaJobsConfigured ? "is configured" : "is missing"}. A connection is healthy only after the owner completes OAuth and a real provider post succeeds.` : "No complete server-side Meta app credential pair detected.", ["official OAuth", "approval-aware publishing queue", "kill switch"]),
    status("github", "GitHub", configured(getEnvAny(["GITHUB_TOKEN", "GITHUB_APP_ID"])) ? "configured" : "not_configured", "Future code proposals require a branch, tests, review, and explicit deployment approval.", ["change proposals"]),
    status("calendar", "Calendar", configured(getEnv("WOVO_CALENDAR_PROVIDER")) ? "configured" : "not_configured", "Organization-level scheduling only; no personal staff identity is exposed.", ["schedule context"]),
    status("analytics", "Analytics", configured(getEnvAny(["POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_KEY", "VERCEL_ANALYTICS_ID"])) ? "configured" : "not_configured", "Only explicitly connected aggregate product metrics are eligible.", ["aggregate metrics"]),
    status("search_console", "Search Console", configured(getEnvAny(["GOOGLE_SEARCH_CONSOLE_CLIENT_ID", "SEARCH_CONSOLE_SITE_URL"])) ? "configured" : "not_configured", "SEO recommendations require a legitimate connected property.", ["search performance"]),
    status("cloudflare", "Cloudflare / R2", "blocked", "WOVO remains hosted and routed through Vercel. R2 storage is not connected until the owner completes scoped authorization; no DNS or domain change is attempted.", ["connection status", "future private asset storage"]),
    status("calendly", "Calendly", "blocked", "No Calendly token is stored. The client workflow prepares a scheduling request for review but does not create an invite until official authorization is complete.", ["connection status", "scheduling-request drafts"]),
  ];
}

function latestKpis(rows: AdamKpiSnapshot[]): AdamKpiSnapshot[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.metric_key)) return false;
    seen.add(row.metric_key);
    return true;
  });
}

export async function loadAdamSnapshot(context: AdamContext): Promise<AdamSnapshot> {
  const workspace = await ensureWorkspace(context);
  const aiStatePromise = loadAdamAiState(workspace, context);
  const base = `adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`;
  const [goals, tasks, approvals, memoryItems, memoryVersions, kpis, reports, recommendations, audit, persistedIntegrations, campaignDrafts, dailyReports, failureAlerts, leads, deliveryDrafts, deliveryVersions] = await Promise.all([
    supabaseServiceRoleRequest<AdamGoal[]>(`/rest/v1/wovo_adam_goals?select=*&${base}&order=priority.asc,created_at.desc&limit=100`).catch(() => []),
    supabaseServiceRoleRequest<AdamTask[]>(`/rest/v1/wovo_adam_tasks?select=*&${base}&order=priority.asc,created_at.desc&limit=200`).catch(() => []),
    supabaseServiceRoleRequest<AdamApproval[]>(`/rest/v1/wovo_adam_approvals?select=*&${base}&order=created_at.desc&limit=200`).catch(() => []),
    supabaseServiceRoleRequest<AdamMemoryItem[]>(`/rest/v1/wovo_adam_memory_items?select=*&${base}&order=updated_at.desc&limit=200`).catch(() => []),
    supabaseServiceRoleRequest<AdamMemoryVersion[]>(`/rest/v1/wovo_adam_memory_versions?select=*&${base}&order=created_at.desc&limit=500`).catch(() => []),
    supabaseServiceRoleRequest<AdamKpiSnapshot[]>(`/rest/v1/wovo_adam_kpi_snapshots?select=*&${base}&order=measured_at.desc&limit=250`).catch(() => []),
    supabaseServiceRoleRequest<AdamWeeklyReport[]>(`/rest/v1/wovo_adam_weekly_reports?select=*&${base}&order=period_start.desc&limit=24`).catch(() => []),
    supabaseServiceRoleRequest<AdamRecommendation[]>(`/rest/v1/wovo_adam_recommendations?select=*&${base}&order=created_at.desc&limit=200`).catch(() => []),
    supabaseServiceRoleRequest<AdamAuditEvent[]>(`/rest/v1/wovo_adam_audit_events?select=*&${base}&order=created_at.desc&limit=250`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ integration_key: AdamIntegrationStatus["key"]; last_checked_at: string | null }>>(`/rest/v1/wovo_adam_integrations?select=integration_key,last_checked_at&${base}`).catch(() => []),
    supabaseServiceRoleRequest<AdamCampaignDraft[]>(`/rest/v1/wovo_adam_campaign_drafts?select=*&${base}&order=created_at.desc&limit=100`).catch(() => []),
    supabaseServiceRoleRequest<AdamDailyReport[]>(`/rest/v1/wovo_adam_daily_reports?select=*&${base}&order=report_date.desc&limit=31`).catch(() => []),
    supabaseServiceRoleRequest<AdamFailureAlert[]>(`/rest/v1/wovo_adam_failure_alerts?select=*&${base}&status=in.(open,acknowledged)&order=created_at.desc&limit=100`).catch(() => []),
    supabaseServiceRoleRequest<AdamLead[]>(`/rest/v1/wovo_adam_leads?select=*&${base}&order=score.desc,created_at.desc&limit=500`).catch(() => []),
    supabaseServiceRoleRequest<AdamDeliveryDraft[]>(`/rest/v1/wovo_adam_delivery_drafts?select=*&${base}&order=updated_at.desc&limit=300`).catch(() => []),
    supabaseServiceRoleRequest<AdamDeliveryVersion[]>(`/rest/v1/wovo_adam_delivery_versions?select=*&${base}&order=created_at.desc&limit=800`).catch(() => []),
  ]);
  const [deliveryAccountRows, deliverySubscriptions, deliveryGrants, deliveryEntitlements, aiState] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ id: string; business_name: string; business_type: string }>>("/rest/v1/wovo_portal_accounts?select=id,business_name,business_type&archived_at=is.null&order=business_name.asc&limit=500").catch(() => []),
    supabaseServiceRoleRequest<Array<{ account_id: string; status: string; cancel_at_period_end: boolean; current_period_end: string | null }>>("/rest/v1/wovo_portal_subscriptions?select=account_id,status,cancel_at_period_end,current_period_end&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<Array<{ account_id: string; grant_type: string; starts_at: string; expires_at: string; revoked_at: string | null }>>("/rest/v1/wovo_portal_access_grants?select=account_id,grant_type,starts_at,expires_at,revoked_at&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<Array<{ account_id: string; entitlement_key: string; status: string; current_period_end: string | null }>>("/rest/v1/wovo_portal_entitlements?select=account_id,entitlement_key,status,current_period_end&limit=2000").catch(() => []),
    aiStatePromise,
  ]);
  const entitlementActive = (accountId: string, key: string) => (deliveryEntitlements ?? []).some((item) => item.account_id === accountId && item.entitlement_key === key && item.status === "active" && (!item.current_period_end || Date.parse(item.current_period_end) > Date.now()));
  const deliveryAccounts = (deliveryAccountRows ?? []).map((account) => {
    const subscription = (deliverySubscriptions ?? []).find((item) => item.account_id === account.id);
    const paid = ["active", "trialing"].includes(subscription?.status ?? "");
    const ownerTest = (deliveryGrants ?? []).some((grant) => grant.account_id === account.id && !grant.revoked_at && Date.parse(grant.starts_at) <= Date.now() && Date.parse(grant.expires_at) > Date.now());
    return {
      id: account.id,
      businessName: account.business_name,
      businessType: account.business_type,
      billingState: paid ? "paid" as const : ownerTest ? "owner_test" as const : "inactive" as const,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      wovoCodeActive: entitlementActive(account.id, "wovo_code"),
      hostingActive: entitlementActive(account.id, "website_hosting"),
    };
  });
  return {
    workspace,
    goals: goals ?? [],
    tasks: tasks ?? [],
    approvals: approvals ?? [],
    memoryItems: memoryItems ?? [],
    memoryVersions: memoryVersions ?? [],
    kpis: latestKpis(kpis ?? []),
    weeklyReports: reports ?? [],
    recommendations: recommendations ?? [],
    audit: audit ?? [],
    integrations: integrationStatuses(persistedIntegrations ?? [], Boolean(aiState.usage.lastCompletedAt)),
    campaignDrafts: campaignDrafts ?? [],
    dailyReports: dailyReports ?? [],
    failureAlerts: failureAlerts ?? [],
    leads: leads ?? [],
    deliveryDrafts: deliveryDrafts ?? [],
    deliveryVersions: deliveryVersions ?? [],
    deliveryAccounts,
    aiPolicy: aiState.policy,
    aiUsage: aiState.usage,
    chatMessages: aiState.chatMessages,
    controls: {
      ownerOnly: true,
      approvalFirst: true,
      externalActionsEnabled: false,
      aiDraftingEnabled: Boolean(adamOpenAiConfigured() && aiState.policy?.enabled),
      backgroundExecutionEnabled: false,
    },
  };
}

export async function askAdamOwner(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const idempotencyKey = requiredString(body.idempotencyKey, "Request key", 180);
  const conversationId = requiredString(body.conversationId, "Conversation", 80);
  if (!isUuid(conversationId)) throw new PortalHttpError(400, "Invalid conversation.");
  const messageKind = enumValue(body.messageKind ?? "operations", ["operations", "support_draft", "outreach_draft", "content_draft"] as const, "Draft type");
  const prompt = requiredString(body.prompt, "Request", 6000);
  const result = await askAdam(workspace, context, { idempotencyKey, conversationId, messageKind, prompt });
  await insertAudit(workspace, context, { eventType: "adam_ai_draft_completed", subjectType: "ai_request", subjectId: result.requestId, summary: `Adam prepared an owner-only ${messageKind.replaceAll("_", " ")}. No external action occurred.`, metadata: { messageKind, providerAction: false } });
  return { message: result.text, requestId: result.requestId, externalActionTaken: false };
}

export async function updateAdamAiControls(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const policy = await updateAdamAiPolicy(workspace, context, {
    enabled: body.enabled === true,
    monthlyCostCapMicros: integerValue(body.monthlyCostCapMicros, "Monthly cap", 1_000_000, 5_000_000),
    maxOutputTokens: integerValue(body.maxOutputTokens, "Maximum output", 200, 800),
    hourlyRequestCap: integerValue(body.hourlyRequestCap, "Hourly limit", 1, 12),
    dailyRequestCap: integerValue(body.dailyRequestCap, "Daily limit", 1, 40),
  });
  await insertAudit(workspace, context, { eventType: "adam_ai_policy_updated", subjectType: "ai_policy", subjectId: workspace.id, summary: `Owner ${policy?.enabled ? "enabled" : "paused"} Adam AI and updated its hard usage limits.`, metadata: { monthlyCostCapMicros: policy?.monthly_cost_cap_micros, maxOutputTokens: policy?.max_output_tokens } });
  return { policy };
}

export async function updateObjective(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const objective = requiredString(body.objective, "Current objective", 1200);
  const rows = await supabaseServiceRoleRequest<AdamWorkspace[]>(`/rest/v1/wovo_adam_workspaces?id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ current_objective: objective, updated_at: new Date().toISOString() }),
  });
  await insertAudit(workspace, context, { eventType: "objective_updated", subjectType: "adam_workspace", subjectId: workspace.id, summary: "The owner updated Adam's current objective." });
  return { workspace: rows?.[0] ?? workspace };
}

export async function createGoal(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const rows = await supabaseServiceRoleRequest<AdamGoal[]>("/rest/v1/wovo_adam_goals", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      title: requiredString(body.title, "Goal title", 180),
      description: optionalString(body.description, 3000),
      horizon: enumValue(body.horizon ?? "quarter", ["week", "month", "quarter", "year"] as const, "Horizon"),
      priority: integerValue(body.priority ?? 3, "Priority", 1, 5),
      success_measure: optionalString(body.successMeasure, 500),
      target_date: optionalDateOnly(body.targetDate, "Target date"),
      created_by: context.user.id,
    }),
  });
  const goal = rows?.[0];
  if (!goal) throw new Error("Unable to create Adam goal.");
  await insertAudit(workspace, context, { eventType: "goal_created", subjectType: "goal", subjectId: goal.id, summary: `Goal created: ${goal.title}` });
  return { goal };
}

function taskApprovalType(taskType: AdamTask["task_type"]): AdamApproval["action_type"] {
  if (taskType === "deployment_proposal") return "code_deployment";
  if (taskType === "content_draft") return "publishing";
  if (["support_draft", "lead_research_draft", "outreach_campaign_draft", "proposal_draft"].includes(taskType)) return "external_communication";
  return "internal_change";
}

export async function createTask(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const taskType = enumValue(body.taskType ?? "internal_improvement", TASK_TYPES, "Task type");
  const correlationId = randomUUID();
  const requiresApproval = taskType !== "internal_improvement" && taskType !== "weekly_report";
  const rows = await supabaseServiceRoleRequest<AdamTask[]>("/rest/v1/wovo_adam_tasks", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      goal_id: isUuid(body.goalId) ? body.goalId : null,
      correlation_id: correlationId,
      task_type: taskType,
      title: requiredString(body.title, "Task title", 180),
      description: optionalString(body.description, 5000) ?? "",
      status: requiresApproval ? "needs_approval" : "queued",
      priority: integerValue(body.priority ?? 3, "Priority", 1, 5),
      requires_approval: requiresApproval,
      due_at: optionalDate(body.dueAt, "Due date"),
      created_by: context.user.id,
    }),
  });
  const task = rows?.[0];
  if (!task) throw new Error("Unable to create Adam task.");
  if (requiresApproval) {
    await supabaseServiceRoleRequest("/rest/v1/wovo_adam_approvals", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        adam_workspace_id: workspace.id,
        task_id: task.id,
        correlation_id: correlationId,
        action_type: taskApprovalType(taskType),
        title: task.title,
        summary: "Approve the proposed work only. Approval does not send, publish, charge, deploy, or contact anyone.",
        risk_level: taskType === "deployment_proposal" ? "high" : "medium",
        proposed_payload: { taskType, scope: "draft_or_proposal_only" },
        requested_by: context.user.id,
      }),
    });
  }
  await insertAudit(workspace, context, { eventType: "task_created", subjectType: "task", subjectId: task.id, correlationId, summary: `Task queued: ${task.title}`, metadata: { taskType, requiresApproval } });
  return { task };
}

export async function updateTask(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const taskId = requiredString(body.taskId, "Task", 80);
  if (!isUuid(taskId)) throw new PortalHttpError(400, "Invalid task.");
  const status = enumValue(body.status, TASK_STATUSES, "Task status");
  const tasks = await supabaseServiceRoleRequest<AdamTask[]>(`/rest/v1/wovo_adam_tasks?select=*&id=eq.${encodeURIComponent(taskId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`).catch(() => []);
  const task = tasks?.[0];
  if (!task) throw new PortalHttpError(404, "Adam task not found.");
  if (status === "completed" && task.requires_approval) {
    const approvals = await supabaseServiceRoleRequest<AdamApproval[]>(`/rest/v1/wovo_adam_approvals?select=id&task_id=eq.${encodeURIComponent(task.id)}&status=eq.approved&limit=1`).catch(() => []);
    if (!approvals?.[0]) throw new PortalHttpError(409, "Owner approval is required before this task can be completed.");
  }
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "completed") patch.completed_at = new Date().toISOString();
  if (status === "failed") {
    patch.attempt_count = task.attempt_count + 1;
    patch.last_error_code = "owner_marked_failed";
    patch.last_error_summary = optionalString(body.errorSummary, 500) ?? "Marked failed by the owner.";
    if (task.attempt_count + 1 >= task.max_attempts) patch.status = "dead_letter";
  }
  const rows = await supabaseServiceRoleRequest<AdamTask[]>(`/rest/v1/wovo_adam_tasks?id=eq.${encodeURIComponent(task.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  await insertAudit(workspace, context, { eventType: "task_status_changed", subjectType: "task", subjectId: task.id, correlationId: task.correlation_id, summary: `${task.title} moved to ${String(patch.status).replaceAll("_", " ")}.` });
  return { task: rows?.[0] };
}

export async function archiveTask(context: AdamContext, body: AdamActionBody, restore: boolean) {
  const workspace = await ensureWorkspace(context);
  const taskId = requiredString(body.taskId, "Task", 80);
  if (!isUuid(taskId)) throw new PortalHttpError(400, "Invalid task.");
  const rows = await supabaseServiceRoleRequest<AdamTask[]>(`/rest/v1/wovo_adam_tasks?select=*&id=eq.${encodeURIComponent(taskId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`).catch(() => []);
  const task = rows?.[0];
  if (!task) throw new PortalHttpError(404, "Adam task not found.");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_tasks?id=eq.${encodeURIComponent(task.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(restore ? { status: "queued", archived_at: null, archived_by: null, updated_at: new Date().toISOString() } : { status: "archived", archived_at: new Date().toISOString(), archived_by: context.user.id, updated_at: new Date().toISOString() }),
  });
  await insertAudit(workspace, context, { eventType: restore ? "task_restored" : "task_archived", subjectType: "task", subjectId: task.id, correlationId: task.correlation_id, summary: `${task.title} ${restore ? "restored" : "archived"}.` });
  return { restored: restore };
}

export async function saveMemory(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const title = requiredString(body.title, "Memory title", 180);
  const content = requiredString(body.content, "Memory content", 20000);
  const category = enumValue(body.category, MEMORY_CATEGORIES, "Memory category");
  const approve = body.approve === true;
  const sourceUrl = optionalHttpUrl(body.sourceUrl, "Source URL");
  const sourceDate = optionalDateOnly(body.sourceDate, "Source date");
  const retentionUntil = optionalDateOnly(body.retentionUntil, "Retention date");
  const memoryId = typeof body.memoryId === "string" ? body.memoryId : "";
  let item: AdamMemoryItem | undefined;
  let nextVersion = 1;
  if (memoryId) {
    if (!isUuid(memoryId)) throw new PortalHttpError(400, "Invalid memory item.");
    const rows = await supabaseServiceRoleRequest<AdamMemoryItem[]>(`/rest/v1/wovo_adam_memory_items?select=*&id=eq.${encodeURIComponent(memoryId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`).catch(() => []);
    item = rows?.[0];
    if (!item) throw new PortalHttpError(404, "Adam memory item not found.");
    nextVersion = item.current_version + 1;
  }
  if (!item) {
    const rows = await supabaseServiceRoleRequest<AdamMemoryItem[]>("/rest/v1/wovo_adam_memory_items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        adam_workspace_id: workspace.id,
        category,
        title,
        status: approve ? "approved" : "draft",
        current_version: 1,
        retention_until: retentionUntil,
        source_url: sourceUrl,
        source_date: sourceDate,
        created_by: context.user.id,
        updated_by: context.user.id,
        approved_by: approve ? context.user.id : null,
        approved_at: approve ? new Date().toISOString() : null,
      }),
    });
    item = rows?.[0];
  } else {
    const rows = await supabaseServiceRoleRequest<AdamMemoryItem[]>(`/rest/v1/wovo_adam_memory_items?id=eq.${encodeURIComponent(item.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        category,
        title,
        status: approve ? "approved" : "draft",
        current_version: nextVersion,
        retention_until: retentionUntil,
        source_url: sourceUrl,
        source_date: sourceDate,
        updated_by: context.user.id,
        approved_by: approve ? context.user.id : null,
        approved_at: approve ? new Date().toISOString() : null,
        archived_at: null,
        archived_by: null,
        updated_at: new Date().toISOString(),
      }),
    });
    item = rows?.[0];
  }
  if (!item) throw new Error("Unable to save Adam memory.");
  const versions = await supabaseServiceRoleRequest<AdamMemoryVersion[]>("/rest/v1/wovo_adam_memory_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      memory_item_id: item.id,
      adam_workspace_id: workspace.id,
      version_number: nextVersion,
      title,
      content,
      change_note: optionalString(body.changeNote, 500),
      created_by: context.user.id,
    }),
  });
  await insertAudit(workspace, context, { eventType: memoryId ? "memory_version_added" : "memory_created", subjectType: "memory", subjectId: item.id, summary: `${approve ? "Approved" : "Draft"} memory saved: ${title}`, metadata: { category, version: nextVersion, sourceProvided: Boolean(sourceUrl) } });
  return { item, version: versions?.[0] };
}

export async function setMemoryArchive(context: AdamContext, body: AdamActionBody, restore: boolean) {
  const workspace = await ensureWorkspace(context);
  const memoryId = requiredString(body.memoryId, "Memory item", 80);
  if (!isUuid(memoryId)) throw new PortalHttpError(400, "Invalid memory item.");
  const rows = await supabaseServiceRoleRequest<AdamMemoryItem[]>(`/rest/v1/wovo_adam_memory_items?select=*&id=eq.${encodeURIComponent(memoryId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`).catch(() => []);
  const item = rows?.[0];
  if (!item) throw new PortalHttpError(404, "Adam memory item not found.");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_memory_items?id=eq.${encodeURIComponent(item.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(restore ? { status: item.approved_at ? "approved" : "draft", archived_at: null, archived_by: null, updated_by: context.user.id, updated_at: new Date().toISOString() } : { status: "archived", archived_at: new Date().toISOString(), archived_by: context.user.id, updated_by: context.user.id, updated_at: new Date().toISOString() }),
  });
  await insertAudit(workspace, context, { eventType: restore ? "memory_restored" : "memory_archived", subjectType: "memory", subjectId: item.id, summary: `${item.title} ${restore ? "restored" : "archived"}.` });
  return { restored: restore };
}

type CountRow = { id: string };
type SubscriptionRow = { id: string; stripe_price_id: string | null; status: string };
type UsageRow = { actual_units: number | null; estimated_units: number; actual_provider_cost_micros: number | null; estimated_provider_cost_micros: number };
type AdamUsageRow = { input_tokens: number | null; output_tokens: number | null; actual_cost_micros: number | null; estimated_cost_micros: number };

function priceMonthlyEquivalent(priceId: string | null): number {
  if (!priceId) return 0;
  if (priceId === getEnv("WOVO_PORTAL_MONTHLY_PRICE_ID")) return 1500;
  if (priceId === getEnv("WOVO_PORTAL_QUARTERLY_PRICE_ID")) return 1200;
  if (priceId === getEnv("WOVO_PORTAL_YEARLY_PRICE_ID")) return 1000;
  if (getEnv("WOVO_PORTAL_GRANDFATHERED_PRICE_IDS").split(",").map((item) => item.trim()).includes(priceId)) return 3999;
  return 0;
}

export async function refreshKpis(context: AdamContext) {
  const workspace = await ensureWorkspace(context);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [accounts, subscriptions, inquiries, cases, content, postingTasks, orders, usage, adamUsage] = await Promise.all([
    supabaseServiceRoleRequest<CountRow[]>("/rest/v1/wovo_portal_accounts?select=id&archived_at=is.null&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<SubscriptionRow[]>("/rest/v1/wovo_portal_subscriptions?select=id,stripe_price_id,status&status=in.(active,trialing)&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<CountRow[]>("/rest/v1/wovo_public_inquiries?select=id&archived_at=is.null&status=not.in.(resolved)&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<CountRow[]>("/rest/v1/wovo_portal_threads?select=id&status=not.in.(resolved,closed)&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<CountRow[]>("/rest/v1/wovo_portal_content_items?select=id&archived_at=is.null&status=in.(client_review,approved,queued,revision_requested)&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<CountRow[]>("/rest/v1/wovo_portal_posting_tasks?select=id&status=in.(pending,in_progress)&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<CountRow[]>("/rest/v1/wovo_portal_orders?select=id&status=not.in.(completed,canceled,refunded)&limit=1000").catch(() => []),
    supabaseServiceRoleRequest<UsageRow[]>(`/rest/v1/wovo_ai_usage_requests?select=actual_units,estimated_units,actual_provider_cost_micros,estimated_provider_cost_micros&status=eq.completed&completed_at=gte.${encodeURIComponent(monthStart.toISOString())}&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<AdamUsageRow[]>(`/rest/v1/wovo_adam_ai_requests?select=input_tokens,output_tokens,actual_cost_micros,estimated_cost_micros&status=eq.completed&completed_at=gte.${encodeURIComponent(monthStart.toISOString())}&limit=1000`).catch(() => []),
  ]);
  const mrrCents = (subscriptions ?? []).reduce((sum, row) => sum + priceMonthlyEquivalent(row.stripe_price_id), 0);
  const aiUnits = (usage ?? []).reduce((sum, row) => sum + (row.actual_units ?? row.estimated_units), 0) + (adamUsage ?? []).reduce((sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0), 0);
  const aiCostMicros = (usage ?? []).reduce((sum, row) => sum + (row.actual_provider_cost_micros ?? row.estimated_provider_cost_micros), 0) + (adamUsage ?? []).reduce((sum, row) => sum + (row.actual_cost_micros ?? row.estimated_cost_micros), 0);
  const snapshotKey = new Date().toISOString().replace(/[:.]/g, "-");
  const measuredAt = new Date().toISOString();
  const records = [
    ["workspaces.active", "Active workspaces", accounts?.length ?? 0, "count", "supabase", "Portal workspaces that are not archived"],
    ["subscriptions.active", "Active subscriptions", subscriptions?.length ?? 0, "count", "stripe_webhooks", "Active or trialing portal subscription records"],
    ["subscriptions.mrr_estimate", "Subscription MRR estimate", mrrCents, "cents", "stripe_webhooks", "Normalized estimate from known verified Stripe price IDs; not recognized revenue"],
    ["leads.open", "Open inquiries", inquiries?.length ?? 0, "count", "supabase", "Unresolved public inquiries"],
    ["cases.open", "Open client cases", cases?.length ?? 0, "count", "supabase", "Unresolved private client support threads"],
    ["content.pending", "Content awaiting action", content?.length ?? 0, "count", "supabase", "Review, approval, queue, and revision states"],
    ["posting.open", "Posting tasks open", postingTasks?.length ?? 0, "count", "supabase", "Durable manual posting tasks"],
    ["services.open", "Open service requests", orders?.length ?? 0, "count", "supabase", "Service orders not completed, canceled, or refunded"],
    ["ai.units.month", "AI tokens / units this month", aiUnits, "units", "supabase", "Completed, server-metered WOVO and Adam AI usage"],
    ["ai.provider_cost.month", "AI provider cost this month", aiCostMicros, "micros", "supabase", "Tracked actual or reserved provider cost"],
    ["deployment.health", "Production deployment", getEnv("VERCEL_ENV") === "production" ? 1 : 0, "boolean", "vercel_runtime", "Current runtime context only; no deploy permission"],
  ] as const;
  await supabaseServiceRoleRequest("/rest/v1/wovo_adam_kpi_snapshots", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(records.map(([metricKey, label, value, unit, source, detail]) => ({
      adam_workspace_id: workspace.id,
      snapshot_key: snapshotKey,
      metric_key: metricKey,
      metric_label: label,
      value_numeric: value,
      unit,
      health: metricKey === "deployment.health" ? (value === 1 ? "healthy" : "unknown") : value > 0 ? "watch" : "healthy",
      source_system: source,
      source_detail: detail,
      measured_at: measuredAt,
    }))),
  });
  await insertAudit(workspace, context, { eventType: "kpis_refreshed", subjectType: "kpi_snapshot", summary: "Adam refreshed the WOVO operating snapshot from server-side records.", actorKind: "adam_system", metadata: { snapshotKey, metricCount: records.length } });
  return { snapshotKey, metricCount: records.length };
}

function currentWeek(): { start: string; end: string } {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function generateWeeklyReport(context: AdamContext) {
  const workspace = await ensureWorkspace(context);
  const period = currentWeek();
  const existing = await supabaseServiceRoleRequest<AdamWeeklyReport[]>(`/rest/v1/wovo_adam_weekly_reports?select=*&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&period_start=eq.${period.start}&period_end=eq.${period.end}&limit=1`).catch(() => []);
  if (existing?.[0]) return { report: existing[0], existing: true };
  const snapshot = await loadAdamSnapshot(context);
  const metrics = Object.fromEntries(snapshot.kpis.map((kpi) => [kpi.metric_key, kpi.value_numeric ?? kpi.value_text]));
  const completed = snapshot.tasks.filter((task) => task.status === "completed").slice(0, 5);
  const blocked = snapshot.tasks.filter((task) => ["blocked", "failed", "dead_letter"].includes(task.status)).slice(0, 5);
  const approvals = snapshot.approvals.filter((approval) => approval.status === "pending").slice(0, 5);
  const priorities = snapshot.tasks.filter((task) => ["queued", "in_progress", "needs_approval"].includes(task.status)).slice(0, 5);
  const rows = await supabaseServiceRoleRequest<AdamWeeklyReport[]>("/rest/v1/wovo_adam_weekly_reports", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      period_start: period.start,
      period_end: period.end,
      executive_summary: `Draft operating review for ${period.start} through ${period.end}. It summarizes recorded WOVO activity and requires Payton's review before distribution.`,
      wins: completed.length ? completed.map((task) => task.title) : ["No completed Adam tasks have been recorded for this period yet."],
      risks: blocked.length ? blocked.map((task) => `${task.title}: ${task.last_error_summary ?? task.status}`) : ["No blocked or dead-letter Adam tasks are currently recorded."],
      decisions_needed: approvals.length ? approvals.map((approval) => approval.title) : ["No Adam approval requests are currently waiting."],
      next_priorities: priorities.length ? priorities.map((task) => task.title) : [workspace.current_objective],
      metrics,
      generated_by: "system_rules",
      created_by: context.user.id,
    }),
  });
  const report = rows?.[0];
  if (!report) throw new Error("Unable to create the weekly report draft.");
  await insertAudit(workspace, context, { eventType: "weekly_report_drafted", subjectType: "weekly_report", subjectId: report.id, summary: `Weekly executive report drafted for ${period.start}–${period.end}.`, actorKind: "adam_system" });
  return { report, existing: false };
}

export async function generateRecommendations(context: AdamContext) {
  const workspace = await ensureWorkspace(context);
  const snapshot = await loadAdamSnapshot(context);
  const metric = (key: string) => Number(snapshot.kpis.find((item) => item.metric_key === key)?.value_numeric ?? 0);
  const candidates: Array<Omit<AdamRecommendation, "id" | "adam_workspace_id" | "status" | "decided_at" | "created_at" | "updated_at">> = [];
  if (metric("leads.open") > 0 || metric("cases.open") > 0) candidates.push({ fingerprint: `support-${metric("leads.open")}-${metric("cases.open")}`, category: "support", title: "Protect response time in the team inbox", rationale: `${metric("leads.open")} public inquiries and ${metric("cases.open")} client cases are recorded as open.`, recommended_action: "Review the oldest case, assign an owner, and prepare a response draft for Payton's approval.", evidence: { openInquiries: metric("leads.open"), openCases: metric("cases.open") }, requires_owner_approval: true });
  if (metric("content.pending") > 0 || metric("posting.open") > 0) candidates.push({ fingerprint: `content-${metric("content.pending")}-${metric("posting.open")}`, category: "content", title: "Clear the next content bottleneck", rationale: `${metric("content.pending")} content items and ${metric("posting.open")} posting tasks are waiting for action.`, recommended_action: "Choose the highest-priority client item and move it through review without claiming native publishing.", evidence: { pendingContent: metric("content.pending"), postingTasks: metric("posting.open") }, requires_owner_approval: true });
  const deadLetters = snapshot.tasks.filter((task) => task.status === "dead_letter").length;
  if (deadLetters > 0) candidates.push({ fingerprint: `reliability-dead-${deadLetters}`, category: "reliability", title: "Resolve Adam's dead-letter queue", rationale: `${deadLetters} task${deadLetters === 1 ? " has" : "s have"} exhausted the configured attempt limit.`, recommended_action: "Review the sanitized error summary, repair the underlying issue, then explicitly requeue or archive the task.", evidence: { deadLetters }, requires_owner_approval: true });
  if (!candidates.length) candidates.push({ fingerprint: `operations-baseline-${new Date().toISOString().slice(0, 10)}`, category: "operations", title: "Keep the operating snapshot current", rationale: "No immediate inbox, content, or retry exception was identified from the latest recorded metrics.", recommended_action: "Confirm the current objective and refresh KPI data before the weekly owner review.", evidence: { basedOnRecordedMetrics: true }, requires_owner_approval: true });
  const inserted: AdamRecommendation[] = [];
  for (const candidate of candidates) {
    const existing = await supabaseServiceRoleRequest<AdamRecommendation[]>(`/rest/v1/wovo_adam_recommendations?select=*&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&fingerprint=eq.${encodeURIComponent(candidate.fingerprint)}&limit=1`).catch(() => []);
    if (existing?.[0]) continue;
    const rows = await supabaseServiceRoleRequest<AdamRecommendation[]>("/rest/v1/wovo_adam_recommendations", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ adam_workspace_id: workspace.id, ...candidate }),
    });
    if (rows?.[0]) inserted.push(rows[0]);
  }
  await insertAudit(workspace, context, { eventType: "recommendations_refreshed", subjectType: "recommendation", summary: `Adam prepared ${inserted.length} new internal improvement recommendation${inserted.length === 1 ? "" : "s"}.`, actorKind: "adam_system", metadata: { createdCount: inserted.length } });
  return { created: inserted.length };
}

export async function decideRecommendation(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const recommendationId = requiredString(body.recommendationId, "Recommendation", 80);
  if (!isUuid(recommendationId)) throw new PortalHttpError(400, "Invalid recommendation.");
  const status = enumValue(body.status, ["accepted", "dismissed", "implemented"] as const, "Decision");
  const rows = await supabaseServiceRoleRequest<AdamRecommendation[]>(`/rest/v1/wovo_adam_recommendations?id=eq.${encodeURIComponent(recommendationId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, decided_by: context.user.id, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  const recommendation = rows?.[0];
  if (!recommendation) throw new PortalHttpError(404, "Recommendation not found.");
  await insertAudit(workspace, context, { eventType: "recommendation_decided", subjectType: "recommendation", subjectId: recommendation.id, summary: `${recommendation.title} marked ${status}.` });
  return { recommendation };
}

export async function decideApproval(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const approvalId = requiredString(body.approvalId, "Approval", 80);
  if (!isUuid(approvalId)) throw new PortalHttpError(400, "Invalid approval.");
  const status = enumValue(body.status, ["approved", "rejected"] as const, "Decision");
  const rows = await supabaseServiceRoleRequest<AdamApproval[]>(`/rest/v1/wovo_adam_approvals?id=eq.${encodeURIComponent(approvalId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&status=eq.pending`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, decided_by: context.user.id, decision_note: optionalString(body.decisionNote, 1000), decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  const approval = rows?.[0];
  if (!approval) throw new PortalHttpError(404, "Pending approval not found.");
  if (approval.task_id) {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_tasks?id=eq.${encodeURIComponent(approval.task_id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: status === "approved" ? "queued" : "blocked", updated_at: new Date().toISOString() }),
    });
  }
  const campaigns = await supabaseServiceRoleRequest<AdamCampaignDraft[]>(`/rest/v1/wovo_adam_campaign_drafts?select=*&approval_id=eq.${encodeURIComponent(approval.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`).catch(() => []);
  if (campaigns?.[0]) {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_campaign_drafts?id=eq.${encodeURIComponent(campaigns[0].id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: status === "approved" ? "approved_for_setup" : "blocked",
        launch_enabled: false,
        updated_by: context.user.id,
        updated_at: new Date().toISOString(),
      }),
    });
  }
  const deliveryDrafts = await supabaseServiceRoleRequest<AdamDeliveryDraft[]>(`/rest/v1/wovo_adam_delivery_drafts?select=*&correlation_id=eq.${encodeURIComponent(approval.correlation_id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&status=eq.needs_approval&limit=1`).catch(() => []);
  if (deliveryDrafts?.[0]) {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_delivery_drafts?id=eq.${encodeURIComponent(deliveryDrafts[0].id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: status === "approved" ? "approved" : "draft", provider_action_enabled: false, updated_at: new Date().toISOString() }),
    });
  }
  await insertAudit(workspace, context, { eventType: "approval_decided", subjectType: "approval", subjectId: approval.id, correlationId: approval.correlation_id, summary: `${approval.title} ${status}. No external action was executed.` });
  return { approval, externalActionExecuted: false };
}

export async function createCampaignDraft(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const correlationId = randomUUID();
  const name = requiredString(body.name, "Campaign name", 180);
  const rows = await supabaseServiceRoleRequest<AdamCampaignDraft[]>("/rest/v1/wovo_adam_campaign_drafts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      correlation_id: correlationId,
      name,
      sender_identity: ADAM_SENDER_IDENTITY,
      sender_address: ADAM_OUTREACH_ADDRESS,
      sender_signature: ADAM_OUTREACH_SIGNATURE,
      ai_assistance_disclosure: ADAM_AI_DISCLOSURE,
      audience_definition: requiredString(body.audienceDefinition, "Audience definition", 3000),
      subject_template: requiredString(body.subjectTemplate, "Subject template", 300),
      message_template: requiredString(body.messageTemplate, "Message template", 6000),
      opt_out_copy: optionalString(body.optOutCopy, 500),
      recipient_source: optionalString(body.recipientSource, 1000),
      status: "draft",
      launch_enabled: false,
      created_by: context.user.id,
      updated_by: context.user.id,
    }),
  });
  const campaign = rows?.[0];
  if (!campaign) throw new Error("Unable to create outreach draft.");
  await insertAudit(workspace, context, {
    eventType: "campaign_draft_created",
    subjectType: "campaign_draft",
    subjectId: campaign.id,
    correlationId,
    summary: `Outreach draft created: ${name}. Sending remains disabled.`,
    metadata: { senderIdentity: ADAM_SENDER_IDENTITY, senderAddress: ADAM_OUTREACH_ADDRESS, aiAssisted: true, recipientCount: 0, launchEnabled: false },
  });
  return { campaign };
}

export async function submitCampaignReview(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const campaignId = requiredString(body.campaignId, "Campaign draft", 80);
  if (!isUuid(campaignId)) throw new PortalHttpError(400, "Invalid campaign draft.");
  const rows = await supabaseServiceRoleRequest<AdamCampaignDraft[]>(`/rest/v1/wovo_adam_campaign_drafts?select=*&id=eq.${encodeURIComponent(campaignId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&status=eq.draft&limit=1`).catch(() => []);
  const campaign = rows?.[0];
  if (!campaign) throw new PortalHttpError(404, "Draft outreach campaign not found.");
  const approvals = await supabaseServiceRoleRequest<AdamApproval[]>("/rest/v1/wovo_adam_approvals", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      correlation_id: campaign.correlation_id,
      action_type: "external_communication",
      title: `Review outreach draft: ${campaign.name}`,
      summary: "Approve the draft for campaign setup only. Approval does not create a recipient list or send email. Launch remains blocked until audience, sender authorization, compliance/opt-out, and rate policy are separately verified.",
      risk_level: "high",
      proposed_payload: {
        senderIdentity: campaign.sender_identity,
        senderAddress: campaign.sender_address,
        aiAssistanceDisclosure: campaign.ai_assistance_disclosure,
        recipientCount: 0,
        launchEnabled: false,
      },
      requested_by: context.user.id,
    }),
  });
  const approval = approvals?.[0];
  if (!approval) throw new Error("Unable to create campaign approval request.");
  await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_campaign_drafts?id=eq.${encodeURIComponent(campaign.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "owner_review", approval_id: approval.id, launch_enabled: false, updated_by: context.user.id, updated_at: new Date().toISOString() }),
  });
  await insertAudit(workspace, context, {
    eventType: "campaign_submitted_for_review",
    subjectType: "campaign_draft",
    subjectId: campaign.id,
    correlationId: campaign.correlation_id,
    summary: `${campaign.name} submitted for owner review. Sending remains disabled.`,
    metadata: { approvalId: approval.id, launchEnabled: false },
  });
  return { approval, launchEnabled: false };
}

export async function refreshIntegrations(context: AdamContext) {
  const workspace = await ensureWorkspace(context);
  const checkedAt = new Date().toISOString();
  const statuses = integrationStatuses();
  for (const item of statuses) {
    const existing = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_adam_integrations?select=id&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&integration_key=eq.${item.key}&limit=1`).catch(() => []);
    const payload = {
      adam_workspace_id: workspace.id,
      integration_key: item.key,
      display_name: item.label,
      status: item.status,
      capabilities: item.capabilities,
      last_checked_at: checkedAt,
      last_error_code: null,
      last_error_summary: item.status === "blocked" ? item.detail : null,
      updated_at: checkedAt,
    };
    if (existing?.[0]) {
      await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_integrations?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) });
    } else {
      await supabaseServiceRoleRequest("/rest/v1/wovo_adam_integrations", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) });
    }
  }
  await insertAudit(workspace, context, { eventType: "integrations_checked", subjectType: "integration", summary: "Adam refreshed integration configuration status without exposing or testing secret values.", actorKind: "integration", metadata: { checkedCount: statuses.length } });
  return { checked: statuses.length };
}

export async function updateDailyReportSettings(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const dailyReportEnabled = body.enabled === true;
  const hour = integerValue(body.hour ?? workspace.daily_report_hour, "Report hour", 0, 23);
  const timezone = requiredString(body.timezone ?? workspace.owner_timezone, "Owner timezone", 80);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new PortalHttpError(400, "Owner timezone must be a valid IANA timezone.");
  }
  const rows = await supabaseServiceRoleRequest<AdamWorkspace[]>(`/rest/v1/wovo_adam_workspaces?id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ daily_report_enabled: dailyReportEnabled, daily_report_hour: hour, owner_timezone: timezone, updated_at: new Date().toISOString() }),
  });
  await insertAudit(workspace, context, {
    eventType: "daily_report_settings_updated",
    subjectType: "adam_workspace",
    subjectId: workspace.id,
    summary: `Daily private owner report ${dailyReportEnabled ? "enabled" : "disabled"} for ${hour}:00 in ${timezone}.`,
    metadata: { enabled: dailyReportEnabled, hour, timezone, deliveryTarget: "owner_private" },
  });
  return { workspace: rows?.[0] ?? workspace };
}

export async function acknowledgeFailureAlert(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const alertId = requiredString(body.alertId, "Failure alert", 80);
  if (!isUuid(alertId)) throw new PortalHttpError(400, "Invalid failure alert.");
  const rows = await supabaseServiceRoleRequest<AdamFailureAlert[]>(`/rest/v1/wovo_adam_failure_alerts?id=eq.${encodeURIComponent(alertId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&status=eq.open`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "acknowledged", acknowledged_by: context.user.id, acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  const alert = rows?.[0];
  if (!alert) throw new PortalHttpError(404, "Open failure alert not found.");
  await insertAudit(workspace, context, { eventType: "failure_alert_acknowledged", subjectType: "failure_alert", subjectId: alert.id, summary: `Failure alert acknowledged: ${alert.title}` });
  return { alert };
}

const LEAD_SOURCE_KINDS = ["business_website", "public_directory", "manual_referral", "public_event", "other_public_source"] as const;
const LEAD_FIT = ["low", "medium", "high"] as const;
const LEAD_STATUSES = ["researched", "qualified", "draft_ready", "contacted", "replied", "converted", "disqualified"] as const;

function normalizeLeadDomain(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function leadScore(input: { nicheFit: "low" | "medium" | "high"; needSignal: "low" | "medium" | "high"; website: boolean; publicEmail: boolean; sourceKind: string; notes: boolean }) {
  const fit = { low: 5, medium: 18, high: 30 }[input.nicheFit];
  const need = { low: 5, medium: 18, high: 30 }[input.needSignal];
  const score = Math.min(100, fit + need + (input.website ? 15 : 0) + (input.publicEmail ? 10 : 0) + (["business_website", "manual_referral"].includes(input.sourceKind) ? 10 : 5) + (input.notes ? 5 : 0));
  const reasons = [
    `${input.nicheFit} niche fit`,
    `${input.needSignal} visible marketing need`,
    input.website ? "public business website reviewed" : "no website recorded",
    input.publicEmail ? "public business contact confirmed" : "no business email stored",
    `${humanLeadSource(input.sourceKind)} source`,
  ];
  return { score, reasons };
}

function humanLeadSource(value: string) {
  return value.replaceAll("_", " ");
}

async function insertLeadEvent(workspace: AdamWorkspace, context: AdamContext, lead: AdamLead, eventType: string, metadata: Record<string, unknown> = {}) {
  await supabaseServiceRoleRequest("/rest/v1/wovo_adam_lead_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ adam_workspace_id: workspace.id, lead_id: lead.id, correlation_id: lead.correlation_id, event_type: eventType, actor_user_id: context.user.id, metadata }),
  });
}

export async function createLead(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const businessName = requiredString(body.businessName, "Business name", 180);
  const websiteUrl = optionalHttpUrl(body.websiteUrl, "Website URL");
  const sourceUrl = optionalHttpUrl(body.sourceUrl, "Public source URL");
  if (!sourceUrl) throw new PortalHttpError(400, "A public source URL is required.");
  const publicBusinessEmail = optionalString(body.publicBusinessEmail, 320)?.toLowerCase() ?? null;
  if (publicBusinessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicBusinessEmail)) throw new PortalHttpError(400, "Enter a valid public business email.");
  if (publicBusinessEmail && body.publicContactConfirmed !== true) throw new PortalHttpError(400, "Confirm that the email is publicly listed for the business and is not a personal or private address.");
  const sourceKind = enumValue(body.sourceKind, LEAD_SOURCE_KINDS, "Source kind");
  const nicheFit = enumValue(body.nicheFit ?? "medium", LEAD_FIT, "Niche fit");
  const needSignal = enumValue(body.needSignal ?? "medium", LEAD_FIT, "Need signal");
  const niche = requiredString(body.niche, "Niche", 120);
  const location = requiredString(body.location, "Location", 180);
  const researchNotes = optionalString(body.researchNotes, 4000);
  const score = leadScore({ nicheFit, needSignal, website: Boolean(websiteUrl), publicEmail: Boolean(publicBusinessEmail), sourceKind, notes: Boolean(researchNotes) });
  const dedupeBase = publicBusinessEmail || normalizeLeadDomain(websiteUrl) || `${businessName.toLowerCase()}|${location.toLowerCase()}`;
  const dedupeKey = createHash("sha256").update(dedupeBase).digest("hex");
  const existing = await supabaseServiceRoleRequest<AdamLead[]>(`/rest/v1/wovo_adam_leads?select=*&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&dedupe_key=eq.${dedupeKey}&limit=1`).catch(() => []);
  if (existing?.[0]) throw new PortalHttpError(409, "This business is already in Adam's lead pipeline.");
  const correlationId = randomUUID();
  const rows = await supabaseServiceRoleRequest<AdamLead[]>("/rest/v1/wovo_adam_leads", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      correlation_id: correlationId,
      dedupe_key: dedupeKey,
      business_name: businessName,
      website_url: websiteUrl,
      public_business_email: publicBusinessEmail,
      source_url: sourceUrl,
      source_kind: sourceKind,
      niche,
      location,
      niche_fit: nicheFit,
      need_signal: needSignal,
      score: score.score,
      score_reasons: score.reasons,
      research_notes: researchNotes,
      status: score.score >= 65 ? "qualified" : "researched",
      created_by: context.user.id,
      updated_by: context.user.id,
    }),
  });
  const lead = rows?.[0];
  if (!lead) throw new Error("Unable to save lead research.");
  await insertLeadEvent(workspace, context, lead, "researched", { sourceKind, score: score.score, publicBusinessContact: Boolean(publicBusinessEmail) });
  await insertLeadEvent(workspace, context, lead, "scored", { score: score.score, reasons: score.reasons });
  await insertAudit(workspace, context, { eventType: "lead_researched", subjectType: "lead", subjectId: lead.id, correlationId, summary: `Public-business lead recorded: ${businessName}.`, metadata: { score: score.score, sourceKind, outreachSent: false } });
  return { lead };
}

export async function updateLeadStatus(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const leadId = requiredString(body.leadId, "Lead", 80);
  if (!isUuid(leadId)) throw new PortalHttpError(400, "Invalid lead.");
  const status = enumValue(body.status, LEAD_STATUSES, "Lead status");
  const current = await supabaseServiceRoleRequest<AdamLead[]>(`/rest/v1/wovo_adam_leads?select=*&id=eq.${encodeURIComponent(leadId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`).catch(() => []);
  const lead = current?.[0];
  if (!lead) throw new PortalHttpError(404, "Lead not found.");
  if (["contacted", "replied"].includes(status)) {
    throw new PortalHttpError(409, "Contacted and replied states require a separately verified send/reply event. Adam cannot mark them from this dashboard.");
  }
  let convertedAccountId: string | null = null;
  if (status === "converted") {
    convertedAccountId = requiredString(body.accountId, "Converted workspace", 80);
    if (!isUuid(convertedAccountId)) throw new PortalHttpError(400, "Invalid converted workspace.");
    const account = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_portal_accounts?select=id&id=eq.${encodeURIComponent(convertedAccountId)}&limit=1`).catch(() => []);
    if (!account?.[0]) throw new PortalHttpError(404, "Converted workspace not found.");
  }
  const rows = await supabaseServiceRoleRequest<AdamLead[]>(`/rest/v1/wovo_adam_leads?id=eq.${encodeURIComponent(lead.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status,
      converted_account_id: convertedAccountId,
      converted_at: status === "converted" ? new Date().toISOString() : null,
      attribution_source: status === "converted" ? "adam_lead_pipeline_owner_verified" : null,
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    }),
  });
  const updated = rows?.[0];
  if (!updated) throw new Error("Unable to update lead.");
  await insertLeadEvent(workspace, context, updated, status, status === "converted" ? { convertedAccountId } : {});
  await insertAudit(workspace, context, { eventType: "lead_status_changed", subjectType: "lead", subjectId: lead.id, correlationId: lead.correlation_id, summary: `${lead.business_name} moved to ${humanLeadSource(status)}.`, metadata: { status } });
  return { lead: updated };
}

export async function suppressLead(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const leadId = requiredString(body.leadId, "Lead", 80);
  if (!isUuid(leadId)) throw new PortalHttpError(400, "Invalid lead.");
  const reason = requiredString(body.reason, "Suppression reason", 1000);
  const rows = await supabaseServiceRoleRequest<AdamLead[]>(`/rest/v1/wovo_adam_leads?select=*&id=eq.${encodeURIComponent(leadId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`).catch(() => []);
  const lead = rows?.[0];
  if (!lead) throw new PortalHttpError(404, "Lead not found.");
  const suppressionKey = createHash("sha256").update(lead.public_business_email || normalizeLeadDomain(lead.website_url) || lead.id).digest("hex");
  const existing = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_adam_suppressions?select=id&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&suppression_key=eq.${suppressionKey}&limit=1`).catch(() => []);
  if (!existing?.[0]) {
    await supabaseServiceRoleRequest("/rest/v1/wovo_adam_suppressions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ adam_workspace_id: workspace.id, lead_id: lead.id, suppression_key: suppressionKey, reason, created_by: context.user.id }) });
  }
  await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_leads?id=eq.${encodeURIComponent(lead.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "suppressed", suppression_reason: reason, suppressed_at: new Date().toISOString(), updated_by: context.user.id, updated_at: new Date().toISOString() }) });
  await insertLeadEvent(workspace, context, lead, "suppressed", { reasonCode: "owner_suppression" });
  await insertAudit(workspace, context, { eventType: "lead_suppressed", subjectType: "lead", subjectId: lead.id, correlationId: lead.correlation_id, summary: `${lead.business_name} added to the suppression list.`, metadata: { outreachAllowed: false } });
  return { suppressed: true };
}

const DELIVERY_TYPES = ["website_concept", "website_page", "content_calendar", "social_post", "caption", "ugc_ad_concept"] as const;

async function deliveryEntitlementState(accountId: string) {
  const now = new Date().toISOString();
  const [subscriptions, grants, entitlements] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ status: string; current_period_end: string | null; cancel_at_period_end: boolean }>>(`/rest/v1/wovo_portal_subscriptions?select=status,current_period_end,cancel_at_period_end&account_id=eq.${encodeURIComponent(accountId)}&limit=1`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ grant_type: string }>>(`/rest/v1/wovo_portal_access_grants?select=grant_type&account_id=eq.${encodeURIComponent(accountId)}&revoked_at=is.null&starts_at=lte.${encodeURIComponent(now)}&expires_at=gt.${encodeURIComponent(now)}&limit=1`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ entitlement_key: string; status: string; current_period_end: string | null }>>(`/rest/v1/wovo_portal_entitlements?select=entitlement_key,status,current_period_end&account_id=eq.${encodeURIComponent(accountId)}&status=eq.active`).catch(() => []),
  ]);
  const subscription = subscriptions?.[0];
  const paid = ["active", "trialing"].includes(subscription?.status ?? "");
  const ownerGrant = Boolean(grants?.[0]);
  const activeEntitlement = (key: string) => (entitlements ?? []).some((item) => item.entitlement_key === key && (!item.current_period_end || Date.parse(item.current_period_end) > Date.now()));
  return {
    eligible: paid || ownerGrant,
    source: paid ? "paid_subscription" as const : "owner_test_grant" as const,
    paid,
    ownerGrant,
    wovoCode: activeEntitlement("wovo_code"),
    hosting: activeEntitlement("website_hosting"),
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    currentPeriodEnd: subscription?.current_period_end ?? null,
  };
}

export async function createDeliveryDraft(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const accountId = requiredString(body.accountId, "Client workspace", 80);
  if (!isUuid(accountId)) throw new PortalHttpError(400, "Invalid client workspace.");
  const deliveryType = enumValue(body.deliveryType, DELIVERY_TYPES, "Delivery type");
  const accounts = await supabaseServiceRoleRequest<Array<{ id: string; business_name: string; goals: string | null; asset_rights_confirmed: boolean }>>(`/rest/v1/wovo_portal_accounts?select=id,business_name,goals,asset_rights_confirmed&id=eq.${encodeURIComponent(accountId)}&archived_at=is.null&limit=1`).catch(() => []);
  const account = accounts?.[0];
  if (!account) throw new PortalHttpError(404, "Client workspace not found.");
  const entitlement = await deliveryEntitlementState(accountId);
  if (!entitlement.eligible) throw new PortalHttpError(402, "An active base subscription or an audited owner test grant is required for client delivery work.");
  const websiteType = deliveryType === "website_concept" || deliveryType === "website_page";
  if (websiteType && !entitlement.wovoCode && !entitlement.ownerGrant) {
    throw new PortalHttpError(402, "The WOVO Code entitlement is required for website and site-builder generation. Hosting is billed separately.");
  }
  const noteIds = Array.isArray(body.noteIds) ? [...new Set(body.noteIds.filter((item): item is string => typeof item === "string" && isUuid(item)))].slice(0, 30) : [];
  const assetIds = Array.isArray(body.assetIds) ? [...new Set(body.assetIds.filter((item): item is string => typeof item === "string" && isUuid(item)))].slice(0, 30) : [];
  const [notes, assets, consents] = await Promise.all([
    noteIds.length ? supabaseServiceRoleRequest<Array<{ id: string; title: string; status: string; approved_version_id: string | null }>>(`/rest/v1/wovo_knowledge_notes?select=id,title,status,approved_version_id&account_id=eq.${encodeURIComponent(accountId)}&id=in.(${noteIds.join(",")})&status=eq.approved&approved_version_id=not.is.null`).catch(() => []) : Promise.resolve([]),
    assetIds.length ? supabaseServiceRoleRequest<Array<{ id: string; file_name: string; rights_confirmed: boolean; people_consent_confirmed: boolean }>>(`/rest/v1/wovo_portal_assets?select=id,file_name,rights_confirmed,people_consent_confirmed&account_id=eq.${encodeURIComponent(accountId)}&id=in.(${assetIds.join(",")})&archived_at=is.null`).catch(() => []) : Promise.resolve([]),
    supabaseServiceRoleRequest<Array<{ consent_type: string; revoked_at: string | null }>>(`/rest/v1/wovo_portal_consents?select=consent_type,revoked_at&account_id=eq.${encodeURIComponent(accountId)}&revoked_at=is.null`).catch(() => []),
  ]);
  if ((notes ?? []).length !== noteIds.length) throw new PortalHttpError(400, "Every selected WOVO Note must be approved in this client workspace.");
  if ((assets ?? []).length !== assetIds.length || (assets ?? []).some((asset) => !asset.rights_confirmed)) throw new PortalHttpError(400, "Every selected asset must belong to this workspace and have recorded usage rights.");
  const usesVoice = body.usesVoice === true;
  const likenessConsent = (consents ?? []).some((item) => item.consent_type === "likeness");
  const voiceConsent = (consents ?? []).some((item) => item.consent_type === "voice");
  if (deliveryType === "ugc_ad_concept") {
    if (!assetIds.length || (assets ?? []).some((asset) => !asset.people_consent_confirmed) || !likenessConsent) {
      throw new PortalHttpError(400, "UGC concepts require rights-confirmed assets and an active likeness consent for every depicted person.");
    }
    if (usesVoice && !voiceConsent) throw new PortalHttpError(400, "An active voice consent is required for any UGC concept that references a person's voice.");
  }
  const goalSnapshot = optionalString(body.goalSnapshot, 3000) ?? account.goals;
  const missingInputs: string[] = [];
  if (!goalSnapshot) missingInputs.push("Client goals are not documented.");
  if (!noteIds.length) missingInputs.push("No approved WOVO Notes were selected.");
  if (!assetIds.length && ["website_concept", "website_page", "social_post", "ugc_ad_concept"].includes(deliveryType)) missingInputs.push("No rights-confirmed brand asset was selected.");
  if (websiteType && !entitlement.hosting) missingInputs.push("Managed hosting is not active; the draft cannot be provisioned or published by WOVO hosting.");
  if (entitlement.cancelAtPeriodEnd) missingInputs.push(`Paid access is set to end at the current period boundary${entitlement.currentPeriodEnd ? ` (${entitlement.currentPeriodEnd})` : ""}.`);
  const title = requiredString(body.title, "Delivery title", 180);
  const brief = requiredString(body.brief, "Delivery brief", 10000);
  const draftText = requiredString(body.draftText, "Draft output", 20000);
  const correlationId = randomUUID();
  const rows = await supabaseServiceRoleRequest<AdamDeliveryDraft[]>("/rest/v1/wovo_adam_delivery_drafts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      account_id: accountId,
      correlation_id: correlationId,
      delivery_type: deliveryType,
      title,
      status: missingInputs.length ? "draft" : "needs_approval",
      generation_mode: "manual_structured_draft",
      source_note_ids: noteIds,
      source_asset_ids: assetIds,
      goal_snapshot: goalSnapshot,
      missing_inputs: missingInputs,
      entitlement_source: entitlement.source,
      base_subscription_verified: entitlement.paid,
      wovo_code_verified: entitlement.wovoCode,
      hosting_verified: entitlement.hosting,
      credits_reserved: 0,
      auto_publish_opt_in: false,
      official_connection_verified: false,
      provider_ready: false,
      provider_action_enabled: false,
      created_by: context.user.id,
    }),
  });
  const draft = rows?.[0];
  if (!draft) throw new Error("Unable to save client delivery draft.");
  const versions = await supabaseServiceRoleRequest<AdamDeliveryVersion[]>("/rest/v1/wovo_adam_delivery_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      delivery_draft_id: draft.id,
      account_id: accountId,
      version_number: 1,
      brief,
      draft_output: { body: draftText },
      source_manifest: {
        approvedNotes: (notes ?? []).map((note) => ({ id: note.id, title: note.title })),
        authorizedAssets: (assets ?? []).map((asset) => ({ id: asset.id, fileName: asset.file_name })),
        goalSnapshot,
        likenessConsentVerified: deliveryType === "ugc_ad_concept" ? likenessConsent : null,
        voiceConsentVerified: usesVoice ? voiceConsent : null,
      },
      created_by: context.user.id,
    }),
  });
  await insertAudit(workspace, context, {
    eventType: "client_delivery_draft_created",
    subjectType: "delivery_draft",
    subjectId: draft.id,
    correlationId,
    summary: `${deliveryType.replaceAll("_", " ")} draft prepared for ${account.business_name}.`,
    metadata: { accountId, noteCount: noteIds.length, assetCount: assetIds.length, missingInputCount: missingInputs.length, entitlementSource: entitlement.source, providerActionEnabled: false },
  });
  return { draft, version: versions?.[0], missingInputs };
}

export async function submitDeliveryReview(context: AdamContext, body: AdamActionBody) {
  const workspace = await ensureWorkspace(context);
  const draftId = requiredString(body.draftId, "Delivery draft", 80);
  if (!isUuid(draftId)) throw new PortalHttpError(400, "Invalid delivery draft.");
  const rows = await supabaseServiceRoleRequest<AdamDeliveryDraft[]>(`/rest/v1/wovo_adam_delivery_drafts?select=*&id=eq.${encodeURIComponent(draftId)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&status=in.(draft,needs_approval)&limit=1`).catch(() => []);
  const draft = rows?.[0];
  if (!draft) throw new PortalHttpError(404, "Delivery draft not found.");
  const entitlement = await deliveryEntitlementState(draft.account_id);
  if (!entitlement.eligible) throw new PortalHttpError(402, "This workspace no longer has active paid access or an owner test grant. The draft is preserved but cannot advance.");
  if (draft.missing_inputs.length) throw new PortalHttpError(409, "Resolve the recorded missing inputs before requesting approval.");
  if (["website_concept", "website_page"].includes(draft.delivery_type) && !entitlement.wovoCode && !entitlement.ownerGrant) throw new PortalHttpError(402, "An active WOVO Code entitlement is required before this website draft can advance.");
  const approvals = await supabaseServiceRoleRequest<AdamApproval[]>("/rest/v1/wovo_adam_approvals", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      adam_workspace_id: workspace.id,
      correlation_id: draft.correlation_id,
      action_type: draft.delivery_type.includes("website") ? "outbound_action" : "publishing",
      title: `Review client delivery: ${draft.title}`,
      summary: "Approve the saved draft for client review only. No site, post, ad, or provider action will be published or scheduled.",
      risk_level: draft.delivery_type === "ugc_ad_concept" ? "high" : "medium",
      proposed_payload: { accountId: draft.account_id, deliveryType: draft.delivery_type, version: draft.current_version, externalAction: false },
      requested_by: context.user.id,
    }),
  });
  await supabaseServiceRoleRequest(`/rest/v1/wovo_adam_delivery_drafts?id=eq.${encodeURIComponent(draft.id)}&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "needs_approval", updated_at: new Date().toISOString() }) });
  await insertAudit(workspace, context, { eventType: "client_delivery_submitted_for_review", subjectType: "delivery_draft", subjectId: draft.id, correlationId: draft.correlation_id, summary: `${draft.title} submitted for owner approval. No external action occurred.`, metadata: { approvalId: approvals?.[0]?.id ?? null, accountId: draft.account_id } });
  return { approval: approvals?.[0], externalActionExecuted: false };
}
