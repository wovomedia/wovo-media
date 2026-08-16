"use client";

import { useEffect, useMemo, useState } from "react";
import WovoLogo from "@/components/ui/wovo-logo";
import AdamOperations from "@/app/portal/AdamOperations";
import type {
  PortalAccount,
  PortalPublicInquiry,
  PortalSnapshot,
} from "@/lib/portal/types";

type OwnerSection = "adam" | "operations" | "clients" | "inbox" | "content" | "services" | "billing" | "settings";

type OwnerAction = (payload: Record<string, unknown>, success: string) => Promise<unknown>;

const sections: Array<{ value: OwnerSection; label: string; short: string }> = [
  { value: "adam", label: "Adam Operations", short: "Adam" },
  { value: "operations", label: "Operations", short: "Overview" },
  { value: "clients", label: "Clients / Workspaces", short: "Clients" },
  { value: "inbox", label: "Team Inbox", short: "Inbox" },
  { value: "content", label: "Content Calendar / Queue", short: "Content" },
  { value: "services", label: "Bookings & Services", short: "Services" },
  { value: "billing", label: "Billing", short: "Billing" },
  { value: "settings", label: "Settings / Staff", short: "Settings" },
];

const surface = "rounded-[24px] border border-[#191714]/10 bg-[#fffdf8] shadow-[0_18px_55px_rgba(25,23,20,.08)]";
const field = "min-h-12 w-full rounded-xl border border-[#191714]/12 bg-white px-3.5 text-sm text-[#191714] outline-none transition focus:border-[#f05a3a]";
const primary = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-4 text-sm font-bold text-[#191714] transition hover:bg-[#e34d2f] disabled:cursor-not-allowed disabled:opacity-45";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-xl border border-[#191714]/14 bg-white px-4 text-sm font-bold text-[#191714] transition hover:border-[#f05a3a]/45 hover:bg-[#f05a3a]/[.06] disabled:opacity-45";
const danger = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#a9341f]/25 bg-[#fff7f3] px-3.5 text-sm font-bold text-[#8f301f] transition hover:bg-[#f05a3a]/10";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function human(value: string | null | undefined) {
  return value?.replaceAll("_", " ") ?? "Unassigned";
}

