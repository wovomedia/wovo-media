import "server-only";

import { randomUUID } from "node:crypto";
import { getEnv, getEnvAny } from "@/lib/env";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { generateAdamText } from "@/lib/adam/ai";
import type { AdamDailyReport, AdamWorkspace } from "@/lib/adam/types";

type JobRun = {
  id: string;
  adam_workspace_id: string;
  correlation_id: string;
  status: "queued" | "running" | "completed" | "failed" | "dead_letter" | "disabled";
  attempt_count: number;
  max_attempts: number;
};

type MetricInput = {
  signups: number;
  verifiedAccounts: number;
  onboardingCompleted: number;
  checkoutsCompleted: number;
  subscriptionActivations: number;
  activeSubscriptions: number;
  mrrEstimateCents: number;
  trials: number;
  openSupportCases: number;
  contentAwaitingAction: number;
  openTasks: number;
  websiteStatus: number;
  errors: number;
  aiUnits: number;
  aiProviderCostMicros: number;
  creditUnitsConsumed: number;
  leadsResearched: number;
  outreachDrafts: number;
  outreachQueued: number;
  outreachSends: number;
  outreachDelivered: number;
  outreachBounced: number;
  outreachUnsubscribed: number;
  outreachReplies: number;
  outreachConversions: number;
  socialScheduled: number;
  socialPublished: number;
  socialFailed: number;
  deploymentEvents: number;
  rollbackEvents: number;
};

type SocialReportItem = {
  ownerScope: boolean;
  accountId: string | null;
  platform: "Facebook" | "Instagram";
  format: "Text" | "Image" | "Carousel" | "Reel" | "Story";
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  topic: string;
  title: string;
  providerPostId: string | null;
};

type SocialJobRow = {
  account_id: string | null;
  owner_scope: boolean;
  destination: "facebook_page" | "instagram";
  content_format: "text" | "single_image" | "carousel" | "reel" | "story";
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  campaign_key: string | null;
  creative_headline: string | null;
  provider_post_id: string | null;
};

type ReportInput = {
  metrics: MetricInput;
  accomplishments: string[];
  blockers: string[];
  priorities: string[];
  socialTodayNext: SocialReportItem[];
  socialLast7Days: SocialReportItem[];
  intervalStart: string;
  intervalEnd: string;
};

function privateOwnerRecipient(): string {
  return getEnvAny(["WOVO_OWNER_EMAIL", "WOVO_OWNER_EMAILS"]).split(",")[0]?.trim().toLowerCase() ?? "";
}

function localDate(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function centralTime(value: string | null): string {
  if (!value) return "not scheduled";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function monthlyEquivalentCents(priceId: string | null): number {
  if (!priceId) return 0;
  if (priceId === getEnv("WOVO_PORTAL_MONTHLY_PRICE_ID")) return 4499;
  if (priceId === getEnv("WOVO_PORTAL_QUARTERLY_PRICE_ID")) return 3999;
  if (priceId === getEnv("WOVO_PORTAL_SEMIANNUAL_PRICE_ID")) return 3499;
  if (priceId === getEnv("WOVO_PORTAL_YEARLY_PRICE_ID")) return 2999;
  if (priceId === getEnv("WOVO_PORTAL_QUARTERLY_PRICE_ID")) return 1200;
  if (priceId === getEnv("WOVO_PORTAL_YEARLY_PRICE_ID")) return 1000;
  if (getEnv("WOVO_PORTAL_GRANDFATHERED_PRICE_IDS").split(",").map((item) => item.trim()).includes(priceId)) return 3999;
  return 0;
}

async function siteHealth(): Promise<number> {
  const site = getEnvAny(["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"]);
  if (!site) return 0;
  try {
    const response = await fetch(site, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "WOVO-Adam-Health/1.0" } });
    return response.ok ? response.status : -response.status;
  } catch {
    return -1;
  }
}

