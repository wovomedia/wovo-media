"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";
import type { AdamCampaignDraft, AdamSnapshot } from "@/lib/adam/types";
import OwnerMetaConnection from "@/app/portal/OwnerMetaConnection";

type AdamView = "briefing" | "ask" | "queue" | "memory" | "leads" | "outreach" | "connections";

const views: Array<{ value: AdamView; label: string }> = [
  { value: "briefing", label: "Briefing" },
  { value: "ask", label: "Ask Adam" },
  { value: "queue", label: "Work queue" },
  { value: "memory", label: "Business memory" },
  { value: "leads", label: "Lead research" },
  { value: "outreach", label: "Outreach drafts" },
  { value: "connections", label: "Connections" },
];

const surface = "rounded-[22px] border border-[#191714]/10 bg-[#fffdf8] shadow-[0_18px_48px_rgba(25,23,20,.07)]";
const field = "min-h-12 w-full rounded-xl border border-[#191714]/14 bg-white px-3.5 text-sm text-[#191714] outline-none transition focus:border-[#f05a3a] focus:ring-2 focus:ring-[#f05a3a]/15";
const area = `${field} min-h-28 py-3`;
const primary = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-4 text-sm font-bold text-[#191714] transition hover:bg-[#e34d2f] disabled:cursor-not-allowed disabled:opacity-45";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-xl border border-[#191714]/14 bg-white px-4 text-sm font-bold text-[#191714] transition hover:border-[#f05a3a]/50 hover:bg-[#f05a3a]/[.05] disabled:opacity-45";

function human(value: string) {
  return value.replaceAll("_", " ");
}

function when(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function moneyFromCents(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);
}

function MetricValue({ metricKey, value, unit }: { metricKey: string; value: number | null; unit: string }) {
  if (value === null) return <>—</>;
  if (metricKey === "subscriptions.mrr_estimate") return <>{moneyFromCents(value)}</>;
  if (metricKey === "ai.provider_cost.month") return <>{`$${(value / 1_000_000).toFixed(2)}`}</>;
  if (unit === "boolean") return <>{value === 1 ? "Online" : "Unknown"}</>;
  return <>{value.toLocaleString()}</>;
}

function Status({ value }: { value: string }) {
  const attention = ["blocked", "failed", "dead_letter", "degraded"].includes(value);
  const waiting = ["pending", "needs_approval", "owner_review", "configured", "not_configured"].includes(value);
  return <span className={`text-[11px] font-bold uppercase tracking-[.08em] ${attention ? "text-[#9a2f20]" : waiting ? "text-[#8a5d17]" : "text-[#276548]"}`}>{human(value)}</span>;
}

export default function AdamOperations() {
  const [snapshot, setSnapshot] = useState<AdamSnapshot | null>(null);
  const [view, setView] = useState<AdamView>("briefing");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    return fetch("/api/portal/adam", {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  }, []);

  const load = useCallback(async () => {
    const response = await request();
    const payload = await response.json() as AdamSnapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Adam Operations could not load.");
    setSnapshot(payload);
  }, [request]);

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Adam Operations could not load."));
  }, [load]);

  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(String(payload.action ?? "action"));
    setError("");
    setNotice("");
    try {
      const response = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Adam could not complete that request.");
      setNotice(success);
      await load();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Adam could not complete that request.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const activeTasks = useMemo(() => snapshot?.tasks.filter((task) => !["completed", "archived"].includes(task.status)) ?? [], [snapshot]);
  const approvals = useMemo(() => snapshot?.approvals.filter((approval) => approval.status === "pending") ?? [], [snapshot]);
  const recommendations = useMemo(() => snapshot?.recommendations.filter((item) => item.status === "pending") ?? [], [snapshot]);
  const report = snapshot?.weeklyReports[0] ?? null;

  if (!snapshot && !error) {
    return <div className={`${surface} flex min-h-[420px] items-center justify-center`}><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#191714]/15 border-t-[#f05a3a]" aria-label="Loading Adam Operations" /></div>;
  }
  if (!snapshot) {
    return <div className={`${surface} p-6`}><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">Adam Operations</p><h1 className="mt-2 text-3xl font-medium">Owner access unavailable</h1><p className="mt-3 text-sm leading-6 text-[#655f56]">{error}</p><button type="button" className={`${primary} mt-5`} onClick={() => void load()}>Try again</button></div>;
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-[28px] bg-[#151411] text-white shadow-[0_24px_70px_rgba(25,23,20,.2)]">
        <div className="grid gap-7 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#f2563d]" /><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff8c70]">Owner command center</p><span className="rounded-full border border-white/10 bg-white/[.06] px-2.5 py-1 text-[10px] font-bold text-white/55">Private</span></div>
            <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-[1.02] tracking-[-.04em] sm:text-5xl">Adam Carter <span className="font-normal text-white/45">runs the operating queue.</span></h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/60">AI COO and operations assistant for WOVO. Adam organizes evidence, drafts, priorities, and reports; every completed action still needs a recorded server event.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
            <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#ff8c70]">Action policy</p><span className="rounded-full bg-[#f2563d]/15 px-2 py-1 text-[10px] font-bold text-[#ff9b85]">Approval first</span></div>
            <p className="mt-3 text-sm leading-6 text-white/70">Drafts stay private until approved. Provider actions require an audit record.</p>
          </div>
        </div>
      </header>

      <nav aria-label="Adam Operations sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-2 shadow-[0_10px_30px_rgba(25,23,20,.05)]">
        {views.map((item) => <button key={item.value} type="button" onClick={() => setView(item.value)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition ${view === item.value ? "bg-[#191714] text-white" : "text-[#756e64] hover:bg-[#191714]/[.05] hover:text-[#191714]"}`}>{item.label}</button>)}
      </nav>

      {notice ? <div role="status" className="rounded-xl border border-[#f05a3a]/25 bg-[#f05a3a]/10 p-4 text-sm text-[#7d2d1f]">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-[#b42318]/25 bg-[#fff1ed] p-4 text-sm text-[#8f2118]">{error}</div> : null}

      {view === "briefing" ? <Briefing snapshot={snapshot} activeTasks={activeTasks} approvals={approvals} recommendations={recommendations} report={report} busy={busy} action={action} /> : null}
      {view === "ask" ? <AskAdam snapshot={snapshot} busy={busy} action={action} /> : null}
      {view === "queue" ? <Queue snapshot={snapshot} busy={busy} action={action} /> : null}
      {view === "memory" ? <Memory snapshot={snapshot} busy={busy} action={action} /> : null}
      {view === "leads" ? <LeadPipeline leads={snapshot.leads} busy={busy} action={action} /> : null}
      {view === "outreach" ? <Outreach campaigns={snapshot.campaignDrafts} approvals={approvals} busy={busy} action={action} /> : null}
      {view === "connections" ? <><OwnerMetaConnection /><Connections snapshot={snapshot} busy={busy} action={action} /></> : null}
    </div>
  );
}

function AskAdam({ snapshot, busy, action }: { snapshot: AdamSnapshot; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const conversationId = useMemo(() => snapshot.chatMessages[0]?.conversation_id ?? crypto.randomUUID(), [snapshot.chatMessages]);
  const policy = snapshot.aiPolicy;
  const available = snapshot.controls.aiDraftingEnabled && Boolean(policy);
  const spent = snapshot.aiUsage.monthCostMicros / 1_000_000;
  const cap = (policy?.monthly_cost_cap_micros ?? 0) / 1_000_000;
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <section className={`${surface} overflow-hidden`}>
      <div className="border-b border-[#191714]/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Owner-only planning room</p><h2 className="mt-2 text-3xl font-medium">Ask Adam</h2></div><Status value={available ? (snapshot.aiUsage.lastCompletedAt ? "healthy" : "configured") : "blocked"} /></div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">Ask operations questions or prepare a support, outreach, or content draft. Adam cannot send, publish, charge, deploy, call, or change an account from this conversation.</p>
      </div>
      <div className="max-h-[560px] space-y-4 overflow-y-auto bg-[#f7f2e9] p-4 sm:p-6" aria-live="polite">
        {snapshot.chatMessages.map((message) => <article key={message.id} className={`max-w-[88%] rounded-2xl p-4 text-sm leading-6 ${message.role === "owner" ? "ml-auto bg-[#191714] text-white" : "border border-[#191714]/10 bg-[#fffdf8] text-[#302c27]"}`}><p className={`mb-1 text-[10px] font-bold uppercase tracking-[.12em] ${message.role === "owner" ? "text-white/55" : "text-[#d94326]"}`}>{message.role === "owner" ? "Payton" : "Adam · AI Operations Assistant"}</p><p className="whitespace-pre-wrap">{message.content}</p>{message.role === "adam" ? <p className="mt-3 border-t border-[#191714]/10 pt-2 text-xs text-[#81796f]">Draft only · no external action taken</p> : null}</article>)}
        {!snapshot.chatMessages.length ? <Empty title="Start with one operating question" copy="Adam uses the current objective, recorded KPIs, active tasks, and approved business memory. It does not browse or act outside WOVO." /> : null}
      </div>
      <form className="space-y-3 border-t border-[#191714]/10 p-4 sm:p-6" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const prompt = String(data.get("prompt") ?? ""); const messageKind = String(data.get("messageKind") ?? "operations"); void action({ action: "ask_adam", idempotencyKey: `owner-chat:${crypto.randomUUID()}`, conversationId, messageKind, prompt }, "Adam prepared a private draft. No external action occurred.").then((ok) => { if (ok) form.reset(); }); }}>
        <label className="block text-sm font-bold">What do you need?<textarea name="prompt" required minLength={2} maxLength={6000} disabled={!available} className={`${area} mt-1`} placeholder="Example: What should I prioritize today based on the current queue?" /></label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="block text-sm font-bold sm:w-56">Response type<select name="messageKind" disabled={!available} className={`${field} mt-1`}><option value="operations">Operations guidance</option><option value="support_draft">Support reply draft</option><option value="content_draft">Content draft</option><option value="outreach_draft">Outreach draft</option></select></label><button disabled={!available || busy === "ask_adam"} className={`${primary} sm:min-w-36`}>{busy === "ask_adam" ? "Drafting…" : "Ask Adam"}</button></div>
      </form>
    </section>
    <aside className="space-y-5">
      <section className={`${surface} p-5`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Hard monthly budget</p><p className="mt-3 text-3xl font-medium">${spent.toFixed(3)} <span className="text-base text-[#81796f]">of ${cap.toFixed(2)}</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5ddd0]"><div className="h-full bg-[#f05a3a]" style={{ width: `${cap ? Math.min(100, (spent / cap) * 100) : 0}%` }} /></div><p className="mt-3 text-xs leading-5 text-[#756e64]">{snapshot.aiUsage.monthRequests}/{policy?.monthly_request_cap ?? 0} monthly requests · {snapshot.aiUsage.dayRequests}/{policy?.daily_request_cap ?? 0} today · max {policy?.max_output_tokens ?? 0} output tokens</p></section>
      {policy ? <section className={`${surface} p-5`}><details><summary className="cursor-pointer list-none font-bold">AI budget controls</summary><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action({ action: "update_ai_controls", enabled: data.get("enabled") === "on", monthlyCostCapMicros: Math.round(Number(data.get("monthlyCap")) * 1_000_000), maxOutputTokens: Number(data.get("maxOutput")), hourlyRequestCap: Number(data.get("hourlyCap")), dailyRequestCap: Number(data.get("dailyCap")) }, "Adam AI limits updated with an audit record."); }}><label className="flex min-h-12 items-center gap-3 border border-[#191714]/10 bg-white p-3 text-sm font-bold"><input type="checkbox" name="enabled" defaultChecked={policy.enabled} /> Ask Adam enabled</label><label className="block text-sm font-bold">Monthly cap ($1–$5)<input type="number" name="monthlyCap" min="1" max="5" step="0.5" defaultValue={cap} className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Maximum output tokens<input type="number" name="maxOutput" min="200" max="800" step="50" defaultValue={policy.max_output_tokens} className={`${field} mt-1`} /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold">Per hour<input type="number" name="hourlyCap" min="1" max="12" defaultValue={policy.hourly_request_cap} className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Per day<input type="number" name="dailyCap" min="1" max="40" defaultValue={policy.daily_request_cap} className={`${field} mt-1`} /></label></div><button disabled={busy === "update_ai_controls"} className={`${secondary} w-full`}>Save controls</button></form></details></section> : null}
      <section className="rounded-[22px] bg-[#191714] p-5 text-white"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ff8c70]">Private by design</p><p className="mt-2 text-sm leading-6 text-white/70">Conversation history stays in the owner workspace. OpenAI response storage is disabled. Telemetry records tokens, cost, hashes, and status—not prompt contents.</p></section>
    </aside>
  </div>;
}

function Briefing({ snapshot, activeTasks, approvals, recommendations, report, busy, action }: { snapshot: AdamSnapshot; activeTasks: AdamSnapshot["tasks"]; approvals: AdamSnapshot["approvals"]; recommendations: AdamSnapshot["recommendations"]; report: AdamSnapshot["weeklyReports"][number] | null; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  return <div className="space-y-5">
    <section className={`${surface} grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center`}>
      <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Current objective</p><p className="mt-3 max-w-4xl text-2xl font-medium leading-8">{snapshot.workspace.current_objective}</p></div>
      <details className="xl:w-[320px]"><summary className={`${secondary} cursor-pointer list-none`}>Edit objective</summary><form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action({ action: "update_objective", objective: data.get("objective") }, "Current objective updated."); }}><textarea name="objective" defaultValue={snapshot.workspace.current_objective} maxLength={1200} className={area} /><button disabled={busy === "update_objective"} className={`${primary} w-full`}>Save objective</button></form></details>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {snapshot.kpis.slice(0, 4).map((kpi) => <article key={kpi.metric_key} className={`${surface} p-5`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#756e64]">{kpi.metric_label}</p><Status value={kpi.health} /></div><p className="mt-4 text-4xl font-medium tracking-[-.04em]"><MetricValue metricKey={kpi.metric_key} value={kpi.value_numeric} unit={kpi.unit} /></p><p className="mt-2 text-xs leading-5 text-[#756e64]">{kpi.source_detail}</p></article>)}
      {!snapshot.kpis.length ? <article className={`${surface} p-5 sm:col-span-2 xl:col-span-4`}><h2 className="text-xl font-medium">No operating snapshot yet</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">Refresh pulls counts from existing server-side WOVO records. Revenue is labeled as an estimate, not recognized revenue.</p></article> : null}
    </div>

    <div className="flex flex-col gap-3 sm:flex-row">
      <button type="button" disabled={busy === "refresh_kpis"} className={primary} onClick={() => void action({ action: "refresh_kpis" }, "Operating snapshot refreshed.")}>{busy === "refresh_kpis" ? "Refreshing…" : "Refresh operating snapshot"}</button>
      <button type="button" disabled={busy === "generate_weekly_report"} className={secondary} onClick={() => void action({ action: "generate_weekly_report" }, "Weekly executive report draft is ready for review.")}>Draft weekly report</button>
      <button type="button" disabled={busy === "generate_recommendations"} className={secondary} onClick={() => void action({ action: "generate_recommendations" }, "Internal recommendations refreshed.")}>Review priorities</button>
    </div>

    <DailyReportPanel snapshot={snapshot} busy={busy} action={action} />

    <div className="grid gap-5 xl:grid-cols-2">
      <section className={`${surface} p-5 sm:p-6`}><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">What Adam is working on</p><h2 className="mt-2 text-2xl font-medium">Durable queue</h2></div><span className="text-sm font-bold">{activeTasks.length}</span></div><div className="mt-5 space-y-3">{activeTasks.slice(0, 5).map((task) => <article key={task.id} className="border-t border-[#191714]/10 pt-4 first:border-0 first:pt-0"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{task.title}</p><p className="mt-1 text-sm leading-5 text-[#655f56]">{task.description || human(task.task_type)}</p></div><Status value={task.status} /></div><p className="mt-2 text-xs text-[#81796f]">Correlation {task.correlation_id.slice(0, 8)} · {task.attempt_count}/{task.max_attempts} attempts</p></article>)}{!activeTasks.length ? <Empty title="No active Adam tasks" copy="Create a focused internal task from the Work queue. External-facing drafts automatically require approval." /> : null}</div></section>
      <section className={`${surface} p-5 sm:p-6`}><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Needs approval</p><h2 className="mt-2 text-2xl font-medium">Payton decides</h2></div><span className="text-sm font-bold">{approvals.length}</span></div><div className="mt-5 space-y-4">{approvals.slice(0, 4).map((approval) => <article key={approval.id} className="border-t border-[#191714]/10 pt-4 first:border-0 first:pt-0"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{approval.title}</p><p className="mt-1 text-sm leading-6 text-[#655f56]">{approval.summary}</p></div><Status value={approval.risk_level} /></div><div className="mt-3 flex gap-2"><button type="button" className={secondary} onClick={() => void action({ action: "decide_approval", approvalId: approval.id, status: "rejected", decisionNote: "Declined in Adam Operations." }, "Approval request declined. No external action occurred.")}>Decline</button><button type="button" className={primary} onClick={() => void action({ action: "decide_approval", approvalId: approval.id, status: "approved", decisionNote: "Approved for the recorded draft or setup scope only." }, "Approved for its recorded scope. No external action occurred.")}>Approve scope</button></div></article>)}{!approvals.length ? <Empty title="No decisions waiting" copy="Drafts that could affect customers, publishing, billing, or deployment cannot advance without an owner decision." /> : null}</div></section>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <section className={`${surface} p-5 sm:p-6`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Weekly executive report</p>{report ? <><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><h2 className="text-2xl font-medium">{report.period_start} — {report.period_end}</h2><Status value={report.status} /></div><p className="mt-3 text-sm leading-6 text-[#5f584f]">{report.executive_summary}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><ReportList title="Risks" items={report.risks} /><ReportList title="Next priorities" items={report.next_priorities} /></div><p className="mt-4 text-xs text-[#81796f]">Generated from recorded metrics and task states. Draft only until Payton reviews it.</p></> : <Empty title="No weekly report draft" copy="Create one from the latest recorded KPI, task, and approval states. Adam does not invent results." />}</section>
      <section className={`${surface} p-5 sm:p-6`}><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Improvement queue</p><h2 className="mt-2 text-2xl font-medium">Recommendations</h2></div><span className="text-sm font-bold">{recommendations.length}</span></div><div className="mt-5 space-y-4">{recommendations.slice(0, 4).map((item) => <article key={item.id} className="border-t border-[#191714]/10 pt-4 first:border-0 first:pt-0"><p className="font-bold">{item.title}</p><p className="mt-1 text-sm leading-6 text-[#655f56]">{item.rationale}</p><p className="mt-2 text-sm font-medium">{item.recommended_action}</p><div className="mt-3 flex gap-2"><button className={secondary} onClick={() => void action({ action: "decide_recommendation", recommendationId: item.id, status: "dismissed" }, "Recommendation dismissed.")}>Dismiss</button><button className={primary} onClick={() => void action({ action: "decide_recommendation", recommendationId: item.id, status: "accepted" }, "Recommendation accepted for owner-controlled planning.")}>Accept</button></div></article>)}{!recommendations.length ? <Empty title="No recommendations waiting" copy="Refresh priorities after the KPI snapshot is current." /> : null}</div></section>
    </div>

    <section className={`${surface} p-5 sm:p-6`}><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Recent actions</p><h2 className="mt-2 text-2xl font-medium">Traceable activity</h2></div><span className="text-xs text-[#756e64]">Append-only</span></div><div className="mt-5 divide-y divide-[#191714]/10">{snapshot.audit.slice(0, 8).map((event) => <div key={event.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-bold">{event.summary}</p><p className="mt-1 text-xs text-[#756e64]">{human(event.actor_kind)} · {event.correlation_id.slice(0, 8)}</p></div><time className="text-xs text-[#81796f]">{when(event.created_at)}</time></div>)}{!snapshot.audit.length ? <Empty title="No activity recorded" copy="Objective, task, approval, memory, and report events will appear here." /> : null}</div></section>
  </div>;
}

function DailyReportPanel({ snapshot, busy, action }: { snapshot: AdamSnapshot; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const latest = snapshot.dailyReports[0] ?? null;
  const openAlerts = snapshot.failureAlerts.filter((alert) => alert.status === "open");
  return <section className={`${surface} overflow-hidden`}>
    <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Private daily owner report</p>
        <h2 className="mt-2 text-2xl font-medium">A factual operating brief, once per day</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">Adam can draft one metered narrative per day from recorded WOVO data. Email delivery is a separate owner action.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
        <button type="button" disabled={busy === "draft_daily_ai_report" || !snapshot.controls.aiDraftingEnabled} className={primary} onClick={() => void action({ action: "draft_daily_ai_report" }, "Today's metered AI owner briefing is ready. Nothing was emailed.")}>{busy === "draft_daily_ai_report" ? "Drafting…" : "Draft AI briefing"}</button>
        <button type="button" disabled={busy === "run_daily_report" || !snapshot.workspace.daily_report_enabled} className={primary} onClick={() => void action({ action: "run_daily_report" }, "Today's private owner report was processed. Check the recorded status below.")}>{busy === "run_daily_report" ? "Processing…" : "Run today’s report"}</button>
        <button type="button" disabled={busy === "update_daily_report_settings"} className={secondary} onClick={() => void action({ action: "update_daily_report_settings", enabled: !snapshot.workspace.daily_report_enabled, hour: snapshot.workspace.daily_report_hour, timezone: snapshot.workspace.owner_timezone }, snapshot.workspace.daily_report_enabled ? "Daily private report disabled." : "Daily private report enabled.")}>{snapshot.workspace.daily_report_enabled ? "Disable daily report" : "Enable daily report"}</button>
      </div>
    </div>
    <div className="grid border-t border-[#191714]/10 bg-[#f7f2e9] sm:grid-cols-3">
      <div className="p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#756e64]">Schedule</p><p className="mt-2 text-sm font-bold">Daily morning run · {snapshot.workspace.owner_timezone}</p></div>
      <div className="border-t border-[#191714]/10 p-4 sm:border-l sm:border-t-0 sm:p-5"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#756e64]">Latest record</p><p className="mt-2 text-sm font-bold">{latest ? `${latest.report_date} · ${human(latest.status)}` : "No daily report yet"}</p></div>
      <div className="border-t border-[#191714]/10 p-4 sm:border-l sm:border-t-0 sm:p-5"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#756e64]">Delivery alerts</p><p className={`mt-2 text-sm font-bold ${openAlerts.length ? "text-[#9a2f20]" : "text-[#276548]"}`}>{openAlerts.length ? `${openAlerts.length} needs attention` : "No open alerts"}</p></div>
    </div>
    {latest?.ai_narrative ? <div className="border-t border-[#191714]/10 bg-[#fffdf8] p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#d94326]">Adam&apos;s factual narrative</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#4f4942]">{latest.ai_narrative}</p><p className="mt-3 text-xs text-[#81796f]">AI-assisted draft · review before relying on it · no external action taken</p></div> : null}
    {openAlerts.length ? <div className="border-t border-[#b42318]/20 bg-[#fff1ed] p-5">{openAlerts.slice(0, 3).map((alert) => <div key={alert.id} className="flex flex-col gap-3 border-t border-[#b42318]/15 py-3 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[#8f2118]">{alert.title}</p><p className="mt-1 text-sm leading-6 text-[#6f4039]">{alert.summary}</p></div><button type="button" className={secondary} onClick={() => void action({ action: "acknowledge_failure_alert", alertId: alert.id }, "Failure alert acknowledged.")}>Acknowledge</button></div>)}</div> : null}
  </section>;
}

function Queue({ snapshot, busy, action }: { snapshot: AdamSnapshot; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  return <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><aside className={`${surface} h-fit p-5`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">New internal work</p><h2 className="mt-2 text-2xl font-medium">Give Adam a bounded task</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">External-facing types create an approval request automatically. They do not execute.</p><form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action({ action: "create_task", taskType: data.get("taskType"), title: data.get("title"), description: data.get("description"), priority: data.get("priority"), dueAt: data.get("dueAt") }, "Task added to Adam's durable queue.").then((ok) => { if (ok) form.reset(); }); }}><label className="block text-sm font-bold">Work type<select name="taskType" className={`${field} mt-1`}><option value="internal_improvement">Internal improvement</option><option value="support_draft">Support response draft</option><option value="content_draft">Content draft</option><option value="seo_recommendation">SEO recommendation</option><option value="lead_research_draft">Lead research draft</option><option value="proposal_draft">Proposal draft</option><option value="deployment_proposal">Code/deployment proposal</option></select></label><label className="block text-sm font-bold">Title<input name="title" required minLength={3} maxLength={180} className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Brief<textarea name="description" maxLength={5000} className={`${area} mt-1`} /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold">Priority<select name="priority" defaultValue="3" className={`${field} mt-1`}><option value="1">Urgent</option><option value="2">High</option><option value="3">Normal</option><option value="4">Low</option><option value="5">Later</option></select></label><label className="block text-sm font-bold">Due<input type="datetime-local" name="dueAt" className={`${field} mt-1`} /></label></div><button disabled={busy === "create_task"} className={`${primary} w-full`}>Add task</button></form></aside><section className={`${surface} p-5 sm:p-6`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Durable task queue</p><h2 className="mt-2 text-2xl font-medium">Work, retries, and exceptions</h2><div className="mt-5 space-y-4">{snapshot.tasks.filter((task) => task.status !== "archived").map((task) => <article key={task.id} className="border-t border-[#191714]/10 pt-4 first:border-0 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{task.title}</p><p className="mt-1 text-sm leading-6 text-[#655f56]">{task.description || human(task.task_type)}</p></div><Status value={task.status} /></div><p className="mt-2 text-xs text-[#81796f]">Priority {task.priority} · due {when(task.due_at)} · {task.attempt_count}/{task.max_attempts} attempts · {task.correlation_id.slice(0, 8)}</p><div className="mt-3 flex flex-wrap gap-2">{["queued", "blocked", "failed"].includes(task.status) ? <button className={secondary} onClick={() => void action({ action: "update_task", taskId: task.id, status: "in_progress" }, "Task marked in progress.")}>Start</button> : null}{task.status === "in_progress" ? <button className={primary} onClick={() => void action({ action: "update_task", taskId: task.id, status: "completed" }, "Task marked complete with a recorded audit event.")}>Complete</button> : null}<button className={secondary} onClick={() => void action({ action: "archive_task", taskId: task.id }, "Task archived with restore available.")}>Archive</button></div>{task.last_error_summary ? <p className="mt-3 border-l-2 border-[#b42318] pl-3 text-sm text-[#8f2118]">{task.last_error_summary}</p> : null}</article>)}{!snapshot.tasks.length ? <Empty title="The queue is clear" copy="Add one bounded task with a single expected outcome." /> : null}</div></section></div>;
}

function Memory({ snapshot, busy, action }: { snapshot: AdamSnapshot; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const active = snapshot.memoryItems.filter((item) => item.status !== "archived");
  return <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]"><aside className={`${surface} h-fit p-5`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Structured business memory</p><h2 className="mt-2 text-2xl font-medium">Add reviewed context</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">Memory is editable, versioned data—not secret storage or automatic model learning.</p><form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action({ action: "save_memory", category: data.get("category"), title: data.get("title"), content: data.get("content"), sourceUrl: data.get("sourceUrl"), sourceDate: data.get("sourceDate"), retentionUntil: data.get("retentionUntil"), approve: data.get("approve") === "on" }, "Adam memory saved with a version record.").then((ok) => { if (ok) form.reset(); }); }}><label className="block text-sm font-bold">Category<select name="category" className={`${field} mt-1`}><option value="company_fact">Company fact</option><option value="policy">Policy</option><option value="decision">Decision</option><option value="goal_context">Goal context</option><option value="operating_rule">Operating rule</option><option value="market_context">Market context</option><option value="integration_context">Integration context</option></select></label><label className="block text-sm font-bold">Title<input name="title" required minLength={3} maxLength={180} className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Context<textarea name="content" required maxLength={20000} className={`${area} mt-1`} /></label><label className="block text-sm font-bold">Source URL<input type="url" name="sourceUrl" className={`${field} mt-1`} /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold">Source date<input type="date" name="sourceDate" className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Retain until<input type="date" name="retentionUntil" className={`${field} mt-1`} /></label></div><label className="flex min-h-12 items-start gap-3 border border-[#191714]/12 bg-white p-3 text-sm"><input type="checkbox" name="approve" className="mt-1" /><span><strong>Approved fact or rule.</strong><br /><span className="text-[#655f56]">Adam may rely on this in internal drafts.</span></span></label><button disabled={busy === "save_memory"} className={`${primary} w-full`}>Save memory</button></form></aside><section className={`${surface} p-5 sm:p-6`}><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Approved context</p><h2 className="mt-2 text-2xl font-medium">WOVO memory</h2></div><span className="text-sm font-bold">{active.length}</span></div><div className="mt-5 space-y-4">{active.map((item) => { const version = snapshot.memoryVersions.find((candidate) => candidate.memory_item_id === item.id && candidate.version_number === item.current_version); return <article key={item.id} className="border-t border-[#191714]/10 pt-4 first:border-0 first:pt-0"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#81796f]">{human(item.category)} · v{item.current_version}</p><h3 className="mt-1 font-bold">{item.title}</h3></div><Status value={item.status} /></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5f584f]">{version?.content ?? "Version content unavailable."}</p><p className="mt-2 text-xs text-[#81796f]">{item.source_url ? "Source retained" : "No external source"} · updated {when(item.updated_at)}</p><button className={`${secondary} mt-3`} onClick={() => void action({ action: "archive_memory", memoryId: item.id }, "Memory archived; its version history remains intact.")}>Archive</button></article>; })}{!active.length ? <Empty title="No Adam memory yet" copy="Start with WOVO operating rules, approved company facts, or a documented owner decision. Never paste secrets." /> : null}</div></section></div>;
}

function LeadPipeline({ leads, busy, action }: { leads: AdamSnapshot["leads"]; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  return <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
    <aside className={`${surface} h-fit p-5 sm:p-6`}>
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Lawful public research</p>
      <h2 className="mt-2 text-2xl font-medium">Record a prospect</h2>
      <p className="mt-2 text-sm leading-6 text-[#655f56]">Use a public company website or lawful public listing. WOVO stores the source and review date, deduplicates the business, and never sends from this screen.</p>
      <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action({ action: "create_lead", businessName: data.get("businessName"), websiteUrl: data.get("websiteUrl"), sourceUrl: data.get("sourceUrl"), sourceKind: data.get("sourceKind"), niche: data.get("niche"), location: data.get("location"), nicheFit: data.get("nicheFit"), needSignal: data.get("needSignal"), researchNotes: data.get("researchNotes"), publicBusinessEmail: data.get("publicBusinessEmail"), publicContactConfirmed: data.get("publicContactConfirmed") === "on" }, "Lead saved with source provenance. No outreach was sent.").then((ok) => { if (ok) form.reset(); }); }}>
        <label className="block text-sm font-bold">Business name<input name="businessName" required minLength={2} maxLength={180} className={`${field} mt-1`} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold">Industry<input name="niche" required maxLength={120} className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Service area<input name="location" required maxLength={180} className={`${field} mt-1`} /></label></div>
        <label className="block text-sm font-bold">Public source URL<input type="url" name="sourceUrl" required className={`${field} mt-1`} placeholder="https://business.example/about" /></label>
        <label className="block text-sm font-bold">Business website<input type="url" name="websiteUrl" className={`${field} mt-1`} /></label>
        <label className="block text-sm font-bold">Published business email (optional)<input type="email" name="publicBusinessEmail" className={`${field} mt-1`} /></label>
        <label className="flex items-start gap-3 border border-[#191714]/10 bg-[#f5f0e7] p-3 text-sm"><input type="checkbox" name="publicContactConfirmed" className="mt-1" /><span>I confirmed this is a clearly published business contact—not a private or personal address.</span></label>
        <div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm font-bold">Source<select name="sourceKind" defaultValue="business_website" className={`${field} mt-1`}><option value="business_website">Business website</option><option value="public_directory">Public directory</option><option value="public_event">Public event</option><option value="manual_referral">Referral</option><option value="other_public_source">Other lawful source</option></select></label><label className="block text-sm font-bold">Fit<select name="nicheFit" defaultValue="medium" className={`${field} mt-1`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="block text-sm font-bold">Need<select name="needSignal" defaultValue="medium" className={`${field} mt-1`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
        <label className="block text-sm font-bold">Evidence and fit rationale<textarea name="researchNotes" maxLength={4000} className={`${area} mt-1`} placeholder="Public facts only. Do not infer sensitive traits." /></label>
        <button disabled={busy === "create_lead"} className={`${primary} w-full`}>Save to review list</button>
      </form>
    </aside>
    <section className={`${surface} p-5 sm:p-6`}>
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Private owner pipeline</p><h2 className="mt-2 text-2xl font-medium">Prospects with provenance</h2></div><span className="text-sm font-bold">{leads.length}</span></div>
      <div className="mt-5 space-y-4">{leads.filter((lead) => lead.status !== "archived").map((lead) => <article key={lead.id} className="border-t border-[#191714]/10 pt-4 first:border-0 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{lead.business_name}</h3><p className="mt-1 text-sm text-[#655f56]">{lead.niche} · {lead.location} · fit score {lead.score}/100</p></div><Status value={lead.status} /></div><p className="mt-3 text-sm leading-6 text-[#5f584f]">{lead.research_notes || lead.score_reasons.join(" · ")}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold"><a href={lead.source_url} target="_blank" rel="noreferrer" className="text-[#b33b25] underline underline-offset-4">View source</a>{lead.website_url ? <a href={lead.website_url} target="_blank" rel="noreferrer" className="text-[#b33b25] underline underline-offset-4">Business site</a> : null}<span className="text-[#81796f]">Retrieved {new Date(lead.created_at).toLocaleDateString()}</span></div><div className="mt-3 flex flex-wrap gap-2">{lead.status !== "suppressed" ? <button className={secondary} onClick={() => void action({ action: "suppress_lead", leadId: lead.id, reason: "Owner suppression from lead review" }, "Lead suppressed from all outreach.")}>Suppress</button> : null}<button className={secondary} onClick={() => void navigator.clipboard.writeText(`${lead.business_name}\n${lead.website_url || lead.source_url}\n${lead.niche} · ${lead.location}\nSource: ${lead.source_url}`)}>Copy summary</button></div></article>)}{!leads.length ? <Empty title="No businesses recorded" copy="Add a business only after reviewing a lawful public source. Search itself remains disabled until a rate-limited provider is configured." /> : null}</div>
    </section>
  </div>;
}

function Outreach({ campaigns, approvals, busy, action }: { campaigns: AdamCampaignDraft[]; approvals: AdamSnapshot["approvals"]; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  return <div className="space-y-5"><section className={`${surface} border-l-4 border-l-[#f05a3a] p-5 sm:p-6`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Outreach safety boundary</p><h2 className="mt-2 text-2xl font-medium">Draft and review only</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#655f56]">Adam cannot build recipient lists, scrape businesses, send bulk email, or launch a campaign. Every draft identifies Adam as WOVO Media&apos;s AI Operations Assistant. A future launch requires an approved audience, message, opt-out/compliance review, rate policy, and sender authorization.</p></section><div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]"><aside className={`${surface} h-fit p-5`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">New outreach draft</p><h2 className="mt-2 text-2xl font-medium">Prepare for owner review</h2><form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action({ action: "create_campaign_draft", name: data.get("name"), audienceDefinition: data.get("audienceDefinition"), subjectTemplate: data.get("subjectTemplate"), messageTemplate: data.get("messageTemplate"), optOutCopy: data.get("optOutCopy"), recipientSource: data.get("recipientSource") }, "Outreach draft saved. Sending remains disabled.").then((ok) => { if (ok) form.reset(); }); }}><label className="block text-sm font-bold">Campaign name<input name="name" required minLength={3} maxLength={180} className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Audience definition<textarea name="audienceDefinition" required maxLength={3000} className={`${area} mt-1`} placeholder="Describe a legitimate, owner-approved audience. Do not paste recipient lists." /></label><label className="block text-sm font-bold">Subject draft<input name="subjectTemplate" required maxLength={300} className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Message draft<textarea name="messageTemplate" required maxLength={6000} className={`${area} mt-1`} /></label><label className="block text-sm font-bold">Opt-out copy<textarea name="optOutCopy" maxLength={500} className={`${field} mt-1 py-3`} /></label><label className="block text-sm font-bold">Recipient-source plan<input name="recipientSource" maxLength={1000} className={`${field} mt-1`} placeholder="Describe the lawful source; no addresses here" /></label><button disabled={busy === "create_campaign_draft"} className={`${primary} w-full`}>Save outreach draft</button></form></aside><section className={`${surface} p-5 sm:p-6`}><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Private draft queue</p><h2 className="mt-2 text-2xl font-medium">Campaign review</h2></div><span className="text-sm font-bold">{campaigns.length}</span></div><div className="mt-5 space-y-5">{campaigns.filter((item) => item.status !== "archived").map((campaign) => <article key={campaign.id} className="border-t border-[#191714]/10 pt-5 first:border-0 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{campaign.name}</p><p className="mt-1 text-xs text-[#81796f]">Sender: {campaign.sender_identity} &lt;{campaign.sender_address}&gt; · recipients: 0</p></div><Status value={campaign.status} /></div><div className="mt-3 bg-[#f5f0e7] p-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#756e64]">AI assistance disclosure</p><p className="mt-1 text-sm leading-6">{campaign.ai_assistance_disclosure}</p></div><p className="mt-3 text-sm"><strong>Audience:</strong> {campaign.audience_definition}</p><p className="mt-2 text-sm"><strong>Subject:</strong> {campaign.subject_template}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5f584f]">{campaign.message_template}</p><pre className="mt-3 whitespace-pre-wrap border-l-2 border-[#f05a3a] pl-3 text-xs leading-5 text-[#655f56]">{campaign.sender_signature}</pre><CampaignGate campaign={campaign} />{campaign.status === "draft" ? <button className={`${primary} mt-4`} onClick={() => void action({ action: "submit_campaign_review", campaignId: campaign.id }, "Campaign submitted for owner review. Launch remains disabled.")}>Submit draft for review</button> : null}{campaign.approval_id && approvals.some((approval) => approval.id === campaign.approval_id) ? <p className="mt-3 text-xs font-bold text-[#8a5d17]">Owner decision waiting in the Briefing approval queue.</p> : null}</article>)}{!campaigns.length ? <Empty title="No outreach drafts" copy="Adam does not run overnight outreach. Drafts appear here only after the owner defines the intended audience and message." /> : null}</div></section></div></div>;
}

function CampaignGate({ campaign }: { campaign: AdamCampaignDraft }) {
  const items = [["Sender authorization", campaign.sender_authorized], ["Audience approval", campaign.audience_approved], ["Message approval", campaign.template_approved], ["Compliance + opt-out", campaign.compliance_reviewed], ["Rate policy", campaign.rate_policy_approved]] as const;
  return <div className="mt-4 border border-[#191714]/10 p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold">Campaign launch gate</p><Status value={campaign.launch_enabled ? "healthy" : "blocked"} /></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{items.map(([label, ready]) => <p key={label} className="text-sm text-[#655f56]"><span aria-hidden="true">{ready ? "✓" : "—"}</span> {label}</p>)}</div><p className="mt-3 text-xs leading-5 text-[#81796f]">Launch is disabled in this release. Approval covers the draft/setup scope only and never sends a message.</p></div>;
}

function Connections({ snapshot, busy, action }: { snapshot: AdamSnapshot; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  return <div className="space-y-5"><section className={`${surface} grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center`}><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Integration control plane</p><h2 className="mt-2 text-2xl font-medium">Connection status, not implied capability</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">Configured means a server-side setting exists. Healthy is reserved for paths verified by this application. Tokens and secret values never appear here or in Adam memory.</p></div><button disabled={busy === "refresh_integrations"} className={primary} onClick={() => void action({ action: "refresh_integrations" }, "Integration configuration status refreshed.")}>Refresh status</button></section><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{snapshot.integrations.map((item) => <article key={item.key} className={`${surface} p-5`}><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{item.label}</h3><Status value={item.status} /></div><p className="mt-3 text-sm leading-6 text-[#655f56]">{item.detail}</p><div className="mt-4 border-t border-[#191714]/10 pt-3"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#81796f]">Allowed context</p><p className="mt-1 text-sm">{item.capabilities.join(" · ") || "Status only"}</p></div><p className="mt-3 text-xs text-[#81796f]">Last recorded check: {when(item.lastCheckedAt)}</p></article>)}</div><section className={`${surface} p-5 sm:p-6`}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Runtime controls</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Control label="Owner-only" ready={snapshot.controls.ownerOnly} /><Control label="Approval first" ready={snapshot.controls.approvalFirst} /><Control label="External actions" ready={snapshot.controls.externalActionsEnabled} inverted /><Control label="Unapproved background actions" ready={snapshot.controls.backgroundExecutionEnabled} inverted /></div><p className="mt-4 text-sm leading-6 text-[#655f56]">AI drafting is {snapshot.controls.aiDraftingEnabled ? "enabled within the recorded budget and telemetry guardrails" : "disabled until the complete provider, moderation, telemetry, model, health, and budget gate passes"}.</p></section></div>;
}

function Control({ label, ready, inverted = false }: { label: string; ready: boolean; inverted?: boolean }) {
  const safe = inverted ? !ready : ready;
  return <div className="border border-[#191714]/10 bg-[#f5f0e7] p-4"><p className="text-sm font-bold">{label}</p><p className={`mt-1 text-xs font-bold uppercase tracking-[.1em] ${safe ? "text-[#276548]" : "text-[#9a2f20]"}`}>{inverted ? (ready ? "enabled" : "off by policy") : (ready ? "enforced" : "not ready")}</p></div>;
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return <div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#81796f]">{title}</p><ul className="mt-2 space-y-2 text-sm leading-6">{items.map((item, index) => <li key={`${title}-${index}`} className="border-l-2 border-[#f05a3a] pl-3">{item}</li>)}</ul></div>;
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return <div className="border border-dashed border-[#191714]/18 bg-[#f8f4ec] p-5"><p className="font-bold">{title}</p><p className="mt-1 text-sm leading-6 text-[#756e64]">{copy}</p></div>;
}