function Status({ value }: { value: string }) {
  const warm = ["new", "open", "pending", "requested", "client_review", "inactive"].includes(value);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
      warm ? "border-[#d79b3c]/35 bg-[#fff3cf] text-[#694616]" : "border-[#f05a3a]/25 bg-[#f05a3a]/10 text-[#8f301f]"
    }`}>
      {human(value)}
    </span>
  );
}

type ConfirmState = {
  action: "archive_owner_item" | "restore_owner_item";
  targetType: "workspace" | "content" | "asset" | "inquiry";
  targetId: string;
  targetLabel: string;
  warning: string;
};

function ConfirmationModal({
  state,
  busy,
  close,
  confirm,
}: {
  state: ConfirmState;
  busy: string;
  close: () => void;
  confirm: () => Promise<void>;
}) {
  const restoring = state.action === "restore_owner_item";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#191714]/55 p-3 backdrop-blur-sm sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="owner-confirm-title" className="w-full max-w-md rounded-[24px] bg-[#fffdf8] p-5 text-[#191714] shadow-2xl sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d94326]">{restoring ? "Restore record" : "Archive record"}</p>
        <h2 id="owner-confirm-title" className="mt-2 text-2xl font-semibold">{state.targetLabel}</h2>
        <p className="mt-3 text-sm leading-6 text-[#655f56]">{state.warning}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" className={secondary} onClick={close}>Cancel</button>
          <button type="button" disabled={busy === state.action} className={restoring ? primary : danger} onClick={() => void confirm()}>
            {busy === state.action ? "Saving…" : restoring ? "Restore" : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <article className={`${surface} p-5`}>
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">{label}</p>
      <p className="mt-3 text-4xl font-medium tracking-[-.04em]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#6b645b]">{detail}</p>
    </article>
  );
}

export default function OwnerOperations({
  snapshot,
  busy,
  error,
  notice,
  onAction,
  onInspectWorkspace,
  onSignOut,
}: {
  snapshot: PortalSnapshot;
  busy: string;
  error: string;
  notice: string;
  onAction: OwnerAction;
  onInspectWorkspace: (account: PortalAccount, tab?: "overview" | "queue" | "calendar" | "inbox" | "services") => void;
  onSignOut: () => Promise<void>;
}) {
  const [section, setSection] = useState<OwnerSection>("adam");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [renderedAt] = useState(() => Date.now());

  const activeAccounts = snapshot.accounts.filter((account) => !account.archived_at);
  const archivedAccounts = snapshot.accounts.filter((account) => account.archived_at);
  const activeContent = snapshot.content.filter((item) => !item.archived_at);
  const activeAssets = snapshot.assets.filter((item) => !item.archived_at);
  const activeInquiries = snapshot.publicInquiries.filter((item) => !item.archived_at);
  const activeGrants = snapshot.accessGrants.filter((grant) => !grant.revoked_at && Date.parse(grant.expires_at) > renderedAt);
  const openThreads = snapshot.threads.filter((thread) => !["resolved", "closed"].includes(thread.status));
  const pendingTasks = snapshot.postingTasks.filter((task) => ["pending", "in_progress"].includes(task.status));
  const pendingContent = activeContent.filter((item) => ["client_review", "approved", "queued", "revision_requested"].includes(item.status));
  const serviceRequests = snapshot.orders.filter((order) => !["completed", "canceled", "refunded"].includes(order.status));
  const upcomingEvents = snapshot.events.filter((event) => Date.parse(event.starts_at) >= renderedAt);
  const completedAiUsage = snapshot.aiUsageRequests.filter((request) => request.status === "completed");
  const aiUnitsUsed = completedAiUsage.reduce((sum, request) => sum + (request.actual_units ?? request.estimated_units), 0);
  const aiProviderCostMicros = completedAiUsage.reduce((sum, request) => sum + (request.actual_provider_cost_micros ?? request.estimated_provider_cost_micros), 0);
  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeAccounts;
    return activeAccounts.filter((account) =>
      [account.business_name, account.contact_email, account.business_type, account.location]
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [activeAccounts, search]);
  const filteredInquiries = useMemo(() => {
    const query = caseSearch.trim().toLowerCase();
    if (!query) return activeInquiries;
    return activeInquiries.filter((inquiry) =>
      [inquiry.case_reference, inquiry.name, inquiry.email, inquiry.subject]
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [activeInquiries, caseSearch]);
  const selectedInquiry = activeInquiries.find((inquiry) => inquiry.id === selectedInquiryId) ?? null;

  useEffect(() => {
    function openFromLocation() {
      const hash = decodeURIComponent(window.location.hash);
      if (!hash.startsWith("#case-")) return;
      const reference = hash.slice("#case-".length).toLowerCase();
      const match = snapshot.publicInquiries.find((inquiry) => !inquiry.archived_at && inquiry.case_reference.toLowerCase() === reference);
      if (!match) return;
      setSection("inbox");
      setSelectedInquiryId(match.id);
      setCaseSearch(match.case_reference);
    }
    const timer = window.setTimeout(openFromLocation, 0);
    window.addEventListener("hashchange", openFromLocation);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", openFromLocation);
    };
  }, [snapshot.publicInquiries]);

  function choose(next: OwnerSection) {
    setSection(next);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openInquiry(inquiry: PortalPublicInquiry) {
    setSection("inbox");
    setSelectedInquiryId(inquiry.id);
    setDrawerOpen(false);
    setCaseSearch(inquiry.case_reference);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#case-${encodeURIComponent(inquiry.case_reference)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runConfirmation() {
    if (!confirmState) return;
    await onAction({
      action: confirmState.action,
      targetType: confirmState.targetType,
      targetId: confirmState.targetId,
      confirmationLabel: confirmState.targetLabel,
    }, confirmState.action === "archive_owner_item" ? `${confirmState.targetLabel} archived. A restore path remains available.` : `${confirmState.targetLabel} restored.`);
    setConfirmState(null);
  }

  const nav = (
    <nav aria-label="Owner operations">
      {sections.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => choose(item.value)}
          className={`mb-1 flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-bold transition ${
            section === item.value ? "bg-[#f05a3a] text-[#191714]" : "text-[#5e574f] hover:bg-[#191714]/[.045] hover:text-[#191714]"
          }`}
        >
          <span>{item.label}</span>
          {item.value === "inbox" && activeInquiries.length + openThreads.length > 0 ? (
            <span className="rounded-full bg-[#191714] px-2 py-0.5 text-[10px] text-white">{activeInquiries.length + openThreads.length}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3efe6] text-[#191714]">
      <header className="sticky top-0 z-40 border-b border-[#191714]/10 bg-[#f3efe6]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <button type="button" className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[#191714]/12 lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open operations navigation">
            <span className="space-y-1.5" aria-hidden="true"><span className="block h-0.5 w-5 bg-[#191714]" /><span className="block h-0.5 w-5 bg-[#191714]" /><span className="block h-0.5 w-5 bg-[#191714]" /></span>
          </button>
          <WovoLogo variant="full" size={126} />
          <div className="hidden min-w-0 flex-1 border-l border-[#191714]/10 pl-3 md:block">
            <p className="truncate text-sm font-bold">WOVO Operations</p>
            <p className="truncate text-xs text-[#655f56]">President / owner · organization-wide view</p>
          </div>
          <button type="button" className={`${secondary} hidden sm:inline-flex`} onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 bg-[#191714]/45 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="h-full w-[min(88vw,340px)] overflow-y-auto bg-[#fffdf8] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <p className="font-bold">WOVO Operations</p>
              <button type="button" className="min-h-12 min-w-12 rounded-xl border border-[#191714]/12" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">×</button>
            </div>
            {nav}
            <button type="button" className={`${secondary} mt-6 w-full`} onClick={() => void onSignOut()}>Sign out</button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            {nav}
            <div className="mt-5 rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-4 text-xs leading-5 text-[#655f56]">
              <p className="font-bold text-[#191714]">Owner access</p>
              <p className="mt-1">Cross-client tools are owner-only. Client workspaces open only after an explicit selection.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">Focused view</p>
              <p className="mt-1 text-xl font-semibold">{sections.find((item) => item.value === section)?.label}</p>
            </div>
            <button type="button" className={secondary} onClick={() => setDrawerOpen(true)}>Sections</button>
          </div>
          {notice ? <div role="status" className="mb-4 rounded-2xl border border-[#f05a3a]/25 bg-[#f05a3a]/10 p-4 text-sm text-[#7d2d1f]">{notice}</div> : null}
          {error ? <div role="alert" className="mb-4 rounded-2xl border border-[#b42318]/25 bg-[#fff1ed] p-4 text-sm text-[#8f2118]">{error}</div> : null}

          {section === "operations" ? (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr] xl:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b53a24]">WOVO-wide action center</p>
                  <h1 className="mt-3 max-w-4xl text-4xl font-medium leading-[1.02] tracking-[-.045em] sm:text-6xl">See the work. Choose the client. Take the next action.</h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[#655f56]">This is the owner’s organization view. No client workspace or client billing state is selected by default.</p>
                </div>
                <div className="rounded-[24px] bg-[#191714] p-6 text-white">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff8c70]">Today’s priority</p>
                  <p className="mt-3 text-2xl font-medium">{activeInquiries.length + openThreads.length + pendingTasks.length} operational item{activeInquiries.length + openThreads.length + pendingTasks.length === 1 ? "" : "s"}</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">Open cases, approved posting tasks, and service requests stay durable even when you are offline.</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Active workspaces" value={activeAccounts.length} detail={`${archivedAccounts.length} archived with restore available`} />
                <Metric label="Inbox" value={activeInquiries.length + openThreads.length} detail="Public inquiries and private client cases" />
                <Metric label="Content actions" value={pendingContent.length + pendingTasks.length} detail="Approvals, queues, and manual posting tasks" />
                <Metric label="Services" value={serviceRequests.length + upcomingEvents.length} detail="Orders, shoots, consultations, and bookings" />
              </div>
              <section className={`${surface} p-5 sm:p-6`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">AI unit economics</p><h2 className="mt-2 text-xl font-semibold">Server-metered usage</h2></div><p className="text-xs text-[#756e64]">Provider cost is internal and never shown as a promise of unlimited access.</p></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Completed requests" value={completedAiUsage.length} detail="Reserved and finalized idempotently" /><Metric label="Units consumed" value={aiUnitsUsed} detail="Workspace-scoped billable usage" /><Metric label="Tracked provider cost" value={`$${(aiProviderCostMicros / 100_000_000).toFixed(4)}`} detail="Telemetry-backed actual or reserved maximum" /></div>
                {!snapshot.setup.expansion.wovoAiRuntimeReady ? <p className="mt-4 rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-3 text-sm leading-6 text-[#655f56]">WOVO AI is hidden and fail-closed until provider credentials, model routes, moderation, telemetry, revenue-per-unit controls, workspace limits, and spend caps are configured.</p> : null}
              </section>
              <div className="grid gap-5 xl:grid-cols-2">
                <section className={`${surface} p-5 sm:p-6`}>
                  <div className="flex items-end justify-between gap-3">
                    <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#b53a24]">Recent inquiries</p><h2 className="mt-2 text-2xl font-semibold">Team inbox</h2></div>
                    <button type="button" className={secondary} onClick={() => choose("inbox")}>Open inbox</button>
                  </div>
                  <div className="mt-5 space-y-3">
                    {activeInquiries.slice(0, 3).map((item) => <InquirySummary key={item.id} inquiry={item} onOpen={() => openInquiry(item)} />)}
                    {!activeInquiries.length ? <Empty title="No public inquiries waiting" copy="New inquiry references will appear here without exposing message content in notification email." /> : null}
                  </div>
                </section>
                <section className={`${surface} p-5 sm:p-6`}>
                  <div className="flex items-end justify-between gap-3">
                    <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#b53a24]">Approved work</p><h2 className="mt-2 text-2xl font-semibold">Posting tasks</h2></div>
                    <button type="button" className={secondary} onClick={() => choose("content")}>Open queue</button>
                  </div>
                  <div className="mt-5 space-y-3">
                    {pendingTasks.slice(0, 4).map((task) => {
                      const account = activeAccounts.find((candidate) => candidate.id === task.account_id);
                      return <div key={task.id} className="rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{task.title}</p><Status value={task.status} /></div><p className="mt-1 text-sm text-[#6b645b]">{account?.business_name ?? "Client workspace"} · due {formatDate(task.due_at)}</p></div>;
                    })}
                    {!pendingTasks.length ? <Empty title="No manual posting tasks due" copy="When approved content is scheduled, the database creates a durable WOVO task automatically." /> : null}
                  </div>
                </section>
              </div>
              <div className="rounded-2xl border border-[#c58b21]/35 bg-[#fff3cf] p-5 text-sm leading-6 text-[#50360f]">
                <p className="font-bold">Annual awards governance reminder · {formatDate(snapshot.setup.awardsReviewDate)}</p>
                <p className="mt-1 text-[#694b19]">Owner review only. No winner, finalist, plaque, or public award page may be issued until verified candidates are selected under a documented rubric using real moderated data. Review count alone never determines a winner.</p>
              </div>
            </div>
          ) : null}

          {section === "adam" ? <AdamOperations /> : null}

          {section === "clients" ? (
            <div className="space-y-6">
              <SectionHeading eyebrow="Tenant control" title="Clients / Workspaces" copy="Search first, then explicitly inspect a business. Nothing here treats a client workspace as the owner’s own account." />
              <div className={`${surface} p-4 sm:p-5`}>
                <label className="text-sm font-bold">Find a client workspace<input value={search} onChange={(event) => setSearch(event.target.value)} className={`${field} mt-2`} placeholder="Business, client email, industry, or service area" /></label>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredAccounts.map((account) => {
                  const subscription = snapshot.subscriptions.find((item) => item.account_id === account.id);
                  const grant = activeGrants.find((item) => item.account_id === account.id);
                  const invite = snapshot.clientInvites.find((item) => item.account_id === account.id);
                  return (
                    <article key={account.id} className={`${surface} p-5 sm:p-6`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">{human(account.business_type)}</p><h2 className="mt-2 text-2xl font-semibold">{account.business_name}</h2><p className="mt-1 text-sm text-[#6b645b]">{account.contact_email} · {account.location}</p></div>
                        <Status value={subscription?.status ?? "inactive"} />
                      </div>
                      <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                        <Info label="Client subscription" value={subscription?.status ? human(subscription.status) : "Inactive — no verified paid subscription"} />
                        <Info label="Temporary access" value={grant ? `${human(grant.grant_type)} until ${formatDate(grant.expires_at)}` : "None"} />
                        <Info label="Invite" value={invite ? `${human(invite.status)} · last sent ${formatDate(invite.last_sent_at)}` : "Self-created account"} />
                        <Info label="Workspace setup" value={account.onboarding_completed_at ? "Onboarding completed" : "Draft / onboarding not completed"} />
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button type="button" className={primary} onClick={() => onInspectWorkspace(account)}>Inspect workspace</button>
                        <button type="button" className={danger} onClick={() => setConfirmState({ action: "archive_owner_item", targetType: "workspace", targetId: account.id, targetLabel: account.business_name, warning: "This removes the workspace from active operations but does not cancel Stripe billing. The action is audited and the workspace can be restored." })}>Archive</button>
                      </div>
                    </article>
                  );
                })}
                {!filteredAccounts.length ? <Empty title="No matching client workspaces" copy="Change the search or create a secure client invitation below." /> : null}
              </div>
              <ClientInvitePanel busy={busy} onAction={onAction} />
              {snapshot.clientInvites.length ? <InviteList snapshot={snapshot} busy={busy} onAction={onAction} /> : null}
              <section className={`${surface} p-5 sm:p-6`}>
                <h2 className="text-xl font-semibold">Brand-library records</h2>
                <p className="mt-2 text-sm leading-6 text-[#6b645b]">Private brand assets are client-owned uploads kept tenant-scoped and non-public. Archive only records that should leave the active library.</p>
                <div className="mt-4 space-y-2">
                  {activeAssets.slice(0, 10).map((asset) => (
                    <div key={asset.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-4 sm:flex-row sm:items-center">
                      <div><p className="font-bold">{asset.file_name}</p><p className="mt-1 text-xs text-[#756e64]">{activeAccounts.find((account) => account.id === asset.account_id)?.business_name ?? "Client workspace"} · private upload</p></div>
                      <button type="button" className={danger} onClick={() => setConfirmState({ action: "archive_owner_item", targetType: "asset", targetId: asset.id, targetLabel: asset.file_name, warning: "This removes the asset from active WOVO workflows. The underlying private upload is not made public, and the record can be restored." })}>Archive asset</button>
                    </div>
                  ))}
                  {!activeAssets.length ? <Empty title="No private brand assets" copy="Client uploads remain private by default and appear here only for authorized owner operations." /> : null}
                </div>
              </section>
              {archivedAccounts.length ? (
                <section className={`${surface} p-5 sm:p-6`}>
                  <h2 className="text-xl font-semibold">Archived workspaces</h2>
                  <div className="mt-4 space-y-2">{archivedAccounts.map((account) => <div key={account.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#191714]/10 p-4 sm:flex-row sm:items-center"><div><p className="font-bold">{account.business_name}</p><p className="text-xs text-[#756e64]">Archived {formatDate(account.archived_at)}</p></div><button className={secondary} onClick={() => setConfirmState({ action: "restore_owner_item", targetType: "workspace", targetId: account.id, targetLabel: account.business_name, warning: "This returns the workspace to active owner operations. It does not change its Stripe subscription or temporary access state." })}>Restore workspace</button></div>)}</div>
                </section>
              ) : null}
            </div>
          ) : null}

          {section === "inbox" ? (
            <div className="space-y-6">
              <SectionHeading eyebrow="Organization support" title="Team Inbox" copy="Public inquiries and tenant-private client cases. Assignment stays inside WOVO; clients never see staff personal accounts." />
              <PublicInquiryInbox
                inquiries={activeInquiries}
                filteredInquiries={filteredInquiries}
                selectedInquiry={selectedInquiry}
                caseSearch={caseSearch}
                setCaseSearch={setCaseSearch}
                openInquiry={openInquiry}
                snapshot={snapshot}
                busy={busy}
                onAction={onAction}
                onArchive={(inquiry) => setConfirmState({ action: "archive_owner_item", targetType: "inquiry", targetId: inquiry.id, targetLabel: inquiry.case_reference, warning: "This removes the resolved inquiry from the active inbox. The action is audited and can be restored." })}
              />
              <section className={`${surface} p-5 sm:p-6`}>
                <h2 className="text-xl font-semibold">Private client cases</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.threads.map((thread) => {
                    const account = activeAccounts.find((candidate) => candidate.id === thread.account_id);
                    const history = snapshot.threadAssignments.filter((entry) => entry.thread_id === thread.id);
                    return (
                      <div key={thread.id} className="rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div><p className="font-mono text-xs font-bold text-[#a9341f]">{thread.case_reference}</p><p className="mt-1 font-bold">{account?.business_name ?? "Client workspace"} · {thread.subject}</p><p className="mt-1 text-xs text-[#6b645b]">Assigned to {human(thread.assigned_role)} · {history.length} assignment event{history.length === 1 ? "" : "s"}</p></div>
                          <div className="flex flex-wrap items-center gap-2"><Status value={thread.status} />{account ? <button className={secondary} onClick={() => onInspectWorkspace(account, "inbox")}>Open case</button> : null}</div>
                        </div>
                      </div>
                    );
                  })}
                  {!snapshot.threads.length ? <Empty title="No private client cases" copy="Each client receives a tenant-private WOVO team channel after workspace creation." /> : null}
                </div>
              </section>
            </div>
          ) : null}

          {section === "content" ? (
            <div className="space-y-6">
              <SectionHeading eyebrow="Human-in-the-loop publishing" title="Content Calendar / Queue" copy="Approved scheduled content creates a durable posting task. Native publishing remains manual until official platform access and background delivery are proven." />
              <div className="grid gap-4 xl:grid-cols-2">
                {activeContent.map((item) => {
                  const account = activeAccounts.find((candidate) => candidate.id === item.account_id);
                  const task = snapshot.postingTasks.find((candidate) => candidate.content_item_id === item.id);
                  return (
                    <article key={item.id} className={`${surface} p-5`}>
                      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">{account?.business_name ?? "Client workspace"} · {human(item.platform)}</p><h2 className="mt-2 text-xl font-semibold">{item.title}</h2></div><Status value={item.status} /></div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#655f56]">{item.caption}</p>
                      <div className="mt-4 rounded-xl bg-[#f7f2e9] p-3 text-xs leading-5 text-[#655f56]"><p>Scheduled: {formatDate(item.scheduled_for)}</p><p>Posting task: {task ? `${human(task.status)} · ${human(task.assigned_role)}` : "Created when approved and scheduled"}</p></div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {account ? <button className={secondary} onClick={() => onInspectWorkspace(account, "queue")}>Open client queue</button> : null}
                        {task && task.status !== "completed" ? <button className={primary} onClick={() => void onAction({ action: "update_posting_task", taskId: task.id, status: "completed" }, `${item.title} marked posted.`)}>Mark manually posted</button> : null}
                        <button className={danger} onClick={() => setConfirmState({ action: "archive_owner_item", targetType: "content", targetId: item.id, targetLabel: item.title, warning: "This removes the content item from active queues and cancels an unfinished posting task. It can be restored, and no native social action is taken." })}>Archive</button>
                      </div>
                    </article>
                  );
                })}
                {!activeContent.length ? <Empty title="No content in the cross-client queue" copy="Client drafts and scheduled approvals will appear here with their workspace context." /> : null}
              </div>
            </div>
          ) : null}

          {section === "services" ? (
            <div className="space-y-6">
              <SectionHeading eyebrow="Human services" title="Bookings & Services" copy="Consultations, shoots, drone requests, websites, and custom work stay separate from the automation-first workspace subscription." />
              <div className="grid gap-4 xl:grid-cols-2">
                {upcomingEvents.map((event) => {
                  const account = activeAccounts.find((candidate) => candidate.id === event.account_id);
                  return <article key={event.id} className={`${surface} p-5`}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">{account?.business_name ?? "Client workspace"}</p><h2 className="mt-2 text-xl font-semibold">{event.title}</h2></div><Status value={event.status} /></div><p className="mt-3 text-sm text-[#655f56]">{formatDate(event.starts_at)} · {event.location || event.meeting_provider || "Location / provider pending"}</p>{account ? <button className={`${secondary} mt-4`} onClick={() => onInspectWorkspace(account, "calendar")}>Open schedule</button> : null}</article>;
                })}
                {serviceRequests.map((order) => {
                  const account = activeAccounts.find((candidate) => candidate.id === order.account_id);
                  return <article key={order.id} className={`${surface} p-5`}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">{account?.business_name ?? "Client workspace"}</p><h2 className="mt-2 text-xl font-semibold capitalize">{human(order.order_type)}</h2></div><Status value={order.status} /></div><p className="mt-3 text-sm leading-6 text-[#655f56]">{order.description || "Scope requires WOVO review."}</p>{account ? <button className={`${secondary} mt-4`} onClick={() => onInspectWorkspace(account, "services")}>Open service record</button> : null}</article>;
                })}
                {!upcomingEvents.length && !serviceRequests.length ? <Empty title="No bookings or service requests" copy="New requests will appear with the client workspace and operational status." /> : null}
              </div>
            </div>
          ) : null}

          {section === "billing" ? (
            <div className="space-y-6">
              <SectionHeading eyebrow="Entitlement control" title="Billing" copy="Stripe subscription state is authoritative. Temporary owner grants are separately labeled, expire automatically, and never make an unpaid subscription appear paid." />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Paid / trialing" value={snapshot.subscriptions.filter((item) => ["active", "trialing"].includes(item.status)).length} detail="Verified Stripe entitlement" />
                <Metric label="Inactive" value={activeAccounts.filter((account) => !["active", "trialing"].includes(snapshot.subscriptions.find((item) => item.account_id === account.id)?.status ?? "")).length} detail="Not auto-activated" />
                <Metric label="Temporary access" value={activeGrants.length} detail="Owner-approved, expiring grants" />
                <Metric label="Owner billing" value="Exempt" detail="Owner/staff access is not a client subscription" />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {activeAccounts.map((account) => {
                  const subscription = snapshot.subscriptions.find((item) => item.account_id === account.id);
                  const grants = snapshot.accessGrants.filter((item) => item.account_id === account.id);
                  const activeGrant = activeGrants.find((item) => item.account_id === account.id);
                  return (
                    <article key={account.id} className={`${surface} p-5`}>
                      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">{account.business_name}</h2><p className="mt-1 text-sm text-[#6b645b]">Client subscription: {human(subscription?.status ?? "inactive")}</p></div><Status value={subscription?.status ?? "inactive"} /></div>
                      {!["active", "trialing"].includes(subscription?.status ?? "") ? <p className="mt-3 rounded-xl bg-[#fff3cf] p-3 text-sm leading-5 text-[#5b3c11]">Inactive means no verified active Stripe subscription exists. WOVO does not auto-activate an unpaid customer.</p> : null}
                      {activeGrant ? <div className="mt-3 rounded-xl border border-[#f05a3a]/20 bg-[#f05a3a]/8 p-3 text-sm"><p className="font-bold">{human(activeGrant.grant_type)} access until {formatDate(activeGrant.expires_at)}</p><p className="mt-1 text-[#655f56]">{activeGrant.reason}</p><button className={`${danger} mt-3`} onClick={() => void onAction({ action: "revoke_access", grantId: activeGrant.id }, `Temporary access revoked for ${account.business_name}.`)}>Revoke temporary access</button></div> : (
                        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void onAction({ action: "grant_access", accountId: account.id, grantType: data.get("grantType"), days: Number(data.get("days")), reason: data.get("reason") }, `Temporary access granted to ${account.business_name}.`);
                        }}>
                          <select name="grantType" className={field}><option value="test">Test access</option><option value="trial">Trial access</option><option value="staff_assisted">Staff-assisted access</option></select>
                          <select name="days" className={field}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select>
                          <input required name="reason" maxLength={500} className={`${field} sm:col-span-2`} placeholder="Required audit reason" />
                          <button disabled={busy === "grant_access"} className={`${primary} sm:col-span-2`}>Grant labeled temporary access</button>
                        </form>
                      )}
                      {grants.length ? <p className="mt-3 text-xs text-[#756e64]">{grants.length} grant record{grants.length === 1 ? "" : "s"} retained in audit history.</p> : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {section === "settings" ? (
            <div className="space-y-6">
              <SectionHeading eyebrow="Governance" title="Settings / Staff" copy="Owner-only configuration status, safety boundaries, and auditable changes." />
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title="President / owner access" copy="Full WOVO operations access is resolved server-side from the verified owner allowlist and stored staff role. It is not self-assignable." />
                <InfoCard title="Team notifications" copy="Database notifications contain a case reference and portal destination; sensitive support-message content is intentionally omitted from email notifications." />
                <InfoCard title="Manual publishing automation" copy="Approved scheduled items create durable tenant-scoped posting tasks. Native Facebook/Instagram publishing is not enabled." />
                <InfoCard title="Meeting providers" copy={snapshot.setup.meetingProviders.length ? `${snapshot.setup.meetingProviders.join(", ")} links may be attached after staff confirmation. Real hosting requires the provider account.` : "No meeting provider configured."} />
              </div>
              <section className={`${surface} p-5 sm:p-6`}>
                <h2 className="text-xl font-semibold">Recent owner audit</h2>
                <div className="mt-4 space-y-2">{snapshot.adminAudit.slice(0, 25).map((entry) => <div key={entry.id} className="rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-3 text-sm"><p className="font-bold capitalize">{human(entry.action)} · {entry.target_label}</p><p className="mt-1 text-xs text-[#756e64]">{formatDate(entry.created_at)} · {human(entry.target_type)}</p></div>)}{!snapshot.adminAudit.length ? <Empty title="No owner actions recorded" copy="Archive, restore, assignment, invite, and access-grant events will appear here." /> : null}</div>
              </section>
            </div>
          ) : null}
        </section>
      </div>

      {confirmState ? <ConfirmationModal state={confirmState} busy={busy} close={() => setConfirmState(null)} confirm={runConfirmation} /> : null}
    </main>
  );
}

function InquirySummary({ inquiry, onOpen }: { inquiry: PortalPublicInquiry; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="w-full rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-4 text-left transition hover:border-[#f05a3a]/45 hover:bg-[#fffdf8]"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-xs font-bold text-[#a9341f]">{inquiry.case_reference}</p><p className="mt-1 font-bold">{inquiry.subject}</p></div><Status value={inquiry.status} /></div><p className="mt-2 text-sm text-[#6b645b]">Assigned to {human(inquiry.assigned_role)} · Open case</p></button>;
}

function PublicInquiryInbox({
  inquiries,
  filteredInquiries,
  selectedInquiry,
  caseSearch,
  setCaseSearch,
  openInquiry,
  snapshot,
  busy,
  onAction,
  onArchive,
}: {
  inquiries: PortalPublicInquiry[];
  filteredInquiries: PortalPublicInquiry[];
  selectedInquiry: PortalPublicInquiry | null;
  caseSearch: string;
  setCaseSearch: (value: string) => void;
  openInquiry: (inquiry: PortalPublicInquiry) => void;
  snapshot: PortalSnapshot;
  busy: string;
  onAction: OwnerAction;
  onArchive: (inquiry: PortalPublicInquiry) => void;
}) {
  const inquiry = selectedInquiry;
  const history = inquiry ? snapshot.adminAudit.filter((entry) => entry.target_type === "inquiry" && entry.target_id === inquiry.id) : [];
  const replies = inquiry ? snapshot.publicInquiryReplies.filter((reply) => reply.inquiry_id === inquiry.id) : [];

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(250px,330px)_minmax(0,1fr)]">
      <aside className={`${surface} self-start p-4 sm:p-5`}>
        <h2 className="text-lg font-semibold">Public inquiry cases</h2>
        <p className="mt-1 text-xs leading-5 text-[#6b645b]">Search by case reference, sender name, email, or subject.</p>
        <form className="mt-4 space-y-2" onSubmit={(event) => {
          event.preventDefault();
          const normalized = caseSearch.trim().replace(/^#?case-/i, "").toLowerCase();
          const exact = inquiries.find((candidate) => candidate.case_reference.toLowerCase() === normalized);
          const match = exact ?? filteredInquiries[0];
          if (match) openInquiry(match);
        }}>
          <label className="sr-only" htmlFor="owner-case-search">Search support cases</label>
          <input id="owner-case-search" value={caseSearch} onChange={(event) => setCaseSearch(event.target.value)} className={field} placeholder="Case reference, name, or email" />
          <button className={`${secondary} w-full`} disabled={!filteredInquiries.length}>Open matching case</button>
        </form>
        <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
          {filteredInquiries.map((candidate) => (
            <button key={candidate.id} type="button" onClick={() => openInquiry(candidate)} className={`w-full rounded-xl border p-3 text-left transition ${inquiry?.id === candidate.id ? "border-[#f05a3a] bg-[#f05a3a]/10" : "border-[#191714]/10 bg-[#f7f2e9] hover:border-[#f05a3a]/40"}`}>
              <div className="flex items-start justify-between gap-2"><p className="font-mono text-[11px] font-bold text-[#a9341f]">{candidate.case_reference}</p><Status value={candidate.status} /></div>
              <p className="mt-2 line-clamp-2 text-sm font-bold">{candidate.subject}</p>
              <p className="mt-1 truncate text-xs text-[#6b645b]">{candidate.name} · {candidate.email}</p>
            </button>
          ))}
          {!filteredInquiries.length ? <Empty title="No matching case" copy="Check the private reference, name, or email and try again." /> : null}
        </div>
      </aside>

      {inquiry ? (
        <article id={`case-${inquiry.case_reference}`} className={`${surface} min-w-0 scroll-mt-24 p-5 target:ring-4 target:ring-[#f05a3a]/20 sm:p-6`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-[#a9341f]">{inquiry.case_reference}</p>
              <h2 className="mt-2 break-words text-2xl font-semibold">{inquiry.subject}</h2>
              <p className="mt-1 text-xs text-[#756e64]">Received {formatDate(inquiry.created_at)}</p>
            </div>
            <Status value={inquiry.status} />
          </div>

          <section className="mt-5 rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4" aria-label="Sender contact details">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#756e64]">Sender</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[#756e64]">Name</dt><dd className="mt-1 break-words font-bold">{inquiry.name}</dd></div>
              <div><dt className="text-xs text-[#756e64]">Email</dt><dd className="mt-1 break-all font-bold">{inquiry.email}</dd></div>
              {inquiry.phone ? <div><dt className="text-xs text-[#756e64]">Optional phone</dt><dd className="mt-1 break-words font-bold">{inquiry.phone}</dd></div> : null}
            </dl>
          </section>

          <section className="mt-5" aria-labelledby="public-case-conversation">
            <h3 id="public-case-conversation" className="text-lg font-semibold">Conversation</h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-[#191714]/10 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">Original inquiry</p><p className="text-xs text-[#756e64]">{formatDate(inquiry.created_at)}</p></div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#3f3a34]">{inquiry.message}</p>
              </div>
              {replies.map((reply) => (
                <div key={reply.id} className="ml-0 rounded-2xl border border-[#f05a3a]/20 bg-[#fff7f3] p-4 sm:ml-8">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">WOVO Media · {human(reply.author_role)}</p><p className="text-xs text-[#756e64]">{formatDate(reply.created_at)} · {human(reply.delivery_status)}</p></div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#3f3a34]">{reply.message}</p>
                </div>
              ))}
              {!replies.length && inquiry.staff_reply ? (
                <div className="ml-0 rounded-2xl border border-[#f05a3a]/20 bg-[#fff7f3] p-4 sm:ml-8">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">WOVO Media · prior reply</p><p className="text-xs text-[#756e64]">{formatDate(inquiry.replied_at)}</p></div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#3f3a34]">{inquiry.staff_reply}</p>
                </div>
              ) : null}
            </div>
            <form className="mt-4" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void onAction({ action: "reply_public_inquiry", inquiryId: inquiry.id, reply: data.get("reply") }, `Reply delivered for ${inquiry.case_reference}.`).then((result) => { if (result) form.reset(); });
            }}>
              <label className="text-xs font-bold uppercase tracking-[.12em] text-[#756e64]" htmlFor={`reply-${inquiry.id}`}>Reply as WOVO Media</label>
              <textarea id={`reply-${inquiry.id}`} name="reply" required maxLength={5000} rows={5} className={`${field} mt-2 min-h-32 resize-y py-3`} placeholder="Write the client-safe response. Staff personal contact details are never shown." />
              <button disabled={busy === "reply_public_inquiry"} className={`${primary} mt-3 w-full sm:w-auto`}>{busy === "reply_public_inquiry" ? "Delivering…" : "Send WOVO reply"}</button>
            </form>
          </section>

          <form className="mt-5 grid gap-3 rounded-2xl border border-[#191714]/10 p-4 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void onAction({ action: "update_public_inquiry", inquiryId: inquiry.id, assignedRole: data.get("assignedRole"), status: data.get("status") }, `${inquiry.case_reference} updated.`);
          }}>
            <label className="text-xs font-bold uppercase tracking-[.12em] text-[#756e64]">Assigned role<select name="assignedRole" defaultValue={inquiry.assigned_role ?? "support"} className={`${field} mt-2 normal-case tracking-normal`}><option value="support">Support team</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="owner">President / owner</option></select></label>
            <label className="text-xs font-bold uppercase tracking-[.12em] text-[#756e64]">Case status<select name="status" defaultValue={inquiry.status} className={`${field} mt-2 normal-case tracking-normal`}><option value="open">Open / reopen</option><option value="in_progress">In progress</option><option value="replied">Replied</option><option value="resolved">Resolved</option></select></label>
            <button disabled={busy === "update_public_inquiry"} className={`${primary} sm:col-span-2`}>Save assignment & status</button>
          </form>
          <details className="mt-4 rounded-xl border border-[#191714]/10 p-3 text-sm">
            <summary className="cursor-pointer font-bold">Assignment / status history ({history.length})</summary>
            <div className="mt-3 space-y-2 text-xs text-[#6b645b]">{history.map((entry) => <p key={entry.id}>{formatDate(entry.created_at)} · {human(entry.action)} · {String(entry.metadata.from ?? "queue")} → {String(entry.metadata.to ?? entry.metadata.delivery ?? "")}</p>)}{!history.length ? <p>No assignment changes recorded yet.</p> : null}</div>
          </details>
          <button type="button" className={`${danger} mt-4`} onClick={() => onArchive(inquiry)}>Archive inquiry</button>
        </article>
      ) : (
        <div className={`${surface} flex min-h-72 items-center justify-center p-6`}>
          <Empty title={inquiries.length ? "Select a public inquiry" : "Public inquiry queue is clear"} copy={inquiries.length ? "Open a case to see the original message, contact details, replies, assignment, status, and history." : "New inquiries receive non-guessable case references and appear here."} />
        </div>
      )}
    </section>
  );
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return <div className="rounded-2xl border border-dashed border-[#191714]/18 bg-white/40 p-6 text-center"><p className="font-bold">{title}</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#756e64]">{copy}</p></div>;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#d94326]">{eyebrow}</p><h1 className="mt-2 text-3xl font-medium tracking-[-.035em] sm:text-5xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#655f56] sm:text-base sm:leading-7">{copy}</p></header>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f7f2e9] p-3"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#756e64]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function InfoCard({ title, copy }: { title: string; copy: string }) {
  return <article className={`${surface} p-5`}><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">{copy}</p></article>;
}