async function verifiedAuthUsers(since: string): Promise<number> {
  const url = getEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]).replace(/\/$/, "");
  const key = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]);
  if (!url || !key) return 0;
  try {
    const response = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
      cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return 0;
    const payload = await response.json() as { users?: Array<{ email_confirmed_at?: string | null; confirmed_at?: string | null }> };
    return (payload.users ?? []).filter((user) => {
      const confirmed = user.email_confirmed_at ?? user.confirmed_at;
      return confirmed ? new Date(confirmed).getTime() >= new Date(since).getTime() : false;
    }).length;
  } catch {
    return 0;
  }
}

export async function collectMetrics(since: string): Promise<ReportInput> {
  const now = new Date();
  const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [accounts, subscriptions, inquiries, threads, content, tasks, failedTasks, usage, adamUsage, creditUsage, leads, campaigns, leadEvents, completedTasks, health, verifiedAccounts, onboarded, checkoutEvents, subscriptionEvents, outreachMessages, socialJobs, deploymentAudit] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_portal_accounts?select=id&created_at=gte.${encodeURIComponent(since)}&limit=2000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ status: string; stripe_price_id: string | null }>>("/rest/v1/wovo_portal_subscriptions?select=status,stripe_price_id&status=in.(active,trialing)&limit=2000").catch(() => []),
    supabaseServiceRoleRequest<Array<{ id: string }>>("/rest/v1/wovo_public_inquiries?select=id&archived_at=is.null&status=not.in.(resolved)&limit=2000").catch(() => []),
    supabaseServiceRoleRequest<Array<{ id: string }>>("/rest/v1/wovo_portal_threads?select=id&status=not.in.(resolved,closed)&limit=2000").catch(() => []),
    supabaseServiceRoleRequest<Array<{ id: string }>>("/rest/v1/wovo_portal_content_items?select=id&archived_at=is.null&status=in.(client_review,approved,queued,revision_requested)&limit=2000").catch(() => []),
    supabaseServiceRoleRequest<Array<{ title: string; priority: number }>>("/rest/v1/wovo_adam_tasks?select=title,priority&status=in.(queued,in_progress,needs_approval)&order=priority.asc&limit=20").catch(() => []),
    supabaseServiceRoleRequest<Array<{ title: string; status: string; last_error_summary: string | null }>>("/rest/v1/wovo_adam_tasks?select=title,status,last_error_summary&status=in.(blocked,failed,dead_letter)&limit=50").catch(() => []),
    supabaseServiceRoleRequest<Array<{ actual_units: number | null; estimated_units: number; actual_provider_cost_micros: number | null; estimated_provider_cost_micros: number }>>(`/rest/v1/wovo_ai_usage_requests?select=actual_units,estimated_units,actual_provider_cost_micros,estimated_provider_cost_micros&status=eq.completed&completed_at=gte.${encodeURIComponent(since)}&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ input_tokens: number | null; output_tokens: number | null; actual_cost_micros: number | null; estimated_cost_micros: number }>>(`/rest/v1/wovo_adam_ai_requests?select=input_tokens,output_tokens,actual_cost_micros,estimated_cost_micros&status=eq.completed&completed_at=gte.${encodeURIComponent(since)}&limit=1000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ delta: number }>>(`/rest/v1/wovo_portal_credit_ledger?select=delta&entry_type=eq.consumption&created_at=gte.${encodeURIComponent(since)}&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_adam_leads?select=id&created_at=gte.${encodeURIComponent(since)}&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_adam_campaign_drafts?select=id&created_at=gte.${encodeURIComponent(since)}&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ event_type: string }>>(`/rest/v1/wovo_adam_lead_events?select=event_type&event_type=in.(contacted,replied,converted)&created_at=gte.${encodeURIComponent(since)}&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ title: string }>>(`/rest/v1/wovo_adam_tasks?select=title&status=eq.completed&completed_at=gte.${encodeURIComponent(since)}&limit=20`).catch(() => []),
    siteHealth(),
    verifiedAuthUsers(since),
    supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_portal_accounts?select=id&onboarding_completed_at=gte.${encodeURIComponent(since)}&limit=2000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ event_id: string }>>(`/rest/v1/wovo_portal_stripe_events?select=event_id&event_type=eq.checkout.session.completed&status=eq.processed&processed_at=gte.${encodeURIComponent(since)}&limit=2000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ account_id: string }>>(`/rest/v1/wovo_portal_subscriptions?select=account_id&status=in.(active,trialing)&updated_at=gte.${encodeURIComponent(since)}&limit=2000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ status: string; sent_at: string | null; delivered_at: string | null; bounced_at: string | null; unsubscribed_at: string | null; replied_at: string | null }>>(`/rest/v1/wovo_adam_outreach_messages?select=status,sent_at,delivered_at,bounced_at,unsubscribed_at,replied_at&updated_at=gte.${encodeURIComponent(since)}&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<SocialJobRow[]>(`/rest/v1/wovo_meta_publish_jobs?select=account_id,owner_scope,destination,content_format,status,scheduled_for,published_at,campaign_key,creative_headline,provider_post_id&created_at=gte.${encodeURIComponent(last7)}&order=created_at.desc&limit=5000`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ event_type: string }>>(`/rest/v1/wovo_adam_audit_events?select=event_type&event_type=in.(production_deployed,production_rolled_back,deployment_failed)&created_at=gte.${encodeURIComponent(since)}&limit=500`).catch(() => []),
  ]);
  const activeSubscriptions = (subscriptions ?? []).filter((item) => item.status === "active");
  const trials = (subscriptions ?? []).filter((item) => item.status === "trialing");
  const aiUnits = (usage ?? []).reduce((sum, item) => sum + (item.actual_units ?? item.estimated_units), 0) + (adamUsage ?? []).reduce((sum, item) => sum + (item.input_tokens ?? 0) + (item.output_tokens ?? 0), 0);
  const aiCost = (usage ?? []).reduce((sum, item) => sum + (item.actual_provider_cost_micros ?? item.estimated_provider_cost_micros), 0) + (adamUsage ?? []).reduce((sum, item) => sum + (item.actual_cost_micros ?? item.estimated_cost_micros), 0);
  const alerts = await supabaseServiceRoleRequest<Array<{ title: string }>>("/rest/v1/wovo_adam_failure_alerts?select=title&status=eq.open&limit=50").catch(() => []);
  const toSocial = (item: SocialJobRow): SocialReportItem => ({
    ownerScope: item.owner_scope,
    accountId: item.account_id,
    platform: item.destination === "facebook_page" ? "Facebook" : "Instagram",
    format: item.content_format === "single_image" ? "Image" : item.content_format === "text" ? "Text" : item.content_format === "carousel" ? "Carousel" : item.content_format === "reel" ? "Reel" : "Story",
    status: item.status,
    scheduledFor: item.scheduled_for,
    publishedAt: item.published_at,
    topic: item.campaign_key ?? "client content",
    title: item.creative_headline ?? "Scheduled social item",
    providerPostId: item.provider_post_id,
  });
  const socialLedger = (socialJobs ?? []).map(toSocial);
  const inTodayNext = (item: SocialReportItem) => {
    const timestamp = item.publishedAt ?? item.scheduledFor;
    return timestamp ? new Date(timestamp).getTime() >= new Date(since).getTime() && new Date(timestamp).getTime() <= new Date(next24).getTime() : false;
  };
  return {
    metrics: {
      signups: accounts?.length ?? 0,
      verifiedAccounts,
      onboardingCompleted: onboarded?.length ?? 0,
      checkoutsCompleted: checkoutEvents?.length ?? 0,
      subscriptionActivations: subscriptionEvents?.length ?? 0,
      activeSubscriptions: activeSubscriptions.length,
      mrrEstimateCents: activeSubscriptions.reduce((sum, item) => sum + monthlyEquivalentCents(item.stripe_price_id), 0),
      trials: trials.length,
      openSupportCases: (inquiries?.length ?? 0) + (threads?.length ?? 0),
      contentAwaitingAction: content?.length ?? 0,
      openTasks: tasks?.length ?? 0,
      websiteStatus: health,
      errors: (failedTasks?.length ?? 0) + (alerts?.length ?? 0),
      aiUnits,
      aiProviderCostMicros: aiCost,
      creditUnitsConsumed: Math.abs((creditUsage ?? []).reduce((sum, item) => sum + item.delta, 0)),
      leadsResearched: leads?.length ?? 0,
      outreachDrafts: campaigns?.length ?? 0,
      outreachQueued: (outreachMessages ?? []).filter((item) => item.status === "queued").length,
      outreachSends: (outreachMessages ?? []).filter((item) => item.sent_at && new Date(item.sent_at).getTime() >= new Date(since).getTime()).length,
      outreachDelivered: (outreachMessages ?? []).filter((item) => item.delivered_at && new Date(item.delivered_at).getTime() >= new Date(since).getTime()).length,
      outreachBounced: (outreachMessages ?? []).filter((item) => item.bounced_at && new Date(item.bounced_at).getTime() >= new Date(since).getTime()).length,
      outreachUnsubscribed: (outreachMessages ?? []).filter((item) => item.unsubscribed_at && new Date(item.unsubscribed_at).getTime() >= new Date(since).getTime()).length,
      outreachReplies: (outreachMessages ?? []).filter((item) => item.replied_at && new Date(item.replied_at).getTime() >= new Date(since).getTime()).length,
      outreachConversions: (leadEvents ?? []).filter((item) => item.event_type === "converted").length,
      socialScheduled: socialLedger.filter((item) => ["approved", "queued"].includes(item.status) && inTodayNext(item)).length,
      socialPublished: socialLedger.filter((item) => item.status === "published" && inTodayNext(item)).length,
      socialFailed: socialLedger.filter((item) => item.status === "failed" && inTodayNext(item)).length,
      deploymentEvents: (deploymentAudit ?? []).filter((item) => item.event_type === "production_deployed").length,
      rollbackEvents: (deploymentAudit ?? []).filter((item) => item.event_type === "production_rolled_back").length,
    },
    accomplishments: (completedTasks ?? []).map((item) => item.title),
    blockers: [...(failedTasks ?? []).map((item) => `${item.title}: ${item.last_error_summary ?? item.status}`), ...(alerts ?? []).map((item) => item.title)],
    priorities: (tasks ?? []).slice(0, 5).map((item) => item.title),
    socialTodayNext: socialLedger.filter(inTodayNext),
    socialLast7Days: socialLedger,
    intervalStart: since,
    intervalEnd: now.toISOString(),
  };
}

function reportHtml(workspace: AdamWorkspace, reportDate: string, input: Awaited<ReturnType<typeof collectMetrics>>, runId: string): string {
  const rows: Array<[string, string]> = [
    ["Report run ID", runId],
    ["Account records created", String(input.metrics.signups)],
    ["Email verifications completed", String(input.metrics.verifiedAccounts)],
    ["Onboarding completions", String(input.metrics.onboardingCompleted)],
    ["Verified checkouts completed", String(input.metrics.checkoutsCompleted)],
    ["Subscription activations", String(input.metrics.subscriptionActivations)],
    ["Active subscriptions", String(input.metrics.activeSubscriptions)],
    ["MRR estimate", `$${(input.metrics.mrrEstimateCents / 100).toFixed(2)}`],
    ["Trials", String(input.metrics.trials)],
    ["Open support cases", String(input.metrics.openSupportCases)],
    ["Content awaiting action", String(input.metrics.contentAwaitingAction)],
    ["Adam tasks open", String(input.metrics.openTasks)],
    ["Website health", input.metrics.websiteStatus > 0 ? `HTTP ${input.metrics.websiteStatus}` : `Unavailable (${input.metrics.websiteStatus})`],
    ["Errors / alerts", String(input.metrics.errors)],
    ["AI units (24h)", String(input.metrics.aiUnits)],
    ["Tracked AI cost (24h)", `$${(input.metrics.aiProviderCostMicros / 1_000_000).toFixed(2)}`],
    ["Credits consumed (24h)", String(input.metrics.creditUnitsConsumed)],
    ["Leads researched (24h)", String(input.metrics.leadsResearched)],
    ["Outreach queued / sent / delivered", `${input.metrics.outreachQueued} / ${input.metrics.outreachSends} / ${input.metrics.outreachDelivered}`],
    ["Outreach bounced / unsubscribed / replied", `${input.metrics.outreachBounced} / ${input.metrics.outreachUnsubscribed} / ${input.metrics.outreachReplies}`],
    ["Attributed conversions", String(input.metrics.outreachConversions)],
    ["Social scheduled / published / failed", `${input.metrics.socialScheduled} / ${input.metrics.socialPublished} / ${input.metrics.socialFailed}`],
    ["Deployments / rollbacks recorded", `${input.metrics.deploymentEvents} / ${input.metrics.rollbackEvents}`],
  ];
  const list = (items: string[], fallback: string) => `<ul style="margin:8px 0 0;padding-left:20px">${(items.length ? items : [fallback]).map((item) => `<li style="margin:6px 0">${escapeHtml(item)}</li>`).join("")}</ul>`;
  const social = input.socialTodayNext.map((item) => `<li style="margin:10px 0"><strong>${escapeHtml(`${item.platform} ${item.format}`)}</strong> · ${escapeHtml(item.status)} · ${escapeHtml(centralTime(item.publishedAt ?? item.scheduledFor))}<br>${escapeHtml(item.title)} · ${escapeHtml(item.topic)}${item.providerPostId ? `<br>Provider ID: ${escapeHtml(item.providerPostId)}` : ""}</li>`).join("");
  return `<div style="background:#f3efe6;padding:28px;font-family:Arial,sans-serif;color:#191714"><div style="max-width:720px;margin:auto;background:#fffdf8;border:1px solid #ded6c8;padding:28px"><div style="height:5px;width:56px;background:#f05a3a"></div><p style="margin:20px 0 4px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#d94326">Private owner report · ${escapeHtml(reportDate)}</p><h1 style="margin:8px 0;font-size:30px">Adam Carter — WOVO Media AI COO / Operations Assistant</h1><p style="color:#655f56;line-height:1.6">Factual internal summary for ${escapeHtml(workspace.name)} covering ${escapeHtml(centralTime(input.intervalStart))} through ${escapeHtml(centralTime(input.intervalEnd))}. Adam is an AI assistant. Recorded outcomes are counted only from verified database/provider events.</p><table style="width:100%;border-collapse:collapse;margin-top:22px">${rows.map(([label, value]) => `<tr><td style="padding:9px 0;border-bottom:1px solid #e7dfd2;color:#655f56">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #e7dfd2;text-align:right;font-weight:700">${escapeHtml(value)}</td></tr>`).join("")}</table><h2 style="font-size:18px;margin:24px 0 0">Today / next 24 hours</h2>${social ? `<ul style="margin:8px 0 0;padding-left:20px">${social}</ul>` : `<p style="color:#655f56">No scheduled, published, or failed social activity in this window. No Reels or Stories are claimed.</p>`}<p><a href="https://wovomedia.com/portal" style="color:#b33b25">Open the private 7-day content ledger</a></p><h2 style="font-size:18px;margin:24px 0 0">Accomplishments</h2>${list(input.accomplishments, "No completed Adam tasks were recorded in this interval.")}<h2 style="font-size:18px;margin:24px 0 0">Blockers</h2>${list(input.blockers, "No recorded task failures or open Adam alerts.")}<h2 style="font-size:18px;margin:24px 0 0">Next 3 priorities</h2>${list(input.priorities.slice(0, 3), workspace.current_objective)}<div style="margin-top:28px;padding-top:18px;border-top:1px solid #ded6c8;color:#655f56;white-space:pre-line">Adam Carter | AI COO / Operations Assistant, WOVO Media\nAI-assisted representative\nhttps://wovomedia.com\nhttps://wovomedia.com/contact</div></div></div>`;
}

