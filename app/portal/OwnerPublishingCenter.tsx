"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";
import type { PortalAccount, PortalAsset, PortalContentItem, PortalPostingTask } from "@/lib/portal/types";

type PublishingData = {
  jobs: Array<{
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
  }>;
  connections: Array<{
    id: string;
    account_id: string | null;
    owner_scope: boolean;
    status: string;
    action_policy: string;
    page_name: string;
    instagram_username: string | null;
    kill_switch: boolean;
    e2e_verified_at: string | null;
  }>;
  revisions: Array<{ source_type: string; source_id: string; action: string; version: number; created_at: string }>;
};

type LedgerItem = {
  key: string;
  kind: "meta" | "client";
  id: string;
  workspace: string;
  accountId: string | null;
  title: string;
  platform: string;
  format: string;
  policy: string;
  status: string;
  caption: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  providerId: string | null;
  providerLink: string | null;
  topic: string;
  approver: string;
  lastError: string | null;
  source: string;
  versionCount: number;
};

const surface = "rounded-[22px] border border-[#191714]/10 bg-[#fffdf8] shadow-[0_16px_45px_rgba(25,23,20,.07)]";
const field = "min-h-12 w-full rounded-xl border border-[#191714]/14 bg-white px-3.5 text-sm text-[#191714] outline-none focus:border-[#f05a3a]";
const primary = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-4 text-sm font-bold text-[#191714] transition hover:bg-[#e34d2f] disabled:cursor-not-allowed disabled:opacity-45";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#191714]/14 bg-white px-3.5 text-sm font-bold text-[#191714] transition hover:border-[#f05a3a]/45 hover:bg-[#f05a3a]/[.06] disabled:opacity-45";

function human(value: string) {
  return value.replaceAll("_", " ");
}

function date(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function Status({ value }: { value: string }) {
  const confirmed = ["published", "manual_posted", "completed"].includes(value);
  const blocked = ["failed", "canceled"].includes(value);
  const label = value === "draft" ? "verifying" : value;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${confirmed ? "bg-[#dff3e8] text-[#205b3b]" : blocked ? "bg-[#f7dfd9] text-[#8f301f]" : "bg-[#fff0c7] text-[#694616]"}`}>{human(label)}</span>;
}

export default function OwnerPublishingCenter({
  accounts,
  assets,
  content,
  postingTasks,
  onPortalAction,
  onRefresh,
}: {
  accounts: PortalAccount[];
  assets: PortalAsset[];
  content: PortalContentItem[];
  postingTasks: PortalPostingTask[];
  onPortalAction: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
  onRefresh: () => Promise<void>;
}) {
  const [data, setData] = useState<PublishingData | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scope, setScope] = useState("wovo");
  const [destination, setDestination] = useState("facebook_page");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showComposer, setShowComposer] = useState(true);
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({});

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your owner session expired. Sign in again.");
    return fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);

  const load = useCallback(async () => {
    const response = await request("/api/portal/publishing");
    const payload = await response.json() as PublishingData & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Publishing ledger could not load.");
    setData(payload);
  }, [request]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Publishing ledger could not load.")); }, [load]);

  const selectedAccountId = scope === "wovo" ? null : scope;
  const selectedAssets = assets.filter((asset) => asset.account_id === selectedAccountId && asset.rights_confirmed && !asset.archived_at);
  const ownerConnection = data?.connections.find((connection) => connection.owner_scope) ?? null;

  const ledger = useMemo<LedgerItem[]>(() => {
    const meta = (data?.jobs ?? []).map((job): LedgerItem => {
      const account = job.account_id ? accounts.find((candidate) => candidate.id === job.account_id) : null;
      const connection = data?.connections.find((candidate) => candidate.id === job.connection_id);
      return {
        key: `meta-${job.id}`,
        kind: "meta",
        id: job.id,
        workspace: job.owner_scope ? "WOVO Media" : account?.business_name ?? "Client workspace",
        accountId: job.account_id,
        title: job.title || job.topic || "Social post",
        platform: job.destination === "facebook_page" ? "Facebook" : "Instagram",
        format: human(job.content_format),
        policy: connection ? human(connection.action_policy) : "local draft only",
        status: job.status,
        caption: job.caption,
        scheduledFor: job.scheduled_for,
        publishedAt: job.published_at,
        providerId: job.provider_post_id,
        providerLink: null,
        topic: job.topic || "Not labeled",
        approver: job.approved_by ? "Owner-approved" : "Not approved",
        lastError: job.last_error_summary,
        source: human(job.source),
        versionCount: data?.revisions.filter((revision) => revision.source_type === "meta_job" && revision.source_id === job.id).length ?? 0,
      };
    });
    const client = content.map((item): LedgerItem => {
      const account = accounts.find((candidate) => candidate.id === item.account_id);
      const task = postingTasks.find((candidate) => candidate.content_item_id === item.id);
      return {
        key: `client-${item.id}`,
        kind: "client",
        id: item.id,
        workspace: account?.business_name ?? "Client workspace",
        accountId: item.account_id,
        title: item.title,
        platform: human(item.platform),
        format: human(item.content_type),
        policy: task ? "manual WOVO queue" : "approval required",
        status: item.status,
        caption: item.caption,
        scheduledFor: item.scheduled_for,
        publishedAt: item.posted_at,
        providerId: null,
        providerLink: null,
        topic: item.series_key || human(item.content_type),
        approver: item.approved_snapshot_id ? `Approved v${item.approval_version}` : "Not approved",
        lastError: null,
        source: item.ai_generated ? "Adam draft" : "manual",
        versionCount: item.approval_version,
      };
    });
    return [...meta, ...client].sort((a, b) => Date.parse(b.publishedAt || b.scheduledFor || "1970-01-01") - Date.parse(a.publishedAt || a.scheduledFor || "1970-01-01"));
  }, [accounts, content, data, postingTasks]);

  const filtered = ledger.filter((item) => {
    const text = `${item.workspace} ${item.title} ${item.platform} ${item.topic} ${item.status}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (statusFilter === "all" || item.status === statusFilter);
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy("create"); setError(""); setMessage("");
    const values = new FormData(form);
    try {
      const response = await request("/api/portal/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_owner_item",
          scope: selectedAccountId ? "client" : "wovo",
          accountId: selectedAccountId,
          title: values.get("title"),
          topic: values.get("topic"),
          caption,
          hashtags: tags,
          destination,
          scheduledFor: null,
          timezone: values.get("timezone"),
          presetAsset: selectedAccountId ? null : values.get("presetAsset"),
          assetId: selectedAccountId ? values.get("assetId") : null,
          rightsConfirmed: values.get("rightsConfirmed") === "on",
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The draft could not be saved.");
      setMessage("Draft saved with an audit record. It is not published.");
      setCaption(""); setTags("");
      form.reset();
      await Promise.all([load(), onRefresh()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The draft could not be saved.");
    } finally { setBusy(""); }
  }

  async function metaAction(itemId: string, action: "approve_meta_item" | "schedule_meta_item" | "cancel_meta_item" | "publish_meta_item", scheduledFor?: string) {
    setBusy(`${action}:${itemId}`); setError(""); setMessage("");
    try {
      const response = await request("/api/portal/publishing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, itemId, scheduledFor }) });
      const result = await response.json() as { error?: string; providerPostId?: string };
      if (!response.ok) throw new Error(result.error || "The publishing action failed.");
      setMessage(result.providerPostId ? "Meta confirmed the post. The provider ID is now in the ledger." : action === "approve_meta_item" ? "Verified and approved. Choose its publish time next." : action === "schedule_meta_item" ? "Scheduled. WOVO automation will deliver it at that time and record Meta proof." : "The item was canceled and retained in history.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The publishing action failed."); }
    finally { setBusy(""); }
  }

  return <div className="space-y-5">
    <section className={`${surface} overflow-hidden`}>
      <div className="grid gap-0 lg:grid-cols-[.82fr_1.18fr]">
        <div className="bg-[#191714] p-5 text-white sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff8c70]">Owner composer</p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-.035em]">One clear path from idea to proof.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/65">Create an exact draft, verify and approve it, then choose its publish time. WOVO records every step and never calls it published until Meta confirms.</p>
          <button type="button" className="mt-6 min-h-11 rounded-xl bg-[#fffdf8] px-4 text-sm font-bold text-[#191714] lg:hidden" onClick={() => setShowComposer((value) => !value)}>{showComposer ? "Hide composer" : "Open composer"}</button>
          <div className="mt-7 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl border border-white/10 bg-white/[.06] p-3"><strong className="block text-white">1 · Verifying</strong><span className="mt-1 block text-white/60">Review the exact caption and media</span></div>
            <div className="rounded-xl border border-white/10 bg-white/[.06] p-3"><strong className="block text-white">2 · Schedule</strong><span className="mt-1 block text-white/60">Owner chooses the delivery time</span></div>
            <div className="rounded-xl border border-white/10 bg-white/[.06] p-3"><strong className="block text-white">3 · Publish</strong><span className="mt-1 block text-white/60">{ownerConnection?.status === "healthy" ? `${ownerConnection.page_name} connected` : "Requires a healthy Meta connection"}</span></div>
          </div>
        </div>
        {showComposer ? <form className="p-5 sm:p-7" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Workspace<select className={`${field} mt-1`} value={scope} onChange={(event) => setScope(event.target.value)}><option value="wovo">WOVO Media</option>{accounts.filter((account) => !account.archived_at).map((account) => <option key={account.id} value={account.id}>{account.business_name}</option>)}</select></label>
            <label className="text-sm font-bold">Platform<select className={`${field} mt-1`} value={destination} onChange={(event) => setDestination(event.target.value)}><option value="facebook_page">Facebook</option><option value="instagram">Instagram</option></select></label>
            <label className="text-sm font-bold">Working title<input required maxLength={160} name="title" className={`${field} mt-1`} placeholder="August service spotlight" /></label>
            <label className="text-sm font-bold">Content topic<input maxLength={180} name="topic" className={`${field} mt-1`} placeholder="Customer education" /></label>
          </div>
          <label className="mt-4 block text-sm font-bold">Caption<textarea required maxLength={5000} className={`${field} mt-1 min-h-32 py-3`} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write the exact caption the audience will see." /></label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Relevant hashtags<input maxLength={500} className={`${field} mt-1`} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="wovomedia localmarketing" /></label>
            <label className="text-sm font-bold">Timezone<select name="timezone" className={`${field} mt-1`} defaultValue="America/Chicago"><option value="America/Chicago">Central time</option><option value="America/New_York">Eastern time</option><option value="America/Denver">Mountain time</option><option value="America/Los_Angeles">Pacific time</option></select></label>
            {selectedAccountId ? <label className="text-sm font-bold">Approved client media<select name="assetId" className={`${field} mt-1`} defaultValue=""><option value="">Caption-only draft</option>{selectedAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.file_name}</option>)}</select></label> : <label className="text-sm font-bold">WOVO-owned media<select name="presetAsset" className={`${field} mt-1`} defaultValue={destination === "instagram" ? "cover" : ""}><option value="">Caption only (Facebook)</option><option value="cover">WOVO social cover</option><option value="editorial">WOVO editorial background</option></select></label>}
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-3 text-sm"><input required type="checkbox" name="rightsConfirmed" className="mt-1 size-4" /><span><strong>I confirm WOVO or this client owns or may use the selected media.</strong><span className="mt-1 block text-xs leading-5 text-[#655f56]">Any recognizable person must also have consented. Saving creates a private draft only.</span></span></label>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={busy === "create"} className={primary}>{busy === "create" ? "Saving…" : "Send to verification"}</button><span className="text-xs text-[#756e64]">Scheduling appears only after owner approval.</span></div>
        </form> : null}
      </div>
    </section>

    {error ? <p role="alert" className="rounded-xl border border-[#a9341f]/20 bg-[#fff1ec] p-3 text-sm font-semibold text-[#8f301f]">{error}</p> : null}
    {message ? <p role="status" className="rounded-xl border border-[#f05a3a]/20 bg-[#fff1ec] p-3 text-sm font-semibold text-[#7d2d1f]">{message}</p> : null}

    <section className={`${surface} p-5 sm:p-6`}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Source of truth</p><h2 className="mt-2 text-2xl font-medium">Publishing ledger</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">Adam, manual, scheduled, client, provider-confirmed, and failed items in one searchable history.</p></div>
        <div className="grid gap-2 sm:grid-cols-2"><input aria-label="Search publishing ledger" className={field} placeholder="Search workspace, title, topic" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter publishing status" className={field} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="approved">Approved</option><option value="queued">Queued</option><option value="published">Published</option><option value="failed">Failed</option><option value="manual_posted">Manually posted</option><option value="canceled">Canceled</option></select></div>
      </div>
      <div className="mt-5 space-y-3">
        {filtered.map((item) => <article key={item.key} className="rounded-2xl border border-[#191714]/10 bg-white p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Status value={item.status} /><span className="text-xs font-bold uppercase tracking-[.1em] text-[#756e64]">{item.workspace} · {item.platform} · {item.format}</span></div><h3 className="mt-2 text-lg font-bold">{item.title}</h3><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#655f56]">{item.caption}</p></div>
            <div className="shrink-0 text-left text-xs leading-5 text-[#756e64] md:text-right"><p>{date(item.scheduledFor)}</p><p>{item.approver}</p><p>{item.source} · {item.versionCount} audit event{item.versionCount === 1 ? "" : "s"}</p></div>
          </div>
          <div className="mt-4 grid gap-2 rounded-xl bg-[#f7f2e9] p-3 text-xs leading-5 text-[#655f56] sm:grid-cols-2 lg:grid-cols-4"><p><strong className="block text-[#191714]">Policy</strong>{item.policy}</p><p><strong className="block text-[#191714]">Topic</strong>{item.topic}</p><p><strong className="block text-[#191714]">Provider proof</strong>{item.providerId || "None yet"}</p><p><strong className="block text-[#191714]">Result</strong>{item.publishedAt ? `Confirmed ${date(item.publishedAt)}` : item.lastError || "Awaiting action"}</p></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.kind === "meta" && item.status === "draft" ? <button className={primary} disabled={busy.endsWith(item.id)} onClick={() => void metaAction(item.id, "approve_meta_item")}>Verify &amp; approve</button> : null}
            {item.kind === "meta" && item.status === "approved" ? <div className="flex w-full flex-col gap-2 rounded-xl border border-[#f05a3a]/20 bg-[#f05a3a]/[.06] p-3 sm:w-auto sm:flex-row"><label className="text-xs font-bold text-[#655f56]">Publish time<input aria-label={`Schedule ${item.title}`} type="datetime-local" className={`${field} mt-1 sm:w-60`} value={scheduleTimes[item.id] ?? ""} onChange={(event) => setScheduleTimes((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button className={`${primary} self-end`} disabled={busy.endsWith(item.id) || !scheduleTimes[item.id]} onClick={() => void metaAction(item.id, "schedule_meta_item", scheduleTimes[item.id])}>Schedule post</button></div> : null}
            {item.kind === "meta" && !["published", "publishing", "canceled"].includes(item.status) ? <button className={secondary} disabled={busy.endsWith(item.id)} onClick={() => void metaAction(item.id, "cancel_meta_item")}>Cancel</button> : null}
            {item.kind === "client" && item.status === "draft" && item.accountId ? <button className={primary} onClick={() => void onPortalAction({ action: "update_content", accountId: item.accountId, contentId: item.id, status: "approved" }, `${item.title} approved with an immutable snapshot.`)}>Approve for client queue</button> : null}
            {item.kind === "client" && ["approved", "queued"].includes(item.status) && item.accountId ? <button className={primary} onClick={() => void onPortalAction({ action: "update_content", accountId: item.accountId, contentId: item.id, status: "manual_posted" }, `${item.title} marked manually posted.`)}>Confirm manually posted</button> : null}
            {item.providerLink ? <a className={secondary} href={item.providerLink} target="_blank" rel="noreferrer">Open provider record</a> : null}
          </div>
        </article>)}
        {!filtered.length ? <div className="rounded-2xl border border-dashed border-[#191714]/18 p-8 text-center"><h3 className="font-bold">No ledger items match</h3><p className="mt-2 text-sm text-[#655f56]">Create a draft or clear the filters. Nothing is labeled published without proof.</p></div> : null}
      </div>
    </section>
  </div>;
}