function ClientInvitePanel({ busy, onAction }: { busy: string; onAction: OwnerAction }) {
  return (
    <section className={`${surface} p-5 sm:p-6`}>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">Secure client migration</p>
      <h2 className="mt-2 text-2xl font-semibold">Prepare a workspace and invite the client</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">The client receives an expiring verification link and sets their own password. The draft remains inactive until Stripe confirms payment or the owner grants separately labeled temporary access.</p>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void onAction({ action: "create_client_invite", email: data.get("email"), businessName: data.get("businessName"), businessType: data.get("businessType"), location: data.get("location") }, "Draft workspace created and secure invitation sent.").then((result) => { if (result) form.reset(); });
      }}>
        <label className="text-sm font-bold">Business name<input required name="businessName" maxLength={120} className={`${field} mt-2`} /></label>
        <label className="text-sm font-bold">Client email<input required name="email" type="email" maxLength={320} className={`${field} mt-2`} /></label>
        <label className="text-sm font-bold">Industry<select name="businessType" className={`${field} mt-2`}><option value="local_business">Local business</option><option value="restaurant">Restaurant</option><option value="realtor">Realtor / property marketing</option><option value="contractor">Contractor</option><option value="other">Other</option></select></label>
        <label className="text-sm font-bold">Service area<input required name="location" maxLength={240} className={`${field} mt-2`} placeholder="City, region, or remote service area" /></label>
        <button disabled={busy === "create_client_invite"} className={`${primary} sm:col-span-2`}>{busy === "create_client_invite" ? "Preparing secure invitation…" : "Create draft & send password-setup invite"}</button>
      </form>
    </section>
  );
}