export async function createDailyReportDraft(workspace: AdamWorkspace): Promise<{ report: AdamDailyReport; input: Awaited<ReturnType<typeof collectMetrics>>; reused: boolean }> {
  const reportDate = localDate(workspace.owner_timezone);
  const existingReports = await supabaseServiceRoleRequest<AdamDailyReport[]>(`/rest/v1/wovo_adam_daily_reports?select=*&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&report_date=eq.${reportDate}&limit=1`).catch(() => []);
  const existing = existingReports?.[0];
  const input = await collectMetrics(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (existing?.ai_narrative && existing.ai_request_id) return { report: existing, input, reused: true };
  const factualContext = JSON.stringify({ reportDate, timezone: workspace.owner_timezone, intervalStart: input.intervalStart, intervalEnd: input.intervalEnd, metrics: input.metrics, socialTodayNext: input.socialTodayNext, recordedAccomplishments: input.accomplishments, recordedBlockers: input.blockers, recordedPriorities: input.priorities.slice(0, 3), currentObjective: workspace.current_objective });
  const generated = await generateAdamText(workspace, { user: { id: workspace.owner_user_id } }, {
    idempotencyKey: `daily-ai-narrative:${reportDate}`,
    kind: "daily_report_draft",
    prompt: "Write a concise private owner briefing with today's factual signal, the top one to three priorities, and any blocker that needs attention. Do not invent trends or outcomes. State when the data is insufficient.",
    factualContext,
  });
  const payload = { status: existing?.status ?? "draft", stats: { ...input.metrics, intervalStart: input.intervalStart, intervalEnd: input.intervalEnd, socialTodayNext: input.socialTodayNext, socialLast7Days: input.socialLast7Days }, accomplishments: input.accomplishments, blockers: input.blockers, next_priorities: input.priorities.length ? input.priorities.slice(0, 3) : [workspace.current_objective], ai_narrative: generated.text, ai_request_id: generated.requestId, updated_at: new Date().toISOString() };
  const rows = existing
    ? await supabaseServiceRoleRequest<AdamDailyReport[]>(`/rest/v1/wovo_adam_daily_reports?id=eq.${encodeURIComponent(existing.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) })
    : await supabaseServiceRoleRequest<AdamDailyReport[]>("/rest/v1/wovo_adam_daily_reports", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ adam_workspace_id: workspace.id, report_date: reportDate, timezone: workspace.owner_timezone, ...payload }) });
  if (!rows?.[0]) throw new Error("REPORT_PERSIST_FAILED");
  return { report: rows[0], input, reused: false };
}

async function recordAudit(workspaceId: string, correlationId: string, eventType: string, summary: string, metadata: Record<string, unknown> = {}) {
  await supabaseServiceRoleRequest("/rest/v1/wovo_adam_audit_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ adam_workspace_id: workspaceId, actor_user_id: null, actor_kind: "adam_system", correlation_id: correlationId, event_type: eventType, subject_type: "daily_report", summary, metadata }) }).catch(() => null);
}

async function failure(workspace: AdamWorkspace, job: JobRun, reportId: string | null, code: string, summary: string) {
  const attemptCount = job.attempt_count + 1;
  const status = attemptCount >= job.max_attempts ? "dead_letter" : "failed";
  await Promise.all([
    supabaseServiceRoleRequest(`/rest/v1/wovo_adam_job_runs?id=eq.${encodeURIComponent(job.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, attempt_count: attemptCount, next_attempt_at: status === "failed" ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null, last_error_code: code, last_error_summary: summary, updated_at: new Date().toISOString() }) }).catch(() => null),
    reportId ? supabaseServiceRoleRequest(`/rest/v1/wovo_adam_daily_reports?id=eq.${encodeURIComponent(reportId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", attempt_count: attemptCount, last_error_code: code, last_error_summary: summary, updated_at: new Date().toISOString() }) }).catch(() => null) : Promise.resolve(null),
    supabaseServiceRoleRequest("/rest/v1/wovo_adam_failure_alerts", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ adam_workspace_id: workspace.id, job_run_id: job.id, severity: status === "dead_letter" ? "critical" : "error", title: "Daily owner report failed", summary, error_code: code }) }).catch(() => null),
    recordAudit(workspace.id, job.correlation_id, "daily_report_failed", "Daily owner report generation or delivery failed. An owner alert was created.", { errorCode: code, attemptCount, deadLetter: status === "dead_letter" }),
  ]);
}

export async function runDailyReport(workspace: AdamWorkspace): Promise<{ status: string; reportId?: string }> {
  if (!workspace.daily_report_enabled) return { status: "disabled" };
  const reportDate = localDate(workspace.owner_timezone);
  const idempotencyKey = `daily-owner-report:${reportDate}`;
  const existingJobs = await supabaseServiceRoleRequest<JobRun[]>(`/rest/v1/wovo_adam_job_runs?select=*&adam_workspace_id=eq.${encodeURIComponent(workspace.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`).catch(() => []);
  let job = existingJobs?.[0];
  if (job?.status === "completed") return { status: "already_delivered" };
  if (job?.status === "dead_letter") return { status: "dead_letter" };
  if (!job) {
    const jobs = await supabaseServiceRoleRequest<JobRun[]>("/rest/v1/wovo_adam_job_runs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ adam_workspace_id: workspace.id, job_type: "daily_owner_report", idempotency_key: idempotencyKey, correlation_id: randomUUID(), status: "running", started_at: new Date().toISOString() }) });
    job = jobs?.[0];
  } else {
    const jobs = await supabaseServiceRoleRequest<JobRun[]>(`/rest/v1/wovo_adam_job_runs?id=eq.${encodeURIComponent(job.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    job = jobs?.[0] ?? job;
  }
  if (!job) throw new Error("Unable to reserve daily report job.");
  let report: AdamDailyReport | undefined;
  try {
    const drafted = await createDailyReportDraft(workspace);
    const input = drafted.input;
    report = drafted.report;
    if (!report) throw new Error("REPORT_PERSIST_FAILED");
    const recipient = privateOwnerRecipient();
    const resendKey = getEnv("RESEND_API_KEY");
    if (!recipient || !resendKey) throw new Error("OWNER_REPORT_DELIVERY_NOT_CONFIGURED");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `adam-daily-owner/${workspace.id}/${reportDate}` },
      body: JSON.stringify({ from: "Adam at WOVO Media <support@wovomedia.com>", to: [recipient], reply_to: "support@wovomedia.com", subject: `WOVO owner report · ${reportDate}`, html: reportHtml(workspace, reportDate, input, job.correlation_id) }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`RESEND_HTTP_${response.status}`);
    const result = await response.json().catch(() => ({})) as { id?: string };
    await Promise.all([
      supabaseServiceRoleRequest(`/rest/v1/wovo_adam_daily_reports?id=eq.${encodeURIComponent(report.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "delivered", delivery_provider: "resend", provider_message_id: result.id ?? null, delivered_at: new Date().toISOString(), attempt_count: job.attempt_count + 1, last_error_code: null, last_error_summary: null, updated_at: new Date().toISOString() }) }),
      supabaseServiceRoleRequest(`/rest/v1/wovo_adam_job_runs?id=eq.${encodeURIComponent(job.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "completed", attempt_count: job.attempt_count + 1, completed_at: new Date().toISOString(), last_error_code: null, last_error_summary: null, updated_at: new Date().toISOString() }) }),
      recordAudit(workspace.id, job.correlation_id, "daily_report_delivered", `Private daily owner report delivered for ${reportDate}.`, { reportId: report.id, deliveryProvider: "resend", deliveryTarget: "owner_private" }),
    ]);
    return { status: "delivered", reportId: report.id };
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_REPORT_ERROR";
    await failure(workspace, job, report?.id ?? null, code, "The daily owner report could not be generated or delivered. Review the private Adam alert and provider configuration.");
    return { status: "failed", reportId: report?.id };
  }
}

export async function runEnabledDailyReports(): Promise<Array<{ workspaceId: string; status: string; reportId?: string }>> {
  const workspaces = await supabaseServiceRoleRequest<AdamWorkspace[]>("/rest/v1/wovo_adam_workspaces?select=*&daily_report_enabled=eq.true&limit=20").catch(() => []);
  const results = [];
  for (const workspace of workspaces ?? []) {
    const result = await runDailyReport(workspace);
    results.push({ workspaceId: workspace.id, ...result });
  }
  return results;
}
