"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";

type OperatorSnapshot = {
  operator: null | { id: string; display_name: string; business_role: string; business_context: string; permitted_scopes: string[]; status: string; kill_switch: boolean; monthly_credit_allowance: number };
  creativeProfile: null | Record<string, unknown>;
  jobs: Array<{ id: string; capability: string; status: string; prompt: string; estimated_credits: number; result_text?: string | null; error_summary?: string | null; created_at: string }>;
  entitlement: null | { status: string; current_period_end?: string | null; cancel_at_period_end?: boolean };
  hasAccess: boolean;
  billingOptions: Array<{ frequency: string; label: string; amountCents: number; effectiveMonthlyCents: number; savingsCents: number; renewalLabel: string }>;
  capabilities: { text: boolean; image: boolean; video: boolean; websitePublish: boolean };
  scheduleRequests: Array<{ id: string; purpose: string; status: string; preferred_windows: string[]; external_action_taken: boolean; created_at: string }>;
  integrations: { cloudflare: { provider: string; status: string; kill_switch: boolean }; calendly: { provider: string; status: string; kill_switch: boolean } };
  credits: {
    balance: number;
    ledger: Array<{ id: string; delta: number; balance_after: number; entry_type: string; description: string; created_at: string }>;
    allowance: null | { monthly_included_units: number; weekly_unit_limit: number; period_end: string };
    usage: Array<{ id: string; status: string; estimated_units: number; actual_units?: number | null; included_units_reserved: number; credit_units_reserved: number; reserved_at: string }>;
    topupAvailable: false;
    rolloverRule: string;
  };
};