function InviteList({ snapshot, busy, onAction }: { snapshot: PortalSnapshot; busy: string; onAction: OwnerAction }) {
  return (
    <section className={`${surface} p-5 sm:p-6`}>
      <h2 className="text-xl font-semibold">Client invitation status</h2>
      <div className="mt-4 space-y-3">
        {snapshot.clientInvites.map((invite) => {
          const account = snapshot.accounts.find((candidate) => candidate.id === invite.account_id);
          return <div key={invite.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-4 md:flex-row md:items-center"><div><p className="font-bold">{account?.business_name ?? "Client workspace"}</p><p className="mt-1 text-sm text-[#6b645b]">{invite.invited_email} · {human(invite.status)} · expires {formatDate(invite.expires_at)}</p></div>{invite.status === "pending" ? <div className="flex flex-wrap gap-2"><button disabled={busy === "resend_client_invite"} className={secondary} onClick={() => void onAction({ action: "resend_client_invite", inviteId: invite.id }, `Invitation resent for ${account?.business_name ?? "client workspace"}.`)}>Resend</button><button className={danger} onClick={() => void onAction({ action: "revoke_client_invite", inviteId: invite.id }, `Invitation revoked for ${account?.business_name ?? "client workspace"}.`)}>Revoke</button></div> : <Status value={invite.status} />}</div>;
        })}
      </div>
    </section>
  );
}