const surface = "rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 shadow-[0_18px_55px_rgba(25,23,20,.07)]";
const field = "min-h-12 w-full rounded-xl border border-[#191714]/14 bg-white px-3.5 text-sm outline-none focus:border-[#f05a3a] focus:ring-2 focus:ring-[#f05a3a]/15";
const area = `${field} min-h-28 py-3`;
const primary = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-4 text-sm font-bold text-[#191714] hover:bg-[#df4c30] disabled:cursor-not-allowed disabled:opacity-45";

function money(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100); }
function date(value?: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Not set"; }
function human(value: string) { return value.replaceAll("_", " "); }

export default function AiOperator({ accountId }: { accountId: string }) {
  const [data, setData] = useState<OperatorSnapshot | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    return fetch(`/api/portal/operator${init?.method ? "" : `?accountId=${encodeURIComponent(accountId)}`}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` }, cache: "no-store" });
  }, [accountId]);

  const load = useCallback(async () => {
    const response = await request();
    const payload = await response.json() as OperatorSnapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "AI Operator could not load.");
    setData(payload);
  }, [request]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "AI Operator could not load.")); }, [load]);

  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(String(payload.action ?? "action")); setError(""); setNotice("");
    try {
      const response = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, accountId }) });
      const result = await response.json() as { error?: string; url?: string };
      if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
      if (result.url) { window.location.href = result.url; return true; }
      setNotice(success); await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The request could not be completed."); return false; }
    finally { setBusy(""); }
  }

  const monthUsed = useMemo(() => data?.credits.usage.filter((row) => ["reserved", "completed"].includes(row.status)).reduce((sum, row) => sum + (row.actual_units ?? row.estimated_units), 0) ?? 0, [data]);

  if (!data) return <section className={surface}><p className="text-sm text-[#655f56]">{error || "Loading your AI Operator…"}</p></section>;

  return <div className="space-y-5">
    <section className={`${surface} overflow-hidden p-0`}>
      <div className="grid gap-0 lg:grid-cols-[1.25fr_.75fr]">
        <div className="p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">Your AI Operator</p><h2 className="mt-2 text-3xl font-medium tracking-[-.035em]">A named AI assistant with a bounded job.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[#655f56]">Configure its role, approved knowledge, creative identity, and permitted drafts. It is software—not a human employee—and cannot send, publish, purchase, book, call, or change an account without a verified integration and a separately approved action policy.</p></div>
        <div className="bg-[#191714] p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ff8c70]">Current boundary</p><p className="mt-3 text-xl font-medium">Drafts and plans only</p><p className="mt-2 text-sm leading-6 text-white/65">Every request is confirmed, metered, tenant-scoped, and recorded. External actions remain off.</p></div>
      </div>
    </section>
    {notice ? <p role="status" className="rounded-xl border border-[#f05a3a]/25 bg-[#f05a3a]/10 p-4 text-sm text-[#7d2d1f]">{notice}</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-[#b42318]/25 bg-[#fff1ed] p-4 text-sm text-[#8f2118]">{error}</p> : null}

    {!data.hasAccess ? <OperatorPricing options={data.billingOptions} busy={busy} onSelect={(frequency) => void action({ action: "start_checkout", frequency }, "Opening secure Stripe checkout.")} /> : null}

    <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <section className={surface}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Operator setup</p><h3 className="mt-2 text-2xl font-medium">Name the role. Limit the scope.</h3><form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void action({ action: "save_operator", displayName: values.get("displayName"), businessRole: values.get("businessRole"), businessContext: values.get("businessContext"), permittedScopes: values.getAll("scopes"), paused: values.get("paused") === "on" }, "Operator setup saved. External actions remain disabled."); }}>
        <label className="block text-sm font-bold">Operator name<input name="displayName" required minLength={2} maxLength={80} defaultValue={data.operator?.display_name ?? "My WOVO Operator"} className={`${field} mt-1`} /></label>
        <label className="block text-sm font-bold">Business role<input name="businessRole" required minLength={3} maxLength={180} defaultValue={data.operator?.business_role ?? "Creative and marketing operations assistant"} className={`${field} mt-1`} /></label>
        <label className="block text-sm font-bold">Approved business context<textarea name="businessContext" maxLength={6000} defaultValue={data.operator?.business_context ?? ""} className={`${area} mt-1`} placeholder="What should this operator know about your goals and boundaries? Never paste secrets." /></label>
        <fieldset><legend className="text-sm font-bold">Permitted draft work</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{[["content_drafts","Content drafts"],["campaign_planning","Campaign plans"],["website_concepts","Website concepts"],["support_drafts","Support drafts"],["scheduling_requests","Scheduling requests"]].map(([value,label]) => <label key={value} className="flex min-h-12 items-center gap-2 rounded-xl border border-[#191714]/10 px-3 text-sm"><input type="checkbox" name="scopes" value={value} defaultChecked={data.operator?.permitted_scopes.includes(value) ?? value === "content_drafts"} />{label}</label>)}</div></fieldset>
        <label className="flex min-h-12 items-start gap-3 rounded-xl border border-[#191714]/10 p-3 text-sm"><input type="checkbox" name="paused" defaultChecked={data.operator?.kill_switch ?? false} className="mt-1" /><span><strong>Pause all new work.</strong><span className="mt-1 block text-[#655f56]">A workspace kill switch; saved drafts remain available.</span></span></label>
        <button disabled={busy === "save_operator"} className={`${primary} w-full`}>Save operator</button>
      </form></section>

      <section className={surface}><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Credits and allowance</p><h3 className="mt-2 text-2xl font-medium">Measured use, never unlimited</h3></div><p className="text-3xl font-medium">{data.credits.balance}<span className="ml-1 text-sm text-[#756e64]">top-up credits</span></p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="Included this month" value={String(data.credits.allowance?.monthly_included_units ?? 0)} /><Stat label="Used or reserved" value={String(monthUsed)} /><Stat label="Next reset" value={date(data.credits.allowance?.period_end)} /></div>
        <p className="mt-4 text-xs leading-5 text-[#756e64]">Quarterly and annual billing receive the same monthly allowance—not a quarter or year upfront. Weekly and per-job ceilings protect costly media use. {data.credits.rolloverRule}</p>
        {!data.credits.topupAvailable ? <p className="mt-4 rounded-xl border border-[#191714]/10 bg-[#f5f0e7] p-3 text-sm text-[#655f56]">Credit top-ups are unavailable until their Stripe prices and webhook grants pass verification. Your included monthly allowance still applies when the operator entitlement is active.</p> : null}
        <details className="mt-4 border-t border-[#191714]/10 pt-4"><summary className="cursor-pointer text-sm font-bold">Ledger and purchase history</summary><div className="mt-3 space-y-2">{data.credits.ledger.map((entry) => <div key={entry.id} className="flex justify-between gap-3 text-xs"><span>{entry.description}<span className="ml-2 text-[#81796f]">{date(entry.created_at)}</span></span><strong className={entry.delta < 0 ? "text-[#9a2f20]" : "text-[#276548]"}>{entry.delta > 0 ? "+" : ""}{entry.delta} · {entry.balance_after}</strong></div>)}{!data.credits.ledger.length ? <p className="text-xs text-[#756e64]">No paid top-ups or credit adjustments have been recorded.</p> : null}</div></details>
      </section>
    </div>

    {data.hasAccess && data.operator && data.capabilities.text ? <CreationDesk data={data} busy={busy} action={action} /> : null}
    <CreativeProfile data={data} busy={busy} action={action} />
    <Connections data={data} />
    <ScheduleDesk requests={data.scheduleRequests} busy={busy} action={action} />
  </div>;
}

function Connections({ data }: { data: OperatorSnapshot }) {
  const connected = [data.integrations.calendly].filter((item) => item.status === "healthy" || item.status === "configured");
  // Action-or-hide release gate: do not expose provider setup theater until a
  // workspace has a real, revocable server-side connection.
  if (!connected.length) return null;
  return <section className={surface}><details><summary className="cursor-pointer"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Connections</span><span className="mt-2 block text-2xl font-medium">Client-controlled access, provider by provider</span><span className="mt-2 block text-sm text-[#655f56]">WOVO never asks for or stores an account password. A supported connection must use official authorization, server-only encrypted tokens, narrow scopes, rotation/revocation, and a workspace-selected action policy.</span></summary><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-[#191714]/10 bg-white p-4"><p className="font-bold">Connected tools</p>{connected.length ? connected.map((item) => <p key={item.provider} className="mt-2 text-sm capitalize">{human(item.provider)} · {human(item.status)}</p>) : <p className="mt-2 text-sm leading-6 text-[#655f56]">No client provider is exposed as connected. Calendly remains authorization-required; the scheduling form below creates a WOVO review request only.</p>}</div><div className="rounded-xl border border-[#191714]/10 bg-[#f5f0e7] p-4"><p className="font-bold">What Adam can use</p><p className="mt-2 text-sm leading-6 text-[#655f56]">Only data within the exact workspace and scopes you approve. Read context, draft, schedule, and publish/action are separate permission levels. Publish/action stays unavailable until provider support, consent, app review, and the selected policy all pass.</p></div></div><p className="mt-4 text-xs leading-5 text-[#756e64]">When a connection is actually supported, this area will show granted scopes, data used, expiration, last sync/action, reconnect, revoke, and its audit history. Unsupported arbitrary apps are not offered and WOVO does not scrape them.</p></details></section>;
}

function OperatorPricing({ options, busy, onSelect }: { options: OperatorSnapshot["billingOptions"]; busy: string; onSelect: (frequency: string) => void }) {
  if (!options.length) return <section className={surface}><p className="font-bold">AI Operator billing is not available yet.</p><p className="mt-2 text-sm leading-6 text-[#655f56]">Setup can be saved, but purchase remains hidden until every server-allowlisted Stripe price passes amount, currency, interval, webhook, and cancellation verification.</p></section>;
  return <section className={surface}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Activate Your AI Operator</p><h3 className="mt-2 text-2xl font-medium">Choose the billing rhythm</h3><p className="mt-2 text-sm text-[#655f56]">No option is preselected. Total due today, renewal terms, and effective monthly cost are shown before Stripe Checkout.</p><div className="mt-5 grid gap-3 md:grid-cols-3">{options.map((option) => <article key={option.frequency} className="rounded-xl border border-[#191714]/10 bg-white p-4"><p className="text-sm font-bold">{option.label}</p><p className="mt-2 text-2xl font-medium">{money(option.amountCents)}</p><p className="mt-1 text-xs text-[#655f56]">{money(option.effectiveMonthlyCents)}/month equivalent</p>{option.savingsCents ? <p className="mt-2 text-xs font-bold text-[#a9341f]">Save {money(option.savingsCents)} vs monthly</p> : null}<button disabled={busy === "start_checkout"} className={`${primary} mt-4 w-full`} onClick={() => onSelect(option.frequency)}>Continue with {option.label}</button><p className="mt-3 text-[11px] leading-5 text-[#756e64]">Due today: {money(option.amountCents)}. Renews as {option.renewalLabel.toLowerCase()} until canceled. Cancellation takes effect at the end of the paid period.</p></article>)}</div></section>;
}

function CreationDesk({ data, busy, action }: { data: OperatorSnapshot; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  return <section className={surface}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Request → estimate → confirm</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-2xl font-medium">Creation desk</h3><p className="mt-2 text-sm text-[#655f56]">Text drafts use approved workspace context. Images and video are not shown until provider access, storage, consent, and cost checks are verified.</p></div></div>
    <form className="mt-5 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void action({ action: "create_job", capability: values.get("capability"), prompt: values.get("prompt"), sourceRightsConfirmed: values.get("rights") === "on", idempotencyKey: `operator:${crypto.randomUUID()}` }, "Estimate prepared. Confirm the job below before generation.").then((ok) => { if (ok) form.reset(); }); }}>
      <label className="text-sm font-bold">Create<select name="capability" className={`${field} mt-1`}><option value="caption_variants">Caption variants · 4 credits</option><option value="content_calendar">Content calendar · 8 credits</option><option value="website_concept">Website concept · 10 credits</option><option value="website_page">Website page draft · 12 credits</option><option value="listing_storyboard">Listing ad storyboard · 10 credits</option><option value="character_bible">Character bible · 10 credits</option><option value="episode_outline">Episode outline · 8 credits</option></select></label>
      <div><label className="text-sm font-bold">Brief<textarea name="prompt" required minLength={3} maxLength={8000} className={`${field} mt-1 min-h-24 py-3`} placeholder="Describe the goal, audience, facts, constraints, and desired format." /></label><label className="mt-2 flex items-start gap-2 text-xs text-[#655f56]"><input type="checkbox" name="rights" required className="mt-0.5" />I own or have permission to use every supplied source and asset.</label></div><button disabled={busy === "create_job"} className={primary}>Get estimate</button>
    </form>
    <div className="mt-6 space-y-4">{data.jobs.map((job) => <article key={job.id} className="rounded-xl border border-[#191714]/10 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold capitalize">{human(job.capability)}</p><p className="mt-1 line-clamp-2 text-sm text-[#655f56]">{job.prompt}</p></div><span className="text-xs font-bold uppercase tracking-[.1em] text-[#a9341f]">{human(job.status)}</span></div><p className="mt-3 text-xs text-[#756e64]">Estimate: {job.estimated_credits} credits · no external action</p>{job.status === "awaiting_confirmation" || job.status === "running" ? <button disabled={busy === "confirm_run_job"} className={`${primary} mt-3`} onClick={() => void action({ action: "confirm_run_job", jobId: job.id, confirmed: true }, "Draft completed and recorded.")}>{job.status === "running" ? "Resume safely" : `Confirm ${job.estimated_credits}-credit request`}</button> : null}{job.result_text ? <div className="mt-4 whitespace-pre-wrap rounded-xl bg-[#f5f0e7] p-4 text-sm leading-7 text-[#4f4942]">{job.result_text}<p className="mt-3 border-t border-[#191714]/10 pt-2 text-xs text-[#81796f]">Draft only · review required · nothing sent or published</p></div> : null}{job.error_summary ? <p className="mt-3 text-sm text-[#8f2118]">{job.error_summary}</p> : null}</article>)}{!data.jobs.length ? <p className="rounded-xl border border-dashed border-[#191714]/15 p-7 text-center text-sm text-[#756e64]">No creation jobs yet. Start with one clear request.</p> : null}</div>
  </section>;
}

function CreativeProfile({ data, busy, action }: { data: OperatorSnapshot; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const profile = data.creativeProfile ?? {};
  return <section className={surface}><details><summary className="cursor-pointer"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Creative identity</span><span className="mt-2 block text-2xl font-medium">Keep outputs distinct and source-safe</span><span className="mt-2 block text-sm text-[#655f56]">Save preferences, exclusions, variation, listing facts, or character-series boundaries. This opens only when you need it.</span></summary><form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void action({ action: "save_creative_profile", projectKind: values.get("projectKind"), stylePreferences: String(values.get("stylePreferences") ?? "").split(",").map((x) => x.trim()).filter(Boolean), exclusions: String(values.get("exclusions") ?? "").split(",").map((x) => x.trim()).filter(Boolean), variationLevel: Number(values.get("variationLevel")), listingReferenceUrl: values.get("listingReferenceUrl"), listingFacts: { approvedFacts: values.get("listingFacts") }, visualIdentity: { direction: values.get("visualIdentity") }, sourceRightsConfirmed: values.get("rights") === "on", identifiablePerson: values.get("identifiable") === "on", likenessConsentConfirmed: values.get("likeness") === "on", voiceConsentConfirmed: values.get("voice") === "on" }, "Creative profile and consent settings saved."); }}>
    <label className="text-sm font-bold">Project type<select name="projectKind" defaultValue={String(profile.project_kind ?? "business_campaign")} className={`${field} mt-1`}><option value="personal_creator">Personal creator</option><option value="business_campaign">Business campaign</option><option value="real_estate">Real-estate listing campaign</option><option value="character_series">Character or episode series</option></select></label>
    <label className="text-sm font-bold">Variation<select name="variationLevel" defaultValue={String(profile.variation_level ?? 2)} className={`${field} mt-1`}><option value="1">Consistent</option><option value="2">Balanced</option><option value="3">Exploratory</option><option value="4">Wide variation</option></select></label>
    <label className="text-sm font-bold">Visual direction<input name="visualIdentity" className={`${field} mt-1`} placeholder="Editorial, tactile, warm daylight" /></label><label className="text-sm font-bold">Style preferences<input name="stylePreferences" className={`${field} mt-1`} placeholder="Comma-separated" /></label>
    <label className="text-sm font-bold">Avoid<input name="exclusions" className={`${field} mt-1`} placeholder="Generic gradients, repeated slogans" /></label><label className="text-sm font-bold">Listing URL (reference only)<input type="url" name="listingReferenceUrl" defaultValue={String(profile.listing_reference_url ?? "")} className={`${field} mt-1`} /></label>
    <label className="text-sm font-bold lg:col-span-2">Approved listing facts and disclosures<textarea name="listingFacts" className={`${area} mt-1`} placeholder="Paste facts you are authorized to supply. WOVO does not scrape Zillow or infer property facts." /></label>
    <div className="space-y-2 lg:col-span-2"><label className="flex items-start gap-2 text-sm"><input type="checkbox" required name="rights" className="mt-1" />I own or have permission to use every supplied source, photo, character, and creative reference.</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="identifiable" className="mt-1" />This project includes a recognizable person.</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="likeness" className="mt-1" />Each recognizable person gave explicit likeness consent.</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="voice" className="mt-1" />Each recognizable voice owner gave explicit voice consent.</label></div><button disabled={busy === "save_creative_profile"} className={`${primary} lg:col-span-2 lg:w-fit`}>Save creative identity</button>
  </form></details></section>;
}

function ScheduleDesk({ requests, busy, action }: { requests: OperatorSnapshot["scheduleRequests"]; busy: string; action: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  return <section className={surface}><details><summary className="cursor-pointer"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Schedule with Adam</span><span className="mt-2 block text-2xl font-medium">Prepare a meeting request</span><span className="mt-2 block text-sm text-[#655f56]">Adam is WOVO Media&apos;s AI Operations Assistant. This form prepares a request for WOVO review; it does not book or message anyone.</span></summary><form className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void action({ action: "create_schedule_request", purpose: values.get("purpose"), preferredWindows: [values.get("window1"), values.get("window2")].filter(Boolean), attendeeCount: values.get("attendeeCount"), humanEscalationRequested: values.get("human") === "on" }, "Scheduling request saved for review. No event or message was created.").then((ok) => { if (ok) form.reset(); }); }}><label className="text-sm font-bold">Purpose<textarea required name="purpose" maxLength={2000} className={`${field} mt-1 min-h-24 py-3`} /></label><div className="space-y-2"><label className="block text-sm font-bold">Preferred window<input required type="datetime-local" name="window1" className={`${field} mt-1`} /></label><label className="block text-sm font-bold">Alternate<input type="datetime-local" name="window2" className={`${field} mt-1`} /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="human" />Request human escalation</label></div><button disabled={busy === "create_schedule_request"} className={primary}>Save request</button></form>{requests.length ? <div className="mt-5 space-y-2 border-t border-[#191714]/10 pt-4">{requests.map((item) => <p key={item.id} className="text-sm"><strong className="capitalize">{human(item.status)}</strong> · {item.purpose} <span className="text-[#756e64]">· no external action</span></p>)}</div> : null}</details></section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#191714]/10 bg-white p-3"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#756e64]">{label}</p><p className="mt-2 text-lg font-medium">{value}</p></div>; }
