"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import WovoLogo from "@/components/ui/wovo-logo";
import OwnerOperations from "@/app/portal/OwnerOperations";
import AiOperator from "@/app/portal/AiOperator";
import CartoonSeries from "@/app/portal/CartoonSeries";
import { clearSession, getActiveSession, signOutAndClear } from "@/lib/supabase/session-client";
import type { PortalAccount, PortalContentItem, PortalOrder, PortalSnapshot, PortalThread } from "@/lib/portal/types";

type Tab = "overview" | "queue" | "calendar" | "studio" | "inbox" | "services";

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Home" },
  { value: "queue", label: "Create" },
  { value: "calendar", label: "Calendar" },
  { value: "inbox", label: "Inbox" },
  { value: "studio", label: "Workspace" },
  { value: "services", label: "Profile" },
];

const CLIENT_CREDIT_PACKS = [
  { key: "small", units: 50, price: "$5" },
  { key: "growth", units: 110, price: "$10" },
  { key: "studio", units: 300, price: "$25" },
] as const;

const inputClass = "mt-1 min-h-12 w-full rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] px-3.5 text-sm text-[#191714] outline-none transition focus:border-[#f05a3a]/60";
const textareaClass = `${inputClass} min-h-28 py-3`;
const cardClass = "rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 shadow-[0_20px_80px_rgba(0,0,0,.16)]";
const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#f05a3a] px-4 text-sm font-semibold text-[#191714] transition hover:bg-[#d94326] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#191714]/15 bg-[#191714]/[.04] px-4 text-sm font-semibold text-[#191714] transition hover:bg-[#f05a3a]/10 disabled:opacity-45";

function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", options ?? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

type BillingOption = PortalSnapshot["setup"]["billingOptions"][number];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

function StatusPill({ status }: { status: string }) {
  const positive = ["active", "trialing", "approved", "queued", "manual_posted", "confirmed", "paid", "completed"].includes(status);
  const warning = ["client_review", "requested", "pending_addon", "checkout_pending", "quote_required", "revision_requested"].includes(status);
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${positive ? "border-[#f05a3a]/25 bg-[#f05a3a]/10 text-[#a9341f]" : warning ? "border-[#c58b21]/35 bg-[#fff3cf] text-[#694616]" : "border-[#191714]/10 bg-[#191714]/[.04] text-[#5f574e]"}`}>{status.replaceAll("_", " ")}</span>;
}

export default function PortalPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [accountId, setAccountId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [ownerWorkspaceMode, setOwnerWorkspaceMode] = useState(false);

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    return fetch(url, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
  }, []);

  const load = useCallback(async () => {
    const token = (await getActiveSession())?.access_token;
    if (!token) {
      const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    setError("");
    const response = await authedFetch("/api/portal");
    if (response.status === 401) {
      clearSession();
      const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    const payload = await response.json() as PortalSnapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "The portal could not load.");
    setSnapshot(payload);
    setAccountId((current) => {
      if (payload.mode === "staff" && payload.staffRole === "owner" && !ownerWorkspaceMode) return "";
      return payload.accounts.some((account) => account.id === current && !account.archived_at)
        ? current
        : payload.accounts.find((account) => !account.archived_at)?.id ?? "";
    });
    setLoading(false);
  }, [authedFetch, ownerWorkspaceMode, router]);

  const signOut = useCallback(async () => {
    await signOutAndClear();
    router.replace("/login?next=/portal");
  }, [router]);

  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout === "success") setNotice("Payment received. Stripe is confirming your access; the dashboard will refresh automatically.");
    if (checkout === "canceled") setNotice("Checkout was canceled. No new purchase was completed.");
    void load().catch((reason) => {
      setLoading(false);
      setError(reason instanceof Error ? reason.message : "The portal could not load.");
    });
  }, [load]);

  const account = snapshot?.accounts.find((item) => item.id === accountId) ?? null;
  const content = useMemo(() => snapshot?.content.filter((item) => item.account_id === accountId && !item.archived_at) ?? [], [snapshot, accountId]);
  const events = useMemo(() => snapshot?.events.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const thread = snapshot?.threads.find((item) => item.account_id === accountId) ?? null;
  const messages = useMemo(() => snapshot?.messages.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const orders = useMemo(() => snapshot?.orders.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const assets = useMemo(() => snapshot?.assets.filter((item) => item.account_id === accountId && !item.archived_at) ?? [], [snapshot, accountId]);
  const workflowDrafts = useMemo(() => snapshot?.workflowDrafts.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const creditLedger = useMemo(() => snapshot?.creditLedger.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const entitlements = useMemo(() => snapshot?.entitlements.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const knowledgeNotes = useMemo(() => snapshot?.knowledgeNotes.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const knowledgeNoteVersions = useMemo(() => snapshot?.knowledgeNoteVersions.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const commentContentWorkflows = useMemo(() => snapshot?.commentContentWorkflows.filter((item) => item.account_id === accountId) ?? [], [snapshot, accountId]);
  const subscription = snapshot?.subscriptions.find((item) => item.account_id === accountId) ?? null;
  const activeGrant = snapshot?.accessGrants.find((grant) => grant.account_id === accountId && !grant.revoked_at && Date.parse(grant.starts_at) <= Date.now() && Date.parse(grant.expires_at) > Date.now());
  const isPaid = snapshot?.mode === "staff" || ["active", "trialing"].includes(subscription?.status ?? "") || Boolean(activeGrant);
  const staffAccounts = useMemo(() => {
    if (!snapshot || snapshot.mode !== "staff") return [];
    const query = staffSearch.trim().toLowerCase();
    const activeAccounts = snapshot.accounts.filter((item) => !item.archived_at);
    if (!query) return activeAccounts;
    return activeAccounts.filter((item) => {
      const caseReference = snapshot.threads.find((candidate) => candidate.account_id === item.id)?.case_reference ?? "";
      return [item.business_name, item.contact_email, caseReference].some((value) => value.toLowerCase().includes(query));
    });
  }, [snapshot, staffSearch]);

  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(String(payload.action ?? "action"));
    setError("");
    setNotice("");
    try {
      const response = await authedFetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; url?: string };
      if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
      if (result.url) {
        window.location.href = result.url;
        return result;
      }
      setNotice(success);
      await load();
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be completed.");
      return null;
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] text-[#191714]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#191714]/15 border-t-[#f05a3a]" aria-label="Loading portal" /></main>;
  }

  if (!snapshot) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-5 text-[#191714]"><div className={`${cardClass} max-w-lg text-center`}><h1 className="text-2xl font-semibold">Portal unavailable</h1><p className="mt-3 text-[#655f56]">{error || "Try signing in again."}</p><Link href="/login?next=/portal" className={`${primaryButton} mt-5`}>Sign in</Link></div></main>;
  }

  if (snapshot.mode === "client" && snapshot.accounts.length === 0) {
    return <PlanOnboarding billingOptions={snapshot.setup.billingOptions} availableAddons={[
      snapshot.setup.expansion.dmManagerCheckoutReady ? "dm_manager" : "",
      snapshot.setup.expansion.websiteHostingCheckoutReady ? "website_hosting" : "",
      snapshot.setup.expansion.personalAssistantCheckoutReady ? "personal_ai_assistant" : "",
    ].filter(Boolean)} busy={busy} error={error} onSubmit={async (payload) => {
      const result = await action(payload, "Your private workspace plan is saved.") as { account?: PortalAccount } | null;
      if (result?.account && snapshot.setup.billingOptions.length) {
        await action({ action: "start_checkout", accountId: result.account.id, purchaseType: "subscription", planConfirmed: true, billingFrequency: payload.billingFrequency }, "Opening secure Stripe checkout.");
      }
    }} />;
  }

  if (snapshot.mode === "staff" && snapshot.staffRole === "owner" && !ownerWorkspaceMode) {
    return (
      <OwnerOperations
        snapshot={snapshot}
        busy={busy}
        error={error}
        notice={notice}
        onAction={action}
        onRefresh={load}
        onSignOut={signOut}
        onInspectWorkspace={(selected, selectedTab = "overview") => {
          setAccountId(selected.id);
          setTab(selectedTab);
          setOwnerWorkspaceMode(true);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (snapshot.mode === "staff" && snapshot.accounts.length === 0) {
    return (
      <main className="min-h-screen bg-[#f3efe6] px-4 py-6 text-[#191714] sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#191714]/10 pb-6">
            <WovoLogo variant="full" size={138} />
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#f05a3a]/12 px-3 py-2 text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">
                {snapshot.staffRole === "owner" ? "President / owner" : snapshot.staffRole?.replaceAll("_", " ")}
              </span>
              <button className={secondaryButton} onClick={() => void signOut()}>Sign out</button>
            </div>
          </header>

          <section className="grid gap-8 py-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d94326]">Owner action center</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-.04em] sm:text-6xl">The workspace is live. The client queue is empty.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#655f56]">
                Your verified owner role is active. No client workspace, booking, support case, or ready-to-post item has been created yet, so there is nothing to assign or triage.
              </p>
            </div>
            <div className="rounded-3xl bg-[#191714] p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff8c70]">Access check</p>
              <p className="mt-4 text-2xl font-medium">Full WOVO operations access</p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-white/65">
                <li>Client and subscription oversight</li>
                <li>Shared inbox and internal assignment</li>
                <li>Content, calendar, bookings, and services</li>
                <li>Owner billing exemption</li>
              </ul>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Review public site", "Check current offer and launch messaging.", "/"],
              ["Verify pricing", "Review the monthly, three-month, and yearly billing choices.", "/pricing"],
              ["Test client signup", "Open the customer-facing account flow.", "/signup?next=/portal"],
              ["Open public support", "Review the no-account-required inquiry path.", "/contact"],
            ].map(([title, copy, href]) => (
              <Link key={title} href={href} className="group rounded-2xl border border-[#191714]/12 bg-[#fffdf8] p-5 transition hover:-translate-y-0.5 hover:border-[#f05a3a]/45 hover:shadow-[0_16px_45px_rgba(25,23,20,.1)]">
                <h2 className="font-bold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6d665d]">{copy}</p>
                <span className="mt-5 inline-flex text-sm font-bold text-[#d94326]">Open →</span>
              </Link>
            ))}
          </section>

          {snapshot.publicInquiries.length ? (
            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d94326]">Public team inbox</p>
                  <h2 className="mt-3 text-3xl font-medium tracking-[-.03em]">Unassigned inquiries</h2>
                </div>
                <span className="rounded-full border border-[#191714]/10 bg-white/60 px-3 py-2 text-xs font-bold">{snapshot.publicInquiries.length} case{snapshot.publicInquiries.length === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {snapshot.publicInquiries.map((inquiry) => (
                  <article id={`case-${inquiry.case_reference}`} key={inquiry.id} className="scroll-mt-6 rounded-2xl border border-[#191714]/12 bg-[#fffdf8] p-5 target:border-[#f05a3a] target:ring-4 target:ring-[#f05a3a]/15">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-bold text-[#a9341f]">{inquiry.case_reference}</p>
                        <h3 className="mt-2 text-xl font-bold">{inquiry.subject}</h3>
                      </div>
                      <StatusPill status={inquiry.status} />
                    </div>
                    <p className="mt-3 text-sm font-semibold">{inquiry.name} · {inquiry.email}</p>
                    {inquiry.phone ? <p className="mt-1 text-sm text-[#756e64]">{inquiry.phone}</p> : null}
                    <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[#f3efe6] p-4 text-sm leading-6 text-[#4d473f]">{inquiry.message}</p>
                    {inquiry.staff_reply ? (
                      <div className="mt-4 rounded-xl border border-[#f05a3a]/20 bg-[#f05a3a]/8 p-4 text-sm leading-6">
                        <p className="font-bold">WOVO reply delivered</p>
                        <p className="mt-2 whitespace-pre-wrap text-[#655f56]">{inquiry.staff_reply}</p>
                      </div>
                    ) : (
                      <form className="mt-4" onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void action({ action: "reply_public_inquiry", inquiryId: inquiry.id, reply: data.get("reply") }, `Reply delivered for ${inquiry.case_reference}.`);
                      }}>
                        <textarea required name="reply" maxLength={5000} placeholder="Reply as WOVO Media…" className={textareaClass} />
                        <button disabled={busy === "reply_public_inquiry"} className={`${primaryButton} mt-3`}>Send WOVO reply</button>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 rounded-2xl border border-[#f05a3a]/20 bg-[#f05a3a]/8 p-5 text-sm leading-6 text-[#7d2d1f]">
            New paid clients will appear here automatically after verified signup, onboarding, and Stripe webhook activation. Until the first client arrives, this empty state is expected—not a missing dashboard.
          </div>
        </div>
      </main>
    );
  }

  if (snapshot.mode === "client" && account && !isPaid) {
    return (
      <main className="min-h-screen bg-[#f3efe6] p-4 text-[#191714] sm:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-4"><WovoLogo variant="full" size={144} className="" /><button className={secondaryButton} onClick={() => void signOut()}>Sign out</button></div>
          <div className="mt-10"><BillingCard snapshot={snapshot} account={account} busy={busy} onAction={action} /></div>
          {error ? <p role="alert" className="rounded-xl border border-[#b42318]/25 bg-[#fff1ed] p-4 text-sm text-[#8f2118]">{error}</p> : null}
          <p className="mt-5 text-center text-sm text-[#7a7369]">The private content, calendar, uploads, bookings, and support workspace opens after Stripe confirms an active subscription or an owner-approved temporary access grant.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3efe6] text-[#191714]">
      <header className="sticky top-0 z-30 border-b border-[#191714]/10 bg-[#f3efe6]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <WovoLogo variant="full" size={126} className="" />
          <span className="hidden h-6 w-px bg-[#f05a3a]/10 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{snapshot.mode === "staff" ? account?.business_name ?? "Administrative workspace inspection" : account?.business_name}</p>
            <p className="truncate text-xs text-[#7a7369]">{snapshot.mode === "staff" ? "Explicit client workspace inspection" : "Client marketing workspace"}</p>
          </div>
          {snapshot.mode === "staff" && snapshot.staffRole === "owner" ? <button className="hidden min-h-11 items-center rounded-xl border border-[#f05a3a]/25 bg-[#f05a3a]/10 px-3 text-sm font-bold text-[#8f301f] sm:inline-flex" onClick={() => { setOwnerWorkspaceMode(false); setAccountId(""); setTab("overview"); }}>Back to operations</button> : null}
          {snapshot.mode === "staff" ? (
            <div className="hidden items-center gap-2 md:flex">
              <input aria-label="Search clients or cases" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search client, email, case" className="min-h-11 w-52 rounded-xl border border-[#191714]/10 bg-[#fffdf8] px-3 text-sm" />
              <select aria-label="Select client" value={accountId} onChange={(event) => setAccountId(event.target.value)} className="min-h-11 max-w-52 rounded-xl border border-[#191714]/10 bg-[#fffdf8] px-3 text-sm">
                {staffAccounts.map((item) => <option key={item.id} value={item.id}>{item.business_name}</option>)}
              </select>
            </div>
          ) : null}
          <button className="min-h-11 rounded-xl border border-[#191714]/10 px-3 text-sm text-[#5f574e] hover:text-[#191714]" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-28 sm:px-6 sm:pb-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside>
          <nav className="hidden space-y-1 sm:block" aria-label="Portal">
            {tabs.map((item) => <button key={item.value} onClick={() => setTab(item.value)} className={`min-h-11 w-full rounded-xl px-3 text-left text-sm font-medium transition ${tab === item.value ? "bg-[#f05a3a] text-[#191714]" : "text-[#655f56] hover:bg-[#191714]/[.04] hover:text-[#191714]"}`}>{item.label}</button>)}
          </nav>
          {snapshot.mode === "staff" ? <div className="mt-5 hidden rounded-2xl border border-[#191714]/10 bg-white/70 p-4 text-xs leading-5 text-[#655f56] sm:block">
            <p className="font-semibold text-[#191714]">Need help?</p>
            <p className="mt-1">Message the shared WOVO team. Clients never need an employee&apos;s personal account.</p>
            <button onClick={() => setTab("inbox")} className="mt-3 font-semibold text-[#d94326]">Open team inbox</button>
          </div> : null}
        </aside>

        <section className="min-w-0">
          {snapshot.mode === "staff" && snapshot.staffRole === "owner" ? <button className={`${secondaryButton} mb-4 w-full sm:hidden`} onClick={() => { setOwnerWorkspaceMode(false); setAccountId(""); setTab("overview"); }}>Back to WOVO Operations</button> : null}
          {notice ? <div role="status" className="mb-4 rounded-2xl border border-[#f05a3a]/20 bg-[#f05a3a]/10 p-4 text-sm text-[#8f301f]">{notice}</div> : null}
          {error ? <div role="alert" className="mb-4 rounded-2xl border border-[#b42318]/25 bg-[#fff1ed] p-4 text-sm text-[#8f2118]">{error}</div> : null}
          {snapshot.mode === "staff" && tab === "overview" ? (
            <div className="mb-4 rounded-2xl border border-[#c58b21]/35 bg-[#fff3cf] p-4 text-sm leading-6 text-[#50360f]">
              <p className="font-semibold">Annual awards governance reminder · {formatDate(snapshot.setup.awardsReviewDate)}</p>
              <p className="mt-1 text-[#694b19]">Owner/admin review only. Publish no winner, finalist, plaque, or award page until verified candidates are selected using a documented rubric and real moderated review data. Review count alone cannot determine a winner.</p>
            </div>
          ) : null}
          {!isPaid && account ? <BillingCard snapshot={snapshot} account={account} busy={busy} onAction={action} /> : null}
          {tab === "overview" && account ? <Overview snapshot={snapshot} account={account} content={content} orders={orders} assets={assets} subscriptionStatus={subscription?.status ?? "inactive"} activeGrant={activeGrant ?? null} busy={busy} onAction={action} onNavigate={setTab} authedFetch={authedFetch} reload={load} setError={setError} setNotice={setNotice} /> : null}
          {tab === "queue" && account ? <Queue account={account} items={content} drafts={workflowDrafts} assets={assets} paid={isPaid} staff={snapshot.mode === "staff"} aiConfigured={snapshot.setup.aiConfigured} busy={busy} onAction={action} authedFetch={authedFetch} reload={load} setError={setError} setNotice={setNotice} /> : null}
          {tab === "calendar" && account ? <Calendar account={account} events={events} content={content} busy={busy} staff={snapshot.mode === "staff"} onAction={action} /> : null}
          {tab === "studio" && account ? <BuildStudio snapshot={snapshot} account={account} drafts={workflowDrafts} ledger={creditLedger} entitlements={entitlements} notes={knowledgeNotes} noteVersions={knowledgeNoteVersions} commentWorkflows={commentContentWorkflows} busy={busy} onAction={action} /> : null}
          {tab === "inbox" && account ? <Inbox account={account} thread={thread} messages={messages} assignments={snapshot.threadAssignments.filter((item) => item.thread_id === thread?.id)} staff={snapshot.mode === "staff"} canAssign={["owner", "admin", "manager"].includes(snapshot.staffRole ?? "")} busy={busy} onAction={action} /> : null}
          {tab === "services" && account ? <Services account={account} orders={orders} addons={snapshot.setup.addonsConfigured} busy={busy} onAction={action} /> : null}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-[#191714]/10 bg-[#fffdf8]/95 px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-16px_42px_rgba(25,23,20,.1)] backdrop-blur-xl sm:hidden" aria-label="Mobile workspace">
        {tabs.map((item) => <button key={item.value} type="button" onClick={() => { setTab(item.value); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-current={tab === item.value ? "page" : undefined} className={`min-h-14 rounded-xl px-1 text-[10px] font-bold leading-3 transition ${tab === item.value ? "bg-[#f05a3a]/15 text-[#a9341f]" : "text-[#655f56]"}`}><span className={`mx-auto mb-1 block h-1.5 w-1.5 rounded-full ${tab === item.value ? "bg-[#f05a3a]" : "bg-[#191714]/20"}`} />{item.label}</button>)}
      </nav>

      <footer className="border-t border-[#191714]/10 px-4 py-7 text-sm text-[#7a7369]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
          <p>WOVO Media client portal. AI-assisted work is reviewed by people before publishing.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms-of-use" className="hover:text-[#191714]">Terms</Link>
            <Link href="/privacy-policy" className="hover:text-[#191714]">Privacy</Link>
            <Link href="/cancellation-refund-policy" className="hover:text-[#191714]">Cancellation & refunds</Link>
            <Link href="/contact" className="hover:text-[#191714]">Contact & support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

type PlanDraft = {
  businessName: string; businessType: string; location: string; websiteUrl: string; audience: string; ageRange: string;
  brandVoice: string; goals: string; cadence: number; platforms: string[]; logoStatus: "ready_to_upload" | "needs_help";
  colors: string[]; modules: string[]; addons: string[]; services: string[]; rights: boolean;
  employeeEmail: string; employeePermission: string; websiteInterest: boolean; websiteSections: string; websiteGoals: string;
};

const PLAN_MODULES = [["content", "Weekly content & approval queue"], ["website_brief", "Website concept builder"], ["listing_ad", "Authorized listing-to-ad briefs"], ["meetings", "WOVO meeting requests"], ["jobs", "Private jobs workspace"]] as const;
const PLAN_ADDONS = [
  ["dm_manager", "AI DM Manager", "$1.99/month", "Draft-reply workflow with explicit review before sending."],
  ["website_hosting", "Managed website hosting", "$35/month", "Requires verified pricing and successful site provisioning."],
  ["personal_ai_assistant", "Personal AI assistant", "$59.99/month", "Booking-request setup only; no autonomous calls or bookings."],
  ["team_seats", "WOVO Teams seats", "$2.99/active employee/month", "Invite draft only until seat billing and permissions are released."],
] as const;
const PLAN_SERVICES = [["website_creation", "Bespoke website creation"], ["shoot", "In-person shoot"], ["drone", "Commercial drone request"], ["custom_editing", "Custom editing / staff time"]] as const;

function PlanOnboarding({ busy, error, billingOptions, availableAddons, onSubmit }: { busy: string; error: string; billingOptions: BillingOption[]; availableAddons: string[]; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<BillingOption["frequency"]>("monthly");
  const [draft, setDraft] = useState<PlanDraft>({ businessName: "", businessType: "local_business", location: "", websiteUrl: "", audience: "", ageRange: "not_sure", brandVoice: "", goals: "", cadence: 3, platforms: [], logoStatus: "ready_to_upload", colors: ["#f05a3a", "#191714"], modules: [], addons: [], services: [], rights: false, employeeEmail: "", employeePermission: "draft", websiteInterest: false, websiteSections: "", websiteGoals: "" });
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggle = (key: "platforms" | "modules" | "addons" | "services", value: string) => set(key, draft[key].includes(value) ? draft[key].filter((item) => item !== value) : [...draft[key], value]);
  function next() {
    setLocalError("");
    if (step === 0 && (!draft.businessName.trim() || !draft.location.trim())) return setLocalError("Add your business name and service area to continue.");
    if (step === 1 && (!draft.brandVoice.trim() || !draft.goals.trim() || !draft.rights)) return setLocalError("Add a brand voice and goal, then confirm your asset rights.");
    if (step === 2 && draft.employeeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.employeeEmail)) return setLocalError("Enter a valid employee email or leave the invite draft blank.");
    setStep((current) => Math.min(3, current + 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const cadenceHours = draft.cadence * 0.35;
  const moduleHours = (draft.modules.includes("content") ? 0.75 : 0) + (draft.modules.includes("website_brief") ? 0.35 : 0) + (draft.modules.includes("listing_ad") ? 0.35 : 0);
  const workflowHours = draft.addons.includes("dm_manager") ? 0.5 : 0;
  const weeklyLow = Math.max(0.5, Math.round((cadenceHours + moduleHours + workflowHours) * 2) / 2);
  const weeklyHigh = Math.max(weeklyLow + 0.5, Math.round((weeklyLow * 1.65) * 2) / 2);
  const projections = [3, 6, 12].map((months) => ({ months, low: Math.round(weeklyLow * 4.33 * months), high: Math.round(weeklyHigh * 4.33 * months) }));
  const selectedBillingOption = billingOptions.find((option) => option.frequency === billingFrequency) ?? billingOptions[0] ?? null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ action: "onboard", billingFrequency, businessName: draft.businessName, businessType: draft.businessType, websiteUrl: draft.websiteUrl, location: draft.location, brandVoice: draft.brandVoice, audience: `${draft.audience}\nAge range: ${draft.ageRange}`.trim(), goals: draft.goals, cadence: draft.cadence, platforms: draft.platforms, rightsConfirmed: draft.rights, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, onboardingPlan: { coreModules: draft.modules, recurringAddons: draft.addons, quoteServices: draft.services, logoStatus: draft.logoStatus, brandColors: draft.colors, websiteInterest: draft.websiteInterest, websiteBrief: draft.websiteInterest ? { sections: draft.websiteSections, goals: draft.websiteGoals } : {}, employeeInviteDrafts: draft.employeeEmail ? [{ email: draft.employeeEmail, permission: draft.employeePermission }] : [] } });
  }
  return <main className="min-h-screen overflow-x-hidden bg-[#f3efe6] px-4 py-5 text-[#191714] sm:px-8 sm:py-7"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between gap-5 border-b border-[#191714]/10 pb-5"><WovoLogo variant="full" size={132} className="" /><p className="hidden text-xs font-semibold text-[#655f56] sm:block">Private setup · nothing is charged until final confirmation</p></header>
    <div className="grid grid-cols-4 border-b border-[#191714]/10" aria-label={`Onboarding step ${step + 1} of 4`}>{["Business","Brand","Workspace","Review"].map((label, item) => <div key={label} className={`border-b-2 px-1 py-4 text-center text-[10px] font-bold uppercase tracking-[.12em] sm:text-xs ${item === step ? "border-[#f05a3a] text-[#191714]" : item < step ? "border-[#191714] text-[#655f56]" : "border-transparent text-[#9b9388]"}`}>{label}</div>)}</div>
    <form onSubmit={(event) => void submit(event)} className="bg-[#fffdf8] px-4 py-7 sm:px-8 sm:py-10"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#d94326]">Step {step + 1} of 4</p>
      {step === 0 ? <section><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Start with your business</h1><p className="mt-3 text-sm leading-6 text-[#655f56]">These details stay in your private workspace and shape the plan you review before payment.</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Business name<input value={draft.businessName} onChange={(e) => set("businessName", e.target.value)} maxLength={120} className={inputClass} /></label><label className="text-sm font-medium">Industry<select value={draft.businessType} onChange={(e) => set("businessType", e.target.value)} className={inputClass}><option value="local_business">Local business</option><option value="restaurant">Restaurant</option><option value="realtor">Realtor / property marketing</option><option value="contractor">Contractor</option><option value="other">Other</option></select></label><label className="text-sm font-medium">Service area<input value={draft.location} onChange={(e) => set("location", e.target.value)} maxLength={240} placeholder="City, region, or remote service area" className={inputClass} /></label><label className="text-sm font-medium">Current website, if any<input value={draft.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} type="url" maxLength={300} placeholder="https://" className={inputClass} /></label><label className="text-sm font-medium sm:col-span-2">Best customers<textarea value={draft.audience} onChange={(e) => set("audience", e.target.value)} maxLength={800} className={textareaClass} /></label><label className="text-sm font-medium">Typical customer age<select value={draft.ageRange} onChange={(e) => set("ageRange", e.target.value)} className={inputClass}><option value="not_sure">Not sure / broad</option>{["18-24","25-34","35-44","45-54","55-64","65+"].map((value) => <option key={value}>{value}</option>)}</select></label></div></section> : null}
      {step === 1 ? <section><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Set your brand direction</h1><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Logo readiness<select value={draft.logoStatus} onChange={(e) => set("logoStatus", e.target.value as PlanDraft["logoStatus"])} className={inputClass}><option value="ready_to_upload">I have a logo to upload after activation</option><option value="needs_help">I need help getting a usable logo</option></select><span className="mt-2 block text-xs leading-5 text-[#756e64]">A rights-confirmed logo is required before generation. If unavailable, your setup is preserved and WOVO shows a recovery checklist.</span></label><div className="grid grid-cols-2 gap-3"><label className="text-sm">Primary color<input type="color" value={draft.colors[0]} onChange={(e) => set("colors", [e.target.value, draft.colors[1]])} className={`${inputClass} p-2`} /></label><label className="text-sm">Secondary<input type="color" value={draft.colors[1]} onChange={(e) => set("colors", [draft.colors[0], e.target.value])} className={`${inputClass} p-2`} /></label></div><label className="text-sm font-medium">Brand voice<textarea value={draft.brandVoice} onChange={(e) => set("brandVoice", e.target.value)} placeholder="Warm, direct, useful, never pushy" className={textareaClass} /></label><label className="text-sm font-medium">Main goal<textarea value={draft.goals} onChange={(e) => set("goals", e.target.value)} placeholder="Bookings, leads, repeat orders…" className={textareaClass} /></label><label className="text-sm">Posts per week<select value={draft.cadence} onChange={(e) => set("cadence", Number(e.target.value))} className={inputClass}>{[1,2,3,4,5,6,7].map((value) => <option key={value}>{value}</option>)}</select></label><fieldset className="text-sm"><legend>Priority platforms</legend><div className="mt-2 grid grid-cols-2 gap-2">{["instagram","facebook","tiktok","youtube","google_business","linkedin"].map((value) => <label key={value} className="flex min-h-12 items-center gap-2 rounded-xl border border-[#191714]/10 px-3 capitalize"><input type="checkbox" checked={draft.platforms.includes(value)} onChange={() => toggle("platforms", value)} />{value.replace("_", " ")}</label>)}</div></fieldset><label className="flex items-start gap-3 rounded-2xl border border-[#f05a3a]/20 bg-[#f05a3a]/[.06] p-4 text-sm leading-6 sm:col-span-2"><input type="checkbox" checked={draft.rights} onChange={(e) => set("rights", e.target.checked)} className="mt-1" /><span>I own or have permission to use submitted business assets. Each person’s likeness and voice require separate permission.</span></label></div></section> : null}
      {false && step === 2 ? <section><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Choose your workspace</h1><p className="mt-3 text-sm text-[#655f56]">Nothing paid is preselected. Unavailable items save as setup requests and are not charged.</p><div className="mt-7 grid gap-6 lg:grid-cols-2"><fieldset><legend className="font-bold">Included modules</legend><div className="mt-3 space-y-2">{PLAN_MODULES.map(([id,name]) => <label key={id} className="flex min-h-12 items-center gap-3 rounded-xl border border-[#191714]/10 p-3 text-sm"><input type="checkbox" checked={draft.modules.includes(id)} onChange={() => toggle("modules", id)} />{name}</label>)}</div></fieldset><fieldset><legend className="font-bold">Optional recurring add-ons</legend><div className="mt-3 space-y-2">{PLAN_ADDONS.map(([id,name,price,note]) => <label key={id} className="block rounded-xl border border-[#191714]/10 p-3 text-sm"><span className="flex gap-3"><input type="checkbox" checked={draft.addons.includes(id)} onChange={() => toggle("addons", id)} /><span><strong>{name} · {price}</strong><small className="mt-1 block leading-5 text-[#756e64]">{note}</small></span></span></label>)}</div></fieldset></div>
        <details open={draft.websiteInterest} className="mt-6 rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"><summary className="cursor-pointer font-bold" onClick={(e) => { e.preventDefault(); set("websiteInterest", !draft.websiteInterest); }}>Website brief & sample concept · {draft.websiteInterest ? "selected" : "optional"}</summary>{draft.websiteInterest ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Desired sections<textarea value={draft.websiteSections} onChange={(e) => set("websiteSections", e.target.value)} className={textareaClass} /></label><label className="text-sm">Website goal<textarea value={draft.websiteGoals} onChange={(e) => set("websiteGoals", e.target.value)} className={textareaClass} /></label><div className="rounded-2xl bg-white p-4 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Generated sample concept · preview only</p><div className="mt-3 rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${draft.colors[0]}22, ${draft.colors[1]}18)` }}><h3 className="text-2xl font-semibold">{draft.businessName || "Your business"}</h3><p className="mt-2 text-sm">A mobile-first {draft.websiteSections || "service"} layout focused on {draft.websiteGoals || draft.goals || "your goal"}.</p></div><p className="mt-2 text-xs text-[#756e64]">Not a hosted or published website.</p></div></div> : null}</details>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm">Employee invite draft<input type="email" value={draft.employeeEmail} onChange={(e) => set("employeeEmail", e.target.value)} placeholder="employee@business.com" className={inputClass} /><small className="mt-2 block leading-5 text-[#756e64]">Saved privately; no invite or seat charge until WOVO Teams is released and confirmed.</small></label><label className="text-sm">Draft permission<select value={draft.employeePermission} onChange={(e) => set("employeePermission", e.target.value)} className={inputClass}><option value="view">View</option><option value="draft">View & draft</option><option value="approve">View, draft & approve</option><option value="schedule">View, draft, approve & schedule</option></select></label></div><fieldset className="mt-6"><legend className="font-bold">Quote-only human services</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{PLAN_SERVICES.map(([id,name]) => <label key={id} className="flex min-h-12 items-center gap-3 rounded-xl border border-[#191714]/10 p-3 text-sm"><input type="checkbox" checked={draft.services.includes(id)} onChange={() => toggle("services", id)} />{name}</label>)}</div></fieldset></section> : null}
      {step === 2 ? <PlanSelection draft={draft} availableAddons={availableAddons} onSet={set} onToggle={toggle} /> : null}
      {step === 3 ? <section><p className="mt-2 font-bold text-[#d94326]">Your WOVO workspace is ready to activate</p><h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Review your tailored plan</h1><div className="mt-7 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><div className="space-y-4"><article className="rounded-2xl border border-[#191714]/10 p-5"><h2 className="font-bold">{draft.businessName}</h2><p className="mt-1 text-sm text-[#655f56]">{draft.businessType.replaceAll("_", " ")} · {draft.location} · {draft.cadence} posts/week</p><p className="mt-3 text-sm">{draft.modules.length ? draft.modules.map((id) => PLAN_MODULES.find(([key]) => key === id)?.[1]).join(" · ") : "No optional modules selected."}</p></article>
        <article className="rounded-2xl border border-[#f05a3a]/25 bg-[#f05a3a]/[.06] p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a9341f]">Estimated time WOVO can take off your plate</p><p className="mt-2 text-3xl font-semibold">{weeklyLow}–{weeklyHigh} hours/week</p><p className="mt-1 text-sm text-[#655f56]">About {Math.round(weeklyLow * 4.33)}–{Math.round(weeklyHigh * 4.33)} hours/month.</p><div className="mt-4 grid grid-cols-3 gap-2">{projections.map((item) => <div key={item.months} className="rounded-xl bg-white p-3 text-center"><strong className="block">{item.low}–{item.high}h</strong><span className="text-xs text-[#756e64]">{item.months} months</span></div>)}</div><details className="mt-4 text-xs leading-5 text-[#655f56]"><summary className="cursor-pointer font-bold">How we estimate this</summary><p className="mt-2">A conservative planning range based on selected posting cadence, content setup, asset organization, website-brief upkeep, and optional inbox-draft workflow. It is a projection—not past results or guaranteed savings—and excludes setup time, approvals, provider outages, and work you keep manual.</p></details></article>
        {draft.addons.length ? <article className="rounded-2xl border border-[#c58b21]/30 bg-[#fff3cf] p-5"><h2 className="font-bold">Selected add-ons</h2>{PLAN_ADDONS.filter(([id]) => draft.addons.includes(id)).map(([id,name,price]) => <div key={id} className="mt-3 flex justify-between gap-3 text-sm"><span>{name}</span><strong>{price}</strong></div>)}</article> : null}{draft.services.length ? <article className="rounded-2xl border border-[#191714]/10 p-5"><h2 className="font-bold">Quote-only interests</h2><p className="mt-2 text-sm text-[#655f56]">{PLAN_SERVICES.filter(([id]) => draft.services.includes(id)).map(([,name]) => name).join(" · ")}. No charge today.</p></article> : null}</div>
        <aside className="rounded-2xl bg-[#191714] p-5 text-white sm:p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff8c72]">Choose billing period</p><BillingPeriodSelector options={billingOptions} value={selectedBillingOption?.frequency ?? "monthly"} onChange={setBillingFrequency} dark /><div className="mt-5 border-t border-white/15 pt-4"><div className="flex items-baseline justify-between gap-4"><span className="text-sm text-white/65">Total due today</span><strong className="text-3xl">{selectedBillingOption ? formatMoney(selectedBillingOption.amountCents) : "Unavailable"}</strong></div><p className="mt-2 text-xs leading-5 text-white/60">{selectedBillingOption ? `${selectedBillingOption.renewalLabel}. ${formatMoney(selectedBillingOption.effectiveMonthlyCents)} effective monthly.` : "Billing is temporarily unavailable."}</p></div><p className="mt-5 text-xs leading-5 text-white/65">Includes the brand profile, weekly plan, approval queue, calendar, private assets, and WOVO team inbox. Paid features activate only after a verified Stripe webhook.</p></aside></div></section> : null}
      {(localError || error) ? <p role="alert" className="mt-6 rounded-xl border border-[#b42318]/25 bg-[#fff1ed] p-3 text-sm text-[#8f2118]">{localError || error}</p> : null}<div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#191714]/10 pt-5 sm:flex-row sm:justify-between">{step > 0 ? <button type="button" className={secondaryButton} onClick={() => { setLocalError(""); setStep(step - 1); window.scrollTo({ top: 0 }); }}>Back and edit</button> : <span />}{step < 3 ? <button type="button" className={primaryButton} onClick={next}>Continue</button> : <button disabled={Boolean(busy) || !selectedBillingOption} className={primaryButton}>{busy ? "Preparing your workspace…" : selectedBillingOption ? "Confirm plan & continue to secure checkout" : "Billing setup required"}</button>}</div><p className="mt-5 text-xs leading-5 text-[#7a7369]">By confirming, you agree to the <Link href="/terms-of-use" className="underline">Terms</Link>, acknowledge the <Link href="/privacy-policy" className="underline">Privacy Policy</Link>, and can still cancel Stripe Checkout without purchase.</p>
    </form></div></main>;
}

function BillingPeriodSelector({ options, value, onChange, dark = false }: { options: BillingOption[]; value: BillingOption["frequency"]; onChange: (value: BillingOption["frequency"]) => void; dark?: boolean }) {
  return <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Billing period">
    {options.map((option) => {
      const selected = option.frequency === value;
      return <button key={option.frequency} type="button" role="radio" aria-checked={selected} onClick={() => onChange(option.frequency)} className={`min-h-16 w-full rounded-xl border px-3 py-2.5 text-left transition ${selected ? dark ? "border-[#ff8c72] bg-white/10" : "border-[#f05a3a] bg-[#f05a3a]/10" : dark ? "border-white/15 hover:border-white/35" : "border-[#191714]/12 hover:border-[#f05a3a]/45"}`}>
        <span className="flex items-start justify-between gap-3"><span><strong className="block text-sm">{option.label}</strong><span className={`mt-1 block text-xs ${dark ? "text-white/55" : "text-[#6d665d]"}`}>{formatMoney(option.amountCents)} due today · {formatMoney(option.effectiveMonthlyCents)}/month effective</span></span>{option.savingsCents > 0 ? <span className={`shrink-0 text-xs font-bold ${dark ? "text-[#ff8c72]" : "text-[#a9341f]"}`}>Save {option.savingsPercent}%</span> : null}</span>
      </button>;
    })}
  </div>;
}

function PlanSelection({ draft, availableAddons, onSet, onToggle }: {
  draft: PlanDraft;
  availableAddons: string[];
  onSet: <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => void;
  onToggle: (key: "platforms" | "modules" | "addons" | "services", value: string) => void;
}) {
  const websiteSelected = draft.websiteInterest || draft.modules.includes("website_brief");
  const sectionChips = ["Home", "Services", "Menu / offerings", "About", "Contact"];
  const addSection = (section: string) => {
    const sections = draft.websiteSections.split(",").map((item) => item.trim()).filter(Boolean);
    onSet("websiteSections", sections.includes(section) ? sections.filter((item) => item !== section).join(", ") : [...sections, section].join(", "));
  };
  const launchAddons = PLAN_ADDONS.filter(([id]) => availableAddons.includes(id));
  return <section>
    <div className="max-w-2xl"><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Shape the workspace around your week</h1><p className="mt-3 text-sm leading-6 text-[#655f56]">Choose only what helps now. Core modules are included; human production requests are scoped and quoted separately.</p></div>

    <div className="mt-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#d94326]">Included with the workspace</p><h2 className="mt-1 text-xl font-semibold">Pick your working tools</h2></div><span className="rounded-full bg-[#191714]/[.06] px-3 py-1 text-xs font-bold">No extra charge</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PLAN_MODULES.map(([id, name]) => {
        const selected = draft.modules.includes(id);
        const benefit: Record<string, string> = { content: "Turn cadence into a reviewable weekly plan.", website_brief: "Explore pages and a branded concept before hosting.", listing_ad: "Build an ad brief from facts and assets you may use.", meetings: "Request organization-level consultations.", jobs: "Organize private roles and applications without automated hiring." };
        return <button key={id} type="button" aria-pressed={selected} onClick={() => { onToggle("modules", id); if (id === "website_brief") onSet("websiteInterest", !selected); }} className={`min-h-24 rounded-xl border p-4 text-left transition ${selected ? "border-[#f05a3a] bg-[#f05a3a]/[.07]" : "border-[#191714]/10 bg-white hover:border-[#f05a3a]/40"}`}><span className="flex items-start justify-between gap-3"><strong className="text-sm">{name}</strong><span className={`text-[10px] font-bold uppercase tracking-[.1em] ${selected ? "text-[#a9341f]" : "text-[#756e64]"}`}>{selected ? "Added" : "Choose"}</span></span><span className="mt-2 block text-xs leading-5 text-[#655f56]">{benefit[id]}</span></button>;
      })}</div>
    </div>

    {websiteSelected ? <div className="mt-8 grid gap-6 rounded-[28px] border border-[#191714]/10 bg-[#f7f2e9] p-4 sm:p-6 lg:grid-cols-[.8fr_1.2fr]">
      <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#d94326]">Website concept setup</p><h2 className="mt-2 text-2xl font-semibold">Give the concept a direction</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">Choose a few page sections, then add one outcome in your own words.</p><div className="mt-4 flex flex-wrap gap-2">{sectionChips.map((section) => { const selected = draft.websiteSections.split(",").map((item) => item.trim()).includes(section); return <button key={section} type="button" aria-pressed={selected} onClick={() => addSection(section)} className={`min-h-10 rounded-full border px-3 text-xs font-bold ${selected ? "border-[#f05a3a] bg-[#f05a3a]/10 text-[#8f301f]" : "border-[#191714]/15 bg-white text-[#655f56]"}`}>{section}</button>; })}</div><label className="mt-5 block text-sm font-bold">Primary website goal<input value={draft.websiteGoals} onChange={(event) => onSet("websiteGoals", event.target.value)} maxLength={600} placeholder="Example: help visitors request a project estimate" className={inputClass} /></label><details className="mt-4 rounded-xl border border-[#191714]/10 bg-white/70 p-3 text-sm"><summary className="cursor-pointer font-bold">Add custom page details</summary><textarea value={draft.websiteSections} onChange={(event) => onSet("websiteSections", event.target.value)} maxLength={600} className={`${inputClass} min-h-20 py-3`} aria-label="Custom website sections" /></details></div>
      <div className="border-[5px] border-[#191714] bg-[#191714] p-1 shadow-[0_24px_50px_rgba(25,23,20,.16)]"><div className="overflow-hidden bg-[#fffdf8]"><div className="flex items-center justify-between border-b border-[#191714]/10 px-4 py-3"><strong className="text-sm">{draft.businessName}</strong><span className="h-2 w-14" style={{ backgroundColor: draft.colors[0] }} /></div><div className="grid min-h-56 place-items-center border-l-8 px-5 py-9 text-center" style={{ borderLeftColor: draft.colors[0] }}><div><span className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: draft.colors[0] }}>Website concept</span><h3 className="mx-auto mt-3 max-w-sm text-3xl font-semibold leading-tight">A clearer next step for every visitor.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#655f56]">{draft.websiteGoals.trim() || `A focused ${draft.businessType.replaceAll("_", " ")} concept designed to turn interest into a useful conversation.`}</p><span className="mt-5 inline-flex min-h-10 items-center px-4 text-xs font-bold text-white" style={{ backgroundColor: draft.colors[1] }}>Start a request</span></div></div><div className="grid border-t border-[#191714]/10 sm:grid-cols-3">{["What you offer", "Why it fits", "How to begin"].map((title, index) => <div key={title} className={`bg-white p-3 ${index ? "border-t border-[#191714]/10 sm:border-l sm:border-t-0" : ""}`}><span className="text-[10px] font-bold" style={{ color: draft.colors[0] }}>0{index + 1}</span><p className="mt-2 text-xs font-bold">{title}</p><p className="mt-1 text-[10px] leading-4 text-[#756e64]">Concise, editable brand-led content.</p></div>)}</div><div className="border-t border-[#191714]/10 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[.15em] text-[#756e64]">Concept preview · not published</div></div></div>
    </div> : null}

    {launchAddons.length ? <div className="mt-8"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#d94326]">Optional upgrades</p><h2 className="mt-1 text-xl font-semibold">Add only what you want</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2">{launchAddons.map(([id, name, price, note]) => { const selected = draft.addons.includes(id); return <div key={id} className={`rounded-2xl border p-4 ${selected ? "border-[#f05a3a] bg-[#f05a3a]/[.06]" : "border-[#191714]/10 bg-white"}`}><button type="button" aria-pressed={selected} onClick={() => onToggle("addons", id)} className="flex min-h-12 w-full items-start justify-between gap-3 text-left"><span><strong>{name}</strong><span className="mt-1 block text-sm font-bold text-[#a9341f]">{price}</span></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${selected ? "bg-[#f05a3a]" : "bg-[#191714]/[.06] text-[#655f56]"}`}>{selected ? "Selected" : "Add"}</span></button>{selected ? <p className="mt-3 border-t border-[#191714]/10 pt-3 text-xs leading-5 text-[#655f56]">{note}</p> : null}</div>; })}</div></div> : null}

    <details className="mt-8 rounded-2xl border border-[#191714]/10 bg-white p-4"><summary className="cursor-pointer font-bold">Interested in human production services?</summary><p className="mt-2 text-sm leading-6 text-[#655f56]">Choose an interest for the plan summary. WOVO will scope availability and quote it separately—no booking or charge is created now.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{PLAN_SERVICES.map(([id, name]) => { const selected = draft.services.includes(id); return <button key={id} type="button" aria-pressed={selected} onClick={() => onToggle("services", id)} className={`min-h-12 rounded-xl border px-4 text-left text-sm font-bold ${selected ? "border-[#f05a3a] bg-[#f05a3a]/10" : "border-[#191714]/10"}`}>{selected ? "Added · " : ""}{name}</button>; })}</div></details>
  </section>;
}

function BillingCard({ snapshot, account, busy, onAction }: { snapshot: PortalSnapshot; account: PortalAccount; busy: string; onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [billingFrequency, setBillingFrequency] = useState<BillingOption["frequency"]>("monthly");
  const selected = snapshot.setup.billingOptions.find((option) => option.frequency === billingFrequency) ?? snapshot.setup.billingOptions[0] ?? null;
  return (
    <section className={`${cardClass} mb-5 border-[#f05a3a]/20`}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d94326]">Activate WOVO Workspace</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Choose how often you pay.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f574e]">Includes your industry-specific brand profile, weekly planning workflow, approval/manual posting queue, private asset library, calendar, private team inbox, and one assigned WOVO representative for consultations. Automatic social publishing and human production labor are not included.</p>
          <p className="mt-2 text-sm text-[#655f56]">Separate paid add-ons or quotes: in-person shoots, drone work, bespoke website creation, custom editing, extra participants, and additional staff time.</p>
          <p className="mt-3 text-xs leading-5 text-[#7a7369]">Stripe displays the final price and renewal cadence before payment. Cancel future renewal from the visible Manage billing button; timing of access and refund eligibility follow the posted policy and Stripe checkout terms.</p>
        </div>
        <div className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"><BillingPeriodSelector options={snapshot.setup.billingOptions} value={selected?.frequency ?? "monthly"} onChange={setBillingFrequency} /><div className="mt-4 flex items-end justify-between border-t border-[#191714]/10 pt-4"><span className="text-xs font-semibold text-[#655f56]">Due today</span><strong className="text-3xl">{selected ? formatMoney(selected.amountCents) : "—"}</strong></div><button disabled={!selected || busy === "start_checkout"} onClick={() => void onAction({ action: "start_checkout", accountId: account.id, purchaseType: "subscription", planConfirmed: true, billingFrequency: selected?.frequency }, "Opening secure Stripe checkout.")} className={`${primaryButton} mt-4 w-full`}>{selected ? "Continue to secure checkout" : "Billing setup required"}</button></div>
      </div>
    </section>
  );
}

function Overview({ snapshot, account, content, orders, assets, subscriptionStatus, activeGrant, busy, onAction, onNavigate, authedFetch, reload, setError, setNotice }: {
  snapshot: PortalSnapshot; account: PortalAccount; content: PortalContentItem[]; orders: PortalOrder[]; assets: PortalSnapshot["assets"]; subscriptionStatus: string; activeGrant: PortalSnapshot["accessGrants"][number] | null; busy: string;
  onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown>; onNavigate: (tab: Tab) => void; authedFetch: (url: string, init?: RequestInit) => Promise<Response>; reload: () => Promise<void>; setError: (value: string) => void; setNotice: (value: string) => void;
}) {
  const weekEnd = Date.now() + 7 * 86400000;
  const thisWeek = content.filter((item) => item.scheduled_for && Date.parse(item.scheduled_for) <= weekEnd && Date.parse(item.scheduled_for) >= Date.now() - 86400000);
  const posted = content.filter((item) => item.status === "manual_posted");
  const awaiting = content.filter((item) => ["client_review", "approved", "queued"].includes(item.status));
  const hasBrandAsset = assets.some((item) => item.asset_kind === "brand" && item.rights_confirmed);
  const hasFoodAsset = assets.some((item) => item.asset_kind === "food" && item.rights_confirmed);
  const missingRequiredAssets = !hasBrandAsset || (account.business_type === "restaurant" && !hasFoodAsset);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File)) return;
    setError("");
    setNotice("Preparing secure private upload...");
    const metadata = {
      accountId: account.id,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      assetKind: form.get("kind"),
      rightsConfirmed: form.get("rightsConfirmed") === "on",
      peopleConsentConfirmed: form.get("peopleConsentConfirmed") === "on",
    };
    try {
      const prepared = await authedFetch("/api/portal/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", ...metadata }),
      });
      const preparedPayload = await prepared.json() as { error?: string; bucket?: string; path?: string; token?: string };
      if (!prepared.ok || !preparedPayload.path || !preparedPayload.token || !preparedPayload.bucket) {
        throw new Error(preparedPayload.error ?? "Unable to prepare upload.");
      }
      const storage = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      setNotice(`Uploading ${file.name} privately...`);
      const { error: uploadError } = await storage.storage
        .from(preparedPayload.bucket)
        .uploadToSignedUrl(preparedPayload.path, preparedPayload.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const finalized = await authedFetch("/api/portal/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize", path: preparedPayload.path, ...metadata }),
      });
      const finalizedPayload = await finalized.json() as { error?: string };
      if (!finalized.ok) throw new Error(finalizedPayload.error ?? "Upload verification failed.");
      event.currentTarget.reset();
      setNotice("Asset uploaded to the private brand library and verified.");
      await reload();
    } catch (reason) {
      setNotice("");
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await onAction({
      action: "update_account_profile",
      accountId: account.id,
      brandVoice: data.get("brandVoice"),
      audience: data.get("audience"),
      goals: data.get("goals"),
      cadence: Number(data.get("cadence")),
      platforms: data.getAll("platforms"),
    }, "Brand profile updated for future WOVO drafts.");
    if (result) await reload();
  }
  const profileReady = Boolean(account.brand_voice && account.audience && account.goals);
  const firstPlanReady = content.length > 0;
  const approvalReady = content.some((item) => ["approved", "queued", "manual_posted"].includes(item.status));
  const progress = [profileReady, hasBrandAsset, firstPlanReady, approvalReady];
  const progressCount = progress.filter(Boolean).length;
  const nextAction = !profileReady ? "Tighten your brand profile" : missingRequiredAssets ? "Upload required brand assets" : !firstPlanReady ? "Create your first content plan" : awaiting.length ? `Review ${awaiting.length} queued item${awaiting.length === 1 ? "" : "s"}` : "Check the upcoming schedule";
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] bg-[#191714] p-5 text-white shadow-[0_24px_80px_rgba(25,23,20,.16)] sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff8c70]">Welcome to {account.business_name}</p>
        <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-[-.035em] sm:text-5xl">{nextAction}.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">WOVO keeps the week simple: prepare the brand, create drafts, approve what is accurate, then move approved work into the posting schedule.</p></div>
          <div className="min-w-56 rounded-2xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between text-xs"><span>Workspace progress</span><strong>{progressCount}/4</strong></div><div className="mt-3 grid grid-cols-4 gap-1" aria-label={`${progressCount} of 4 setup steps complete`}>{progress.map((ready, index) => <span key={index} className={`h-2 rounded-full ${ready ? "bg-[#f05a3a]" : "bg-white/15"}`} />)}</div></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Primary workspace actions">
        {[
          ["Create content", "Draft a post or build the next review queue.", "queue"],
          ["Upload brand assets", "Add a logo, photo, menu, or approved reference.", "assets"],
          ["View schedule", `${thisWeek.length} item${thisWeek.length === 1 ? "" : "s"} planned this week.`, "calendar"],
          ["Message WOVO", "Open your private shared support channel.", "inbox"],
        ].map(([title, copy, target]) => <button key={title} type="button" onClick={() => target === "assets" ? document.getElementById("brand-assets")?.scrollIntoView({ behavior: "smooth", block: "start" }) : onNavigate(target as Tab)} className="group min-h-36 rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#f05a3a]/45 hover:shadow-[0_16px_45px_rgba(25,23,20,.1)]"><p className="font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-[#6b645b]">{copy}</p><span className="mt-4 inline-flex text-xs font-bold uppercase tracking-[.12em] text-[#d94326]">Open →</span></button>)}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <details className={cardClass}>
          <summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Brand profile</p><h2 className="mt-2 text-xl font-semibold">How WOVO should sound and plan</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">{account.brand_voice || "Add a clear voice"} · {account.audience || "define the audience"}</p></div><StatusPill status={profileReady ? "complete" : "needs details"} /></div><p className="mt-4 text-sm font-bold text-[#d94326]">Edit profile</p></summary>
          <form onSubmit={(event) => void saveProfile(event)} className="mt-5 space-y-3 border-t border-[#191714]/10 pt-5">
            <label className="text-sm font-medium">Brand voice<textarea required name="brandVoice" defaultValue={account.brand_voice ?? ""} maxLength={1000} className={textareaClass} placeholder="For example: confident, plainspoken, warm, never pushy" /></label>
            <label className="text-sm font-medium">Audience<textarea required name="audience" defaultValue={account.audience ?? ""} maxLength={1000} className={textareaClass} placeholder="Who they are, their age range, needs, and local context" /></label>
            <label className="text-sm font-medium">Marketing goal<textarea required name="goals" defaultValue={account.goals ?? ""} maxLength={1500} className={textareaClass} placeholder="What should this month's content help accomplish?" /></label>
            <label className="text-sm font-medium">Weekly cadence<select name="cadence" defaultValue={account.posting_cadence_per_week} className={inputClass}>{[1,2,3,4,5,6,7].map((value) => <option key={value} value={value}>{value} post{value === 1 ? "" : "s"} per week</option>)}</select></label>
            <fieldset><legend className="text-sm font-medium">Platforms</legend><div className="mt-2 flex flex-wrap gap-2">{["instagram","facebook","google_business","linkedin","tiktok","youtube"].map((platform) => <label key={platform} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#191714]/10 px-3 text-sm"><input name="platforms" value={platform} type="checkbox" defaultChecked={account.preferred_platforms.includes(platform)} />{platform.replace("_", " ")}</label>)}</div></fieldset>
            <button disabled={busy === "update_account_profile"} className={`${primaryButton} w-full sm:w-auto`}>Save brand profile</button>
          </form>
        </details>

        <section className={`${cardClass} flex flex-col justify-between`}>
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">This week at a glance</p><h2 className="mt-2 text-xl font-semibold">Only what needs attention</h2><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#f05a3a]/10 px-3 py-2 text-sm font-semibold text-[#8f301f]">{awaiting.length} awaiting action</span><span className="rounded-full bg-[#191714]/[.05] px-3 py-2 text-sm">{posted.length} posted</span><span className="rounded-full bg-[#191714]/[.05] px-3 py-2 text-sm">{orders.filter((order) => !["fulfilled","canceled","refunded"].includes(order.status)).length} service requests</span></div></div>
          <div className="mt-5 border-t border-[#191714]/10 pt-4 text-sm leading-6 text-[#655f56]"><p><strong className="text-[#191714]">Posting queue</strong> means drafts waiting for review, approval, scheduling, or a WOVO team posting task.</p>{activeGrant ? <p className="mt-2"><strong className="text-[#191714]">Temporary {activeGrant.grant_type.replace("_", " ")} access</strong> is active through {formatDate(activeGrant.expires_at)}. This audited owner grant does not change the Stripe subscription, which remains {subscriptionStatus.replace("_", " ")}.</p> : <p className="mt-2"><strong className="text-[#191714]">Billing</strong> stays separate from add-ons. The core workspace is {subscriptionStatus.replace("_", " ")}.</p>}{["active", "trialing"].includes(subscriptionStatus) ? <button onClick={() => void onAction({ action: "billing_portal", accountId: account.id }, "Opening Stripe billing.")} disabled={busy === "billing_portal"} className={`${secondaryButton} mt-4`}>Billing & cancellation</button> : null}</div>
        </section>
      </section>

      {missingRequiredAssets ? <div className="rounded-2xl border border-[#c58b21]/35 bg-[#fff3cf] p-4 text-sm leading-6 text-[#50360f]"><p className="font-semibold">One short setup step remains.</p><p className="mt-1">Every workspace needs a rights-confirmed brand/logo. Restaurant workspaces also need at least one rights-confirmed food photo before AI generation. Uploads stay private by default.</p></div> : null}

      <details id="brand-assets" className={`${cardClass} scroll-mt-24`} open={missingRequiredAssets}>
        <summary className="cursor-pointer list-none"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Private brand library</p><h2 className="mt-2 text-xl font-semibold">Upload only what WOVO may use</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">Assets are your logo, photos, videos, menus, property material, and references. They remain tenant-private unless you explicitly approve a public result.</p></div><span className="shrink-0 text-sm font-bold text-[#d94326]">{assets.length} stored · Add asset</span></div></summary>
        <form onSubmit={(event) => void upload(event)} className="mt-5 space-y-3 border-t border-[#191714]/10 pt-5">
          <label className="block cursor-pointer rounded-2xl border border-dashed border-[#f05a3a]/45 bg-[#fff7f3] p-6 text-center"><span className="block font-semibold">Choose a photo, video, logo, menu, or reference</span><span className="mt-2 block text-xs leading-5 text-[#756e64]">Images/PDFs up to 10 MB · MP4/WebM/QuickTime up to 100 MB</span><input required name="file" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime" className="mx-auto mt-4 block max-w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#191714] file:px-4 file:py-2.5 file:font-semibold file:text-white" /></label>
          <label className="text-sm font-medium">What is this?<select name="kind" className={inputClass}><option value="brand">Brand / logo</option><option value="food">Food photo</option><option value="menu">Menu</option><option value="property">Authorized property</option><option value="project">Project</option><option value="reference">Reference</option></select></label>
          <details className="rounded-xl border border-[#191714]/10 p-3"><summary className="cursor-pointer text-sm font-semibold">Permissions required before upload</summary><p className="mt-2 text-xs leading-5 text-[#756e64]">These confirmations protect your business, the people shown, and WOVO. They are stored with the private asset record.</p><div className="mt-3 space-y-2"><label className="flex min-h-12 items-start gap-2 rounded-xl bg-[#f7f2e9] p-3 text-sm"><input required name="rightsConfirmed" type="checkbox" className="mt-1" />I own or have permission to use this asset.</label><label className="flex min-h-12 items-start gap-2 rounded-xl bg-[#f7f2e9] p-3 text-sm"><input required name="peopleConsentConfirmed" type="checkbox" className="mt-1" />I have consent for every identifiable person, likeness, and voice depicted.</label></div></details>
          <button className={`${primaryButton} w-full sm:w-auto`}>Upload privately</button>
        </form>
        <p className="mt-4 text-xs text-[#7a7369]">Brand/logo: {hasBrandAsset ? "ready" : "required"}{account.business_type === "restaurant" ? ` · restaurant food photo: ${hasFoodAsset ? "ready" : "required"}` : ""}. Nothing here is publicly indexed.</p>
      </details>

      <section className="rounded-2xl border border-[#191714]/10 bg-white/60 p-4 text-sm leading-6 text-[#655f56]"><p><strong className="text-[#191714]">Need context?</strong> Notifications are private WOVO team updates; the posting queue is your review path; scheduled items appear on Calendar; support always goes to the shared WOVO team, never an employee&apos;s personal account.</p><div className="mt-3 flex flex-wrap gap-3"><button onClick={() => onNavigate("inbox")} className="font-bold text-[#d94326]">Message WOVO</button><button onClick={() => onNavigate("studio")} className="font-bold text-[#d94326]">Open Build & automate</button></div></section>
      {snapshot.mode === "staff" ? <section className={cardClass}><h2 className="text-lg font-semibold">Team notifications</h2><div className="mt-4 space-y-3">{snapshot.notifications.filter((item) => item.account_id === account.id).slice(0, 8).map((item) => <div key={item.id} className="rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-[#7a7369]">{formatDate(item.created_at)}</p></div>{item.body ? <p className="mt-1 text-sm text-[#655f56]">{item.body}</p> : null}</div>)}{!snapshot.notifications.some((item) => item.account_id === account.id) ? <p className="text-sm text-[#7a7369]">No new operational notifications.</p> : null}</div></section> : null}
    </div>
  );
}

type CreatorMode = "post" | "campaign" | "episode" | "website" | "video";

const CREATOR_MODES: Array<{ value: CreatorMode; label: string; eyebrow: string }> = [
  { value: "post", label: "Post", eyebrow: "Ready-to-review caption" },
  { value: "campaign", label: "Campaign", eyebrow: "Multi-post planning brief" },
  { value: "episode", label: "Character episode", eyebrow: "Rights-confirmed series brief" },
  { value: "website", label: "Website preview", eyebrow: "Private concept brief" },
  { value: "video", label: "Video brief", eyebrow: "Storyboard-first workflow" },
];

function CreatorWorkbench({ account, items, drafts, assets, paid, aiConfigured, busy, onAction, authedFetch, reload, setError, setNotice }: {
  account: PortalAccount;
  items: PortalContentItem[];
  drafts: PortalSnapshot["workflowDrafts"];
  assets: PortalSnapshot["assets"];
  paid: boolean;
  aiConfigured: boolean;
  busy: string;
  onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  reload: () => Promise<void>;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
}) {
  const [mode, setMode] = useState<CreatorMode>("post");
  const [advanced, setAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageAssets = assets.filter((asset) => asset.mime_type.startsWith("image/") && asset.rights_confirmed);

  async function uploadFrame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return setError("Choose a JPG, PNG, or WebP start frame.");
    setError("");
    setUploading(true);
    setNotice("Preparing a private reference upload…");
    const metadata = { accountId: account.id, fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetKind: "reference", rightsConfirmed: form.get("rightsConfirmed") === "on", peopleConsentConfirmed: form.get("peopleConsentConfirmed") === "on" };
    try {
      const prepared = await authedFetch("/api/portal/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prepare", ...metadata }) });
      const payload = await prepared.json() as { error?: string; bucket?: string; path?: string; token?: string };
      if (!prepared.ok || !payload.bucket || !payload.path || !payload.token) throw new Error(payload.error ?? "Unable to prepare the private upload.");
      const storage = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: uploadError } = await storage.storage.from(payload.bucket).uploadToSignedUrl(payload.path, payload.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const finalized = await authedFetch("/api/portal/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize", path: payload.path, ...metadata }) });
      const finished = await finalized.json() as { error?: string };
      if (!finalized.ok) throw new Error(finished.error ?? "Upload verification failed.");
      formElement.reset();
      setNotice("Reference frame stored privately. Select it in the video brief when the list refreshes.");
      await reload();
    } catch (reason) {
      setNotice("");
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally { setUploading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const prompt = String(data.get("prompt") ?? "").trim();
    const title = String(data.get("title") ?? "").trim() || `${CREATOR_MODES.find((item) => item.value === mode)?.label ?? "Creative"} · ${prompt.slice(0, 64)}`;
    const rightsConfirmed = data.get("rightsConfirmed") === "on";
    if (mode === "post") {
      const result = await onAction({ action: "create_content", accountId: account.id, title, caption: prompt, platform: data.get("channel"), contentType: "social_post", scheduledFor: data.get("scheduledFor"), rightsConfirmed }, "Post draft added to the private review queue. Nothing was published.");
      if (result) form.reset();
      return;
    }
    const workflowType = mode === "campaign" ? "post_plan" : mode === "episode" ? "mascot_series" : mode === "website" ? "website_site" : "ugc_ad";
    const result = await onAction({
      action: "create_workflow_draft", accountId: account.id, workflowType, title, brief: prompt,
      rightsConfirmed, sourceAuthorized: rightsConfirmed, peopleConsentConfirmed: data.get("peopleConsentConfirmed") === "on", voiceConsentConfirmed: data.get("voiceConsentConfirmed") === "on",
      cadence: data.get("cadence"), mode, channel: data.get("channel"), outputFormat: data.get("format"), aspect: data.get("aspect"), style: data.get("style"), durationSeconds: data.get("duration"), startFrameAssetId: data.get("startFrameAssetId") || null,
    }, mode === "video" ? "Private video/storyboard brief saved. No video was generated or published." : "Private creation brief saved for review. Nothing was published.");
    if (result) form.reset();
  }

  const actionLabel = mode === "post" ? "Add draft to review queue" : mode === "video" ? "Save video brief" : "Save creation brief";
  return (
    <section className="overflow-hidden rounded-[26px] border border-[#191714]/10 bg-[#fffdf8] shadow-[0_26px_90px_rgba(25,23,20,.12)]">
      <div className="border-b border-[#191714]/10 px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">WOVO Create · {aiConfigured ? "AI drafting connected" : "manual draft mode"}</p><h1 className="mt-2 text-3xl font-medium tracking-[-.035em] sm:text-4xl">Describe what you want Adam to create.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#655f56]">Start with the outcome. WOVO saves tenant-private drafts and never marks a post, site, image, or video complete without evidence.</p></div>
          <div className="flex items-center justify-between rounded-2xl bg-[#191714] px-4 py-3 text-white lg:min-w-52"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/55">Available credits</p><p className="mt-1 text-xl font-semibold">{paid ? "Ledger-backed" : "Activation required"}</p></div><span className="h-2.5 w-2.5 rounded-full bg-[#f05a3a]" /></div>
        </div>
        <div className="mt-5 flex gap-1 overflow-x-auto pb-0" role="tablist" aria-label="Creation type">{CREATOR_MODES.map((item) => <button key={item.value} type="button" role="tab" aria-selected={mode === item.value} onClick={() => setMode(item.value)} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition ${mode === item.value ? "border-[#f05a3a] text-[#191714]" : "border-transparent text-[#756e64] hover:text-[#191714]"}`}>{item.label}</button>)}</div>
      </div>

      <form onSubmit={(event) => void submit(event)} className="p-4 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div>
            <label className="text-sm font-semibold">{CREATOR_MODES.find((item) => item.value === mode)?.eyebrow}<textarea required name="prompt" minLength={10} maxLength={5000} className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-[#191714]/12 bg-[#f7f2e9] p-4 text-base leading-7 text-[#191714] outline-none transition placeholder:text-[#8a8278] focus:border-[#f05a3a]" placeholder={mode === "episode" ? "Introduce the character, episode goal, setting, key beats, and approved call to action…" : mode === "website" ? "Describe the offer, audience, hero message, sections, and action the page should drive…" : mode === "video" ? "Describe the opening frame, subject motion, camera movement, scene beats, and ending…" : "Describe the idea, offer, audience, and what the audience should do next…"} /></label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-[#655f56]">Channel<select name="channel" defaultValue="instagram" className={inputClass}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="linkedin">LinkedIn</option><option value="website">Website</option></select></label>
              <label className="text-xs font-semibold text-[#655f56]">Format<select name="format" defaultValue={mode === "video" ? "vertical_video" : "single_post"} className={inputClass}><option value="single_post">Single post</option><option value="carousel">Carousel brief</option><option value="vertical_video">Vertical video brief</option><option value="landing_page">Landing page</option></select></label>
              <label className="text-xs font-semibold text-[#655f56]">Aspect<select name="aspect" defaultValue="9:16" className={inputClass}><option value="9:16">Vertical · 1080×1920</option><option value="16:9">Landscape · 1920×1080</option><option value="1:1">Square · 1080×1080</option></select></label>
            </div>
            <button type="button" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)} className="mt-4 min-h-11 text-sm font-bold text-[#a9341f]">{advanced ? "Hide advanced settings" : "Advanced settings"}</button>
            {advanced ? <div className="mt-2 grid gap-3 rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4 sm:grid-cols-2"><label className="text-sm font-medium">Internal title<input name="title" maxLength={180} className={inputClass} placeholder="Optional—WOVO will name it" /></label><label className="text-sm font-medium">Style / motion<select name="style" className={inputClass}><option value="editorial">Editorial and composed</option><option value="energetic">Energetic movement</option><option value="cinematic">Cinematic and restrained</option><option value="playful">Playful character motion</option><option value="product">Product-focused</option></select></label><label className="text-sm font-medium">Cadence<input name="cadence" maxLength={80} className={inputClass} placeholder="One-time, weekly, three episodes/week" /></label><label className="text-sm font-medium">Schedule<input name="scheduledFor" type="datetime-local" className={inputClass} /></label></div> : null}
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#756e64]">Draft cost</p><p className="mt-2 text-xl font-semibold">0 credits to save</p><p className="mt-1 text-xs leading-5 text-[#756e64]">A provider render is never started by this form. WOVO will show a separate server-verified quote before any paid generation.</p></div>
            {mode === "video" ? <div className="rounded-2xl border border-[#d94326]/20 bg-[#fff3ee] p-4"><p className="font-semibold">Video render paused</p><p className="mt-2 text-xs leading-5 text-[#6b493f]">The current provider path has not passed the metering, private-storage, moderation, and refund test. Save a useful storyboard brief now; Generate video remains unavailable.</p><label className="mt-3 block text-sm font-medium">Duration<select name="duration" defaultValue="8" className={inputClass}><option value="4">4 seconds</option><option value="8">8 seconds</option><option value="12">12 seconds</option></select></label><label className="mt-3 block text-sm font-medium">Private start frame<select name="startFrameAssetId" className={inputClass}><option value="">No start frame</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.file_name}</option>)}</select></label><label className="mt-3 block text-sm font-medium text-[#756e64]">End frame<input disabled value="Not supported by a verified provider" readOnly className={`${inputClass} opacity-60`} /></label></div> : null}
          </aside>
        </div>

        <div className="mt-5 grid gap-3 border-t border-[#191714]/10 pt-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2"><label className="flex min-h-11 items-start gap-2 text-sm"><input required name="rightsConfirmed" type="checkbox" className="mt-1" /><span>I own or have permission to use every supplied reference and business fact.</span></label>{["episode", "video"].includes(mode) ? <><label className="flex min-h-11 items-start gap-2 text-sm"><input required name="peopleConsentConfirmed" type="checkbox" className="mt-1" /><span>I have explicit permission for every recognizable person or likeness.</span></label><label className="flex min-h-11 items-start gap-2 text-sm"><input required name="voiceConsentConfirmed" type="checkbox" className="mt-1" /><span>I have explicit permission for every referenced voice; no impersonation.</span></label></> : null}</div>
          <button disabled={!paid || busy === "create_content" || busy === "create_workflow_draft"} className="inline-flex min-h-13 items-center justify-center rounded-xl bg-[#f05a3a] px-6 text-sm font-bold text-[#191714] transition hover:bg-[#d94326] disabled:cursor-not-allowed disabled:opacity-45">{actionLabel}</button>
        </div>
      </form>

      {mode === "video" ? <form onSubmit={(event) => void uploadFrame(event)} className="border-t border-[#191714]/10 bg-[#f7f2e9] p-4 sm:p-5"><div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-sm font-semibold">Add a private reference frame</p><p className="mt-1 text-xs leading-5 text-[#756e64]">JPG, PNG, or WebP up to 10 MB. This stays in the selected workspace and is not public.</p><input required name="file" type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block max-w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#191714] file:px-4 file:py-2.5 file:font-semibold file:text-white" /><div className="mt-3 flex flex-col gap-2 sm:flex-row"><label className="flex items-center gap-2 text-xs"><input required name="rightsConfirmed" type="checkbox" />I own or can use this frame.</label><label className="flex items-center gap-2 text-xs"><input required name="peopleConsentConfirmed" type="checkbox" />People/likeness consent is confirmed.</label></div></div><button disabled={uploading} className={secondaryButton}>{uploading ? "Uploading…" : "Upload privately"}</button></div></form> : null}

      <div className="border-t border-[#191714]/10 bg-[#191714] p-4 text-white sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ff8c70]">Workbench</p><h2 className="mt-1 text-xl font-medium">Recent drafts and review queue</h2></div><span className="text-xs text-white/55">{items.length + drafts.length} saved</span></div><div className="mt-4 flex gap-3 overflow-x-auto pb-1">{[...items.slice(0, 4).map((item) => ({ id: item.id, title: item.title, kind: item.platform, status: item.status })), ...drafts.slice(0, 4).map((draft) => ({ id: draft.id, title: draft.title, kind: draft.workflow_type.replaceAll("_", " "), status: draft.status }))].slice(0, 6).map((item) => <article key={item.id} className="min-w-60 rounded-2xl border border-white/10 bg-white/[.06] p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/50">{item.kind}</p><h3 className="mt-2 line-clamp-2 font-semibold">{item.title}</h3><p className="mt-3 text-xs capitalize text-[#ffab96]">{item.status.replaceAll("_", " ")}</p></article>)}{!items.length && !drafts.length ? <p className="w-full rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/55">Your first saved draft will appear here.</p> : null}</div></div>
    </section>
  );
}

function Queue({ account, items, drafts, assets, paid, staff, aiConfigured, busy, onAction, authedFetch, reload, setError, setNotice }: { account: PortalAccount; items: PortalContentItem[]; drafts: PortalSnapshot["workflowDrafts"]; assets: PortalSnapshot["assets"]; paid: boolean; staff: boolean; aiConfigured: boolean; busy: string; onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown>; authedFetch: (url: string, init?: RequestInit) => Promise<Response>; reload: () => Promise<void>; setError: (value: string) => void; setNotice: (value: string) => void }) {
  async function approveRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onAction({ action: "approve_content_range", accountId: account.id, startDate: data.get("startDate"), endDate: data.get("endDate") }, "The exact scheduled versions in this range were approved and recorded.");
  }
  return (
    <div className="space-y-5">
      <CreatorWorkbench account={account} items={items} drafts={drafts} assets={assets} paid={paid} aiConfigured={aiConfigured} busy={busy} onAction={onAction} authedFetch={authedFetch} reload={reload} setError={setError} setNotice={setNotice} />
      <section className={cardClass}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-lg font-semibold">Scheduled posts</h2><p className="mt-1 text-xs leading-5 text-[#756e64]">Approval locks the current caption, platform, asset, and time. Any later change requires a new approval.</p></div><span className="text-sm text-[#7a7369]">{items.length} total</span></div>
        {items.some((item) => item.scheduled_for && ["draft", "client_review", "revision_requested"].includes(item.status)) ? <form onSubmit={(event) => void approveRange(event)} className="mt-4 grid gap-3 rounded-2xl border border-[#f05a3a]/20 bg-[#fff7f3] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-sm font-medium">Approve from<input required name="startDate" type="date" className={inputClass} /></label><label className="text-sm font-medium">Through<input required name="endDate" type="date" className={inputClass} /></label><button disabled={busy === "approve_content_range"} className={primaryButton}>Approve date range</button></form> : null}
        <div className="mt-4 grid gap-4">
          {items.map((item) => <article key={item.id} className="rounded-2xl border border-[#191714]/10 bg-[#191714]/[.035] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs capitalize text-[#7a7369]">{item.platform.replace("_", " ")} · {formatDate(item.scheduled_for)}</p>{item.approved_snapshot_id ? <p className="mt-2 text-xs font-semibold text-[#8f301f]">Approval v{item.approval_version} recorded</p> : null}</div><StatusPill status={item.status} /></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#5f574e]">{item.caption}</p><div className="mt-4 flex flex-wrap gap-2"><button className={secondaryButton} onClick={() => void navigator.clipboard.writeText(item.caption)}>Copy caption</button>{["client_review","revision_requested","draft"].includes(item.status) ? <><button className={primaryButton} onClick={() => void onAction({ action: "update_content", accountId: account.id, contentId: item.id, status: "approved" }, "The exact post version was approved and the WOVO team was notified.")}>Approve exact version</button><button className={secondaryButton} onClick={() => void onAction({ action: "update_content", accountId: account.id, contentId: item.id, status: "revision_requested", feedback: "Please revise this post." }, "Revision requested.")}>Request revision</button></> : null}{item.approved_snapshot_id && item.status !== "manual_posted" ? <button className={secondaryButton} onClick={() => void onAction({ action: "revoke_content_approval", accountId: account.id, contentId: item.id, reason: "Approval revoked for revision" }, "Approval revoked. The post returned to review.")}>Revoke approval</button> : null}{staff && item.status === "approved" && item.approved_snapshot_id ? <button className={primaryButton} onClick={() => void onAction({ action: "update_content", accountId: account.id, contentId: item.id, status: "manual_posted" }, "Post marked as manually published.")}>Mark posted</button> : null}</div></article>)}
          {!items.length ? <div className="rounded-2xl border border-dashed border-[#191714]/15 p-8 text-center"><p className="font-medium">No posts in the queue yet</p><p className="mt-2 text-sm text-[#7a7369]">Generate a weekly plan or add the first caption manually.</p></div> : null}
        </div>
      </section>
    </div>
  );
}

function Calendar({ account, events, content, busy, staff, onAction }: { account: PortalAccount; events: PortalSnapshot["events"]; content: PortalContentItem[]; busy: string; staff: boolean; onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onAction({ action: "create_event", accountId: account.id, eventType: data.get("eventType"), startsAt: data.get("startsAt"), participantCount: Number(data.get("participantCount")), location: data.get("location") }, "Request received. A WOVO manager will confirm availability and the organization meeting link.");
    event.currentTarget.reset();
  }
  return (
    <div className="space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d94326]">One shared organization</p><h1 className="mt-2 text-3xl font-semibold">Content & consultation calendar</h1><p className="mt-2 text-sm text-[#655f56]">WOVO managers assign qualified staff internally. Clients never book or message individual employees.</p></div>
      <form onSubmit={(event) => void schedule(event)} className={cardClass}><h2 className="text-lg font-semibold">Request a consultation or shoot</h2><p className="mt-1 text-sm text-[#7a7369]">Video calls use an approved external provider with optional camera and screen sharing. One WOVO representative is included; extra participants require a paid add-on.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Type<select name="eventType" className={inputClass}><option value="consultation">30-minute video consultation</option><option value="shoot">On-location shoot request</option></select></label><label className="text-sm">Preferred start<input required name="startsAt" type="datetime-local" className={inputClass} /></label><label className="text-sm">Participants<select name="participantCount" defaultValue="1" className={inputClass}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm">Location for shoots<input name="location" placeholder="Full service location" maxLength={240} className={inputClass} /></label></div><button disabled={busy === "create_event"} className={`${primaryButton} mt-4`}>Submit scheduling request</button></form>
      <section className={cardClass}><h2 className="text-lg font-semibold">Upcoming work</h2><div className="mt-4 space-y-3">{[...events.map((item) => ({ id: item.id, title: item.title, date: item.starts_at, status: item.status, detail: item.meeting_url ? "Secure meeting link ready" : item.travel_estimate_note ?? "Awaiting WOVO confirmation", event: item })), ...content.filter((item) => item.scheduled_for).map((item) => ({ id: item.id, title: item.title, date: item.scheduled_for!, status: item.status, detail: `${item.platform.replace("_", " ")} posting queue`, event: null }))].sort((a,b) => Date.parse(a.date)-Date.parse(b.date)).map((item) => <div key={`${item.event ? "event" : "content"}-${item.id}`} className="flex flex-col justify-between gap-3 rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] p-4 sm:flex-row sm:items-center"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-[#7a7369]">{formatDate(item.date)} · {item.detail}</p>{item.event?.meeting_url ? <a className="mt-2 inline-block text-sm font-semibold text-[#d94326]" href={item.event.meeting_url} target="_blank" rel="noreferrer">Open secure meeting</a> : null}</div><div className="flex flex-wrap gap-2"><StatusPill status={item.status} />{staff && item.event && item.status === "requested" ? <button className={secondaryButton} onClick={() => { const url = window.prompt("Secure HTTPS Google Meet, Zoom, or Teams link"); if (url) void onAction({ action: "update_event", accountId: account.id, eventId: item.id, status: "confirmed", meetingProvider: "other", meetingUrl: url }, "Event confirmed with an organization meeting link."); }}>Confirm link</button> : null}</div></div>)}{!events.length && !content.some((item) => item.scheduled_for) ? <p className="rounded-xl border border-dashed border-[#191714]/15 p-8 text-center text-sm text-[#7a7369]">Nothing scheduled yet. Submit a request or create a posting plan.</p> : null}</div></section>
    </div>
  );
}

function Inbox({ account, thread, messages, assignments, staff, canAssign, busy, onAction }: { account: PortalAccount; thread: PortalThread | null; messages: PortalSnapshot["messages"]; assignments: PortalSnapshot["threadAssignments"]; staff: boolean; canAssign: boolean; busy: string; onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [internal, setInternal] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await onAction({ action: "send_message", accountId: account.id, threadId: thread?.id, message: data.get("message"), visibility: internal ? "internal" : "client" }, internal ? "Internal note added for the WOVO team." : `Message sent. Case ${thread?.case_reference ?? ""}.`);
    form.reset();
  }
  return (
    <div className="space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d94326]">Private shared channel</p><h1 className="mt-2 text-3xl font-semibold">WOVO team inbox</h1><p className="mt-2 text-sm text-[#655f56]">A client-scoped support channel with internal assignment and role visibility—not a public community server.</p>{thread ? <p className="mt-3 font-mono text-sm text-[#a9341f]">Case {thread.case_reference}</p> : null}</div>
      {staff && thread ? <section className={cardClass}><div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-sm font-semibold">Case ownership & status</p><p className="mt-1 text-xs text-[#7a7369]">Assigned to <strong className="text-[#191714]">{thread.assigned_role?.replaceAll("_", " ") ?? "the shared support queue"}</strong> · status <strong className="text-[#191714]">{thread.status.replaceAll("_", " ")}</strong>.</p></div>{canAssign ? <div className="grid gap-2 sm:grid-cols-2"><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onAction({ action: "assign_thread", accountId: account.id, threadId: thread.id, assignedRole: data.get("assignedRole") }, `Case ${thread.case_reference} assigned.`); }}><select name="assignedRole" defaultValue={thread.assigned_role ?? "support"} className={inputClass}><option value="support">Support</option><option value="manager">Manager</option><option value="video_editor">Video editor</option><option value="website_designer">Website designer</option><option value="admin">Admin</option><option value="owner">President / owner</option></select><button disabled={busy === "assign_thread"} className={secondaryButton}>Reassign</button></form><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onAction({ action: "update_thread_status", accountId: account.id, threadId: thread.id, status: data.get("status") }, `Case ${thread.case_reference} status updated.`); }}><select name="status" defaultValue={thread.status} className={inputClass}><option value="open">Open / reopen</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><button disabled={busy === "update_thread_status"} className={secondaryButton}>Save status</button></form></div> : null}</div>{assignments.length ? <details className="mt-4 rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-3 text-sm"><summary className="cursor-pointer font-semibold">Assignment history ({assignments.length})</summary><div className="mt-3 space-y-2 text-xs text-[#6b645b]">{assignments.map((item) => <p key={item.id}>{formatDate(item.created_at)} · assigned to {item.assigned_role?.replaceAll("_", " ") ?? "shared queue"}{item.note ? ` · ${item.note}` : ""}</p>)}</div></details> : <p className="mt-4 text-xs text-[#756e64]">No prior assignment changes.</p>}</section> : null}
      <section className={cardClass}><div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">{messages.map((message) => <article key={message.id} className={`max-w-[92%] rounded-2xl border p-4 sm:max-w-[78%] ${message.sender_label === "Client" ? "ml-auto border-[#f05a3a]/20 bg-[#f05a3a]/10" : message.visibility === "internal" ? "border-amber-300/20 bg-amber-300/10" : "border-[#191714]/10 bg-[#191714]/[.035]"}`}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">{message.visibility === "internal" ? "Internal WOVO note" : message.sender_label}</span><span className="text-[#7a7369]">{formatDate(message.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3f3b35]">{message.body}</p></article>)}{!messages.length ? <div className="rounded-2xl border border-dashed border-[#191714]/15 p-8 text-center"><p className="font-medium">Start the conversation</p><p className="mt-2 text-sm text-[#7a7369]">Ask about a post, booking, website request, restaurant special, or property asset.</p></div> : null}</div><form onSubmit={(event) => void submit(event)} className="mt-5 border-t border-[#191714]/10 pt-5"><textarea required name="message" maxLength={5000} placeholder="Message the WOVO team..." className={textareaClass} />{staff ? <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-[#5f574e]"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Internal note (hidden from client)</label> : null}<button disabled={!thread || busy === "send_message"} className={`${primaryButton} mt-3`}>Send to shared channel</button></form></section>
    </div>
  );
}

function KnowledgeStudio({ account, notes, versions, workflows, busy, onAction }: {
  account: PortalAccount;
  notes: PortalSnapshot["knowledgeNotes"];
  versions: PortalSnapshot["knowledgeNoteVersions"];
  workflows: PortalSnapshot["commentContentWorkflows"];
  busy: string;
  onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
}) {
  const [editingNoteId, setEditingNoteId] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const editingNote = notes.find((note) => note.id === editingNoteId);
  const editingVersion = editingNote
    ? versions.find((version) => version.note_id === editingNote.id && version.version_number === editingNote.current_version)
    : null;
  const approvedNotes = notes.filter((note) => note.status === "approved" && note.approved_version_id && !note.archived_at);

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const approve = submitter?.dataset.approve === "true";
    const result = await onAction({
      action: "save_knowledge_note",
      accountId: account.id,
      noteId: editingNoteId || undefined,
      title: data.get("title"),
      category: data.get("category"),
      guidanceKind: data.get("guidanceKind"),
      body: data.get("body"),
      sourceUrl: data.get("sourceUrl"),
      sourceDate: data.get("sourceDate"),
      changeNote: data.get("changeNote"),
      approve,
    }, approve ? "Approved note saved for factual WOVO context." : "Draft note version saved.");
    if (result) {
      setEditingNoteId("");
      form.reset();
    }
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await onAction({
      action: "save_comment_content_workflow",
      accountId: account.id,
      redactedQuestion: data.get("redactedQuestion"),
      category: data.get("category"),
      outputType: data.get("outputType"),
      sourcePlatform: data.get("sourcePlatform"),
      sourceUrl: data.get("sourceUrl"),
      sourceDate: data.get("sourceDate"),
      draftOutput: data.get("draftOutput"),
      noteIds: selectedNoteIds,
      privacyConfirmed: data.get("privacyConfirmed") === "on",
      status: "brief_ready",
    }, "Private, note-backed content brief saved for human review.");
    if (result) {
      setSelectedNoteIds([]);
      form.reset();
    }
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">WOVO Notes</p>
          <h2 className="mt-2 text-2xl font-semibold">Approved knowledge for your business</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">Store facts, programs, services, event details, history, and voice guidance. AI may use only the explicitly approved version; drafts never become factual context.</p>
        </div>
        <span className="text-sm text-[#655f56]">{approvedNotes.length} approved · {notes.length} total</span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <details className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4" open={notes.length === 0 || Boolean(editingNoteId)}>
          <summary className="cursor-pointer list-none font-semibold">{editingNote ? `Edit ${editingNote.title}` : "Add a business note"}</summary>
          <form key={editingNoteId || "new"} onSubmit={(event) => void saveNote(event)} className="mt-4 space-y-3 border-t border-[#191714]/10 pt-4">
            <label className="text-sm font-medium">Title<input name="title" required minLength={2} maxLength={180} defaultValue={editingVersion?.title ?? ""} className={inputClass} placeholder="For example: Spring food pantry schedule" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Category<select name="category" defaultValue={editingNote?.category ?? "business_facts"} className={inputClass}><option value="business_facts">Business facts</option><option value="programs">Programs</option><option value="locations">Locations</option><option value="services">Services</option><option value="history">History</option><option value="events">Events</option><option value="voice_guidance">Do / don&apos;t say</option><option value="faq">FAQ</option><option value="other">Other</option></select></label>
              <label className="text-sm font-medium">How WOVO should use it<select name="guidanceKind" defaultValue={editingVersion?.guidance_kind ?? "fact"} className={inputClass}><option value="fact">Approved fact</option><option value="context">Background context</option><option value="do_say">Preferred wording</option><option value="dont_say">Avoid this wording</option></select></label>
            </div>
            <label className="text-sm font-medium">Note<textarea name="body" required minLength={3} maxLength={20000} defaultValue={editingVersion?.body ?? ""} className={textareaClass} placeholder="Write the exact, reviewable context WOVO should know. Separate confirmed facts from suggestions." /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Source link, if available<input name="sourceUrl" type="url" maxLength={1000} defaultValue={editingVersion?.source_url ?? ""} className={inputClass} placeholder="https://" /></label>
              <label className="text-sm font-medium">Source date<input name="sourceDate" type="date" defaultValue={editingVersion?.source_date ?? ""} className={inputClass} /></label>
            </div>
            <label className="text-sm font-medium">What changed?<input name="changeNote" maxLength={500} className={inputClass} placeholder="Optional version note" /></label>
            <p className="rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-3 text-xs leading-5 text-[#655f56]">Save draft keeps this version out of AI context. Save &amp; approve marks this exact version as factual context and records who approved it.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button disabled={busy === "save_knowledge_note"} className={secondaryButton}>Save draft</button>
              <button data-approve="true" disabled={busy === "save_knowledge_note"} className={primaryButton}>Save &amp; approve</button>
              {editingNote ? <button type="button" onClick={() => setEditingNoteId("")} className={secondaryButton}>Cancel edit</button> : null}
            </div>
          </form>
        </details>

        <div className="space-y-3">
          {notes.map((note) => {
            const current = versions.find((version) => version.note_id === note.id && version.version_number === note.current_version);
            const approved = versions.find((version) => version.id === note.approved_version_id);
            return <article key={note.id} className="rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">{note.category.replaceAll("_", " ")}</p><h3 className="mt-1 font-semibold">{note.title}</h3></div><StatusPill status={note.status} /></div><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#5f574e]">{current?.body ?? "Version content unavailable."}</p><p className="mt-3 text-xs text-[#756e64]">Current v{note.current_version}{approved ? ` · approved v${approved.version_number}` : " · no approved version"}{approved?.source_url ? " · source retained" : ""}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setEditingNoteId(note.id)} className={secondaryButton}>Edit / new version</button><button type="button" onClick={() => void onAction({ action: "set_knowledge_note_archive", accountId: account.id, noteId: note.id, archive: note.status !== "archived" }, note.status === "archived" ? "Note restored." : "Note archived with history preserved.")} className={secondaryButton}>{note.status === "archived" ? "Restore" : "Archive"}</button></div></article>;
          })}
          {!notes.length ? <p className="rounded-2xl border border-dashed border-[#191714]/15 p-7 text-center text-sm leading-6 text-[#756e64]">No notes yet. Add one confirmed fact or voice guideline to create a trustworthy knowledge base.</p> : null}
        </div>
      </div>

      <details className="mt-5 rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4">
        <summary className="cursor-pointer list-none"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Comment to content</p><h3 className="mt-2 text-xl font-semibold">Turn a public question into a factual review brief</h3><p className="mt-2 text-sm leading-6 text-[#655f56]">Manual intake only. Remove commenter identity and private details, then pair the question with approved Notes. WOVO does not import social comments or auto-reply.</p></summary>
        <form onSubmit={(event) => void saveQuestion(event)} className="mt-5 grid gap-4 border-t border-[#191714]/10 pt-5 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="text-sm font-medium">Redacted public question<textarea name="redactedQuestion" required minLength={5} maxLength={4000} className={textareaClass} placeholder="Paste only the useful question. Remove names, handles, email addresses, phone numbers, and private context." /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Category<select name="category" defaultValue="faq" className={inputClass}><option value="faq">FAQ</option><option value="program">Program</option><option value="service">Service</option><option value="event">Event</option><option value="education">Education</option><option value="myth">Myth / clarification</option><option value="other">Other</option></select></label><label className="text-sm font-medium">Prepare as<select name="outputType" defaultValue="faq_answer" className={inputClass}><option value="faq_answer">FAQ answer</option><option value="social_post">Social post</option><option value="caption">Caption</option><option value="content_theme">Content theme</option></select></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Public source<select name="sourcePlatform" defaultValue="website" className={inputClass}><option value="website">Website</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="other">Other</option></select></label><label className="text-sm font-medium">Source date<input name="sourceDate" type="date" className={inputClass} /></label></div>
            <label className="text-sm font-medium">Public source link, optional<input name="sourceUrl" type="url" maxLength={1000} className={inputClass} placeholder="https://" /></label>
          </div>
          <div className="space-y-3">
            <fieldset className="rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-3"><legend className="px-1 text-sm font-semibold">Approved Notes supporting the facts</legend><div className="mt-2 max-h-44 space-y-2 overflow-y-auto">{approvedNotes.map((note) => <label key={note.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selectedNoteIds.includes(note.id)} onChange={(event) => setSelectedNoteIds((current) => event.target.checked ? [...current, note.id] : current.filter((id) => id !== note.id))} />{note.title}</label>)}{!approvedNotes.length ? <p className="text-xs leading-5 text-[#756e64]">Approve a WOVO Note before marking factual claims as supported.</p> : null}</div></fieldset>
            <label className="text-sm font-medium">Reviewed draft, optional<textarea name="draftOutput" maxLength={10000} className={textareaClass} placeholder="Add or edit the human-reviewed answer here. Without a configured AI runtime, WOVO saves the factual brief only." /></label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-3 text-sm"><input required name="privacyConfirmed" type="checkbox" className="mt-1" /><span>I removed commenter identity and private details. This is a selected public question I am authorized to use for business content.</span></label>
            <button disabled={busy === "save_comment_content_workflow"} className={`${primaryButton} w-full`}>Save factual review brief</button>
          </div>
        </form>
        {workflows.length ? <div className="mt-5 grid gap-3 border-t border-[#191714]/10 pt-5 md:grid-cols-2">{workflows.slice(0, 8).map((workflow) => <article key={workflow.id} className="rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold capitalize">{workflow.output_type.replaceAll("_", " ")}</p><StatusPill status={workflow.status} /></div><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5f574e]">{workflow.redacted_question}</p><p className="mt-3 text-xs text-[#756e64]">{workflow.approved_note_ids.length} approved source note{workflow.approved_note_ids.length === 1 ? "" : "s"} · {workflow.factual_support_status.replaceAll("_", " ")}</p></article>)}</div> : null}
      </details>
    </section>
  );
}

function BuildStudio({ snapshot, account, drafts, ledger, entitlements, notes, noteVersions, commentWorkflows, busy, onAction }: {
  snapshot: PortalSnapshot;
  account: PortalAccount;
  drafts: PortalSnapshot["workflowDrafts"];
  ledger: PortalSnapshot["creditLedger"];
  entitlements: PortalSnapshot["entitlements"];
  notes: PortalSnapshot["knowledgeNotes"];
  noteVersions: PortalSnapshot["knowledgeNoteVersions"];
  commentWorkflows: PortalSnapshot["commentContentWorkflows"];
  busy: string;
  onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
}) {
  const [workflowType, setWorkflowType] = useState<PortalSnapshot["workflowDrafts"][number]["workflow_type"]>("website_site");
  const balance = snapshot.creditAccounts.find((item) => item.account_id === account.id)?.balance ?? 0;
  const dm = entitlements.find((item) => item.entitlement_key === "ai_dm_manager");
  const hosting = entitlements.find((item) => item.entitlement_key === "website_hosting");
  const assistant = entitlements.find((item) => item.entitlement_key === "personal_ai_assistant");

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await onAction({
      action: "create_workflow_draft",
      accountId: account.id,
      workflowType,
      title: data.get("title"),
      brief: data.get("brief"),
      sourceUrl: data.get("sourceUrl"),
      sourceAuthorized: data.get("sourceAuthorized") === "on",
      rightsConfirmed: data.get("rightsConfirmed") === "on",
      peopleConsentConfirmed: data.get("peopleConsentConfirmed") === "on",
      voiceConsentConfirmed: data.get("voiceConsentConfirmed") === "on",
      cadence: data.get("cadence"),
      mode: data.get("mode"),
    }, "Private workflow draft created. Nothing was published or purchased.");
    if (result) form.reset();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d94326]">Private production studio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Build drafts, then approve the next step.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">Every workflow begins as a tenant-private brief. External publishing, phone handling, site hosting, and provider generation stay blocked until the required connection, entitlement, consent, and provisioning checks succeed.</p>
      </div>

      <AiOperator accountId={account.id} />

      <CartoonSeries accountId={account.id} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section className={cardClass}>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Credits</p>
          <p className="mt-3 text-4xl font-semibold">{balance}</p>
          <p className="mt-2 text-sm leading-6 text-[#655f56]">Server-authoritative balance. Purchases and generation costs will appear as idempotent ledger entries.</p>
          {snapshot.setup.expansion.creditPurchaseReady ? <div className="mt-4 grid gap-2" aria-label="Credit packs">{CLIENT_CREDIT_PACKS.map((pack) => <button key={pack.key} className={`${secondaryButton} w-full justify-between`} onClick={() => void onAction({ action: "start_credit_checkout", accountId: account.id, packKey: pack.key }, `Opening secure Stripe Checkout for ${pack.units} credits.`)}><span>{pack.units} credits</span><span>{pack.price}</span></button>)}</div> : <p className="mt-4 rounded-xl bg-[#f7f2e9] p-3 text-xs leading-5 text-[#655f56]">Purchasing is hidden until all three Stripe prices pass the server allowlist. Your existing balance and history remain available.</p>}
        </section>
        {snapshot.setup.expansion.dmManagerCheckoutReady ? <section className={cardClass}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Optional add-on</p><h2 className="mt-2 text-xl font-semibold">AI DM Manager · $1.99/month</h2></div><StatusPill status={dm?.status ?? "inactive"} /></div>
          <p className="mt-3 text-sm leading-6 text-[#655f56]">Draft-reply workflow only. It does not read or send platform messages automatically while official Meta permissions, encrypted tokens, and background jobs remain unverified.</p>
          <button className={`${secondaryButton} mt-4 w-full`}>Manage add-on</button>
        </section> : null}
        {snapshot.setup.expansion.websiteHostingCheckoutReady ? <section className={cardClass}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Optional add-on</p><h2 className="mt-2 text-xl font-semibold">Website hosting · $35/month</h2></div><StatusPill status={hosting?.status ?? "inactive"} /></div>
          <p className="mt-3 text-sm leading-6 text-[#655f56]">Hosting is separate from AI website drafts and covers managed runtime/hosting only after provisioning. It does not imply a custom domain or published site before readiness succeeds.</p>
          {hosting?.current_period_end ? <p className="mt-2 text-xs text-[#756e64]">Current period ends {formatDate(hosting.current_period_end)}{hosting.cancel_at_period_end ? " · cancels at period end" : ""}</p> : null}
          <button className={`${secondaryButton} mt-4 w-full`}>Manage hosting</button>
        </section> : null}
        {snapshot.setup.expansion.personalAssistantCheckoutReady ? <section className={cardClass}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Optional add-on</p><h2 className="mt-2 text-xl font-semibold">Personal AI assistant · $59.99/month</h2></div><StatusPill status={assistant?.status ?? "inactive"} /></div>
          <p className="mt-3 text-sm leading-6 text-[#655f56]">Plain-language booking requests with details, history, status, and a required confirmation before any future outbound action. Launch mode is request/setup only—no autonomous calls or bookings.</p>
          <button className={`${secondaryButton} mt-4 w-full`}>Manage assistant</button>
        </section> : null}
      </div>

      <KnowledgeStudio
        account={account}
        notes={notes}
        versions={noteVersions}
        workflows={commentWorkflows}
        busy={busy}
        onAction={onAction}
      />

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <form onSubmit={(event) => void createDraft(event)} className={cardClass}>
          <h2 className="text-xl font-semibold">Create a private workflow brief</h2>
          <p className="mt-2 text-sm leading-6 text-[#655f56]">This saves an editable draft and alerts the WOVO team. It never scrapes a listing, publishes a site/post, places a call, screens an applicant, or charges credits by itself.</p>
          <div className="mt-5 space-y-3">
            <label className="text-sm font-medium">Workflow<select name="workflowType" value={workflowType} onChange={(event) => setWorkflowType(event.target.value as typeof workflowType)} className={inputClass}>
              <option value="website_site">AI-guided website brief</option>
              <option value="website_page">Product / service page draft</option>
              <option value="listing_ad">Authorized listing-to-ad storyboard</option>
              <option value="post_plan">Daily / weekly posting plan</option>
              <option value="mascot_series">Authorized mascot / cartoon series</option>
              <option value="ugc_ad">Authorized UGC ad brief</option>
              <option value="meeting">Private meeting setup</option>
              <option value="call_agent">After-hours call-agent configuration</option>
              <option value="booking_request">Personal assistant booking request</option>
              <option value="job_posting">Job posting / application intake</option>
            </select></label>
            <label className="text-sm font-medium">Title<input required name="title" minLength={3} maxLength={180} className={inputClass} placeholder="Name this draft" /></label>
            <label className="text-sm font-medium">Source URL, when relevant<input name="sourceUrl" type="url" maxLength={1000} className={inputClass} placeholder="https:// — used as authorized context only; never scraped" /></label>
            <label className="text-sm font-medium">Cadence or mode<input name="cadence" maxLength={80} className={inputClass} placeholder="For example: weekly, approval required" /></label>
            <label className="text-sm font-medium">Brief<textarea required name="brief" minLength={10} maxLength={5000} className={textareaClass} placeholder="Describe the audience, offer, pages/scenes, facts, approved calls to action, and desired result." /></label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm"><input name="sourceAuthorized" type="checkbox" className="mt-1" /><span>I am authorized to supply facts from the source. WOVO may not scrape or reuse unlicensed source media.</span></label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm"><input name="rightsConfirmed" type="checkbox" className="mt-1" /><span>I own or have permission to use every referenced/uploaded asset.</span></label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm"><input name="peopleConsentConfirmed" type="checkbox" className="mt-1" /><span>Every identifiable person consented to the requested use of their likeness.</span></label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm"><input name="voiceConsentConfirmed" type="checkbox" className="mt-1" /><span>Every referenced voice is mine or is used with explicit permission; no impersonation.</span></label>
          </div>
          <button disabled={busy === "create_workflow_draft"} className={`${primaryButton} mt-4 w-full`}>{busy === "create_workflow_draft" ? "Saving…" : "Save private draft"}</button>
        </form>

        <section className={cardClass}>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Draft queue</p><h2 className="mt-2 text-xl font-semibold">Review before external action</h2></div><span className="text-sm text-[#655f56]">{drafts.length} draft{drafts.length === 1 ? "" : "s"}</span></div>
          <div className="mt-5 space-y-3">
            {drafts.map((draft) => <article key={draft.id} className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">{draft.workflow_type.replaceAll("_", " ")}</p><h3 className="mt-1 font-semibold">{draft.title}</h3></div><StatusPill status={draft.status} /></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5f574e]">{draft.brief}</p><p className="mt-3 text-xs text-[#756e64]">{draft.provider_status === "provider_required" ? "WOVO review required" : draft.provider_status.replaceAll("_", " ")} · created {formatDate(draft.created_at)}</p>{draft.published_url ? <a href={draft.published_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center font-bold text-[#d94326]">Open provisioned result</a> : <p className="mt-3 text-xs font-bold text-[#8f301f]">Saved as a private draft.</p>}</article>)}
            {!drafts.length ? <p className="rounded-2xl border border-dashed border-[#191714]/15 p-8 text-center text-sm leading-6 text-[#756e64]">No build drafts yet. Start with a website, authorized ad, posting plan, or provider setup brief.</p> : null}
          </div>
          {ledger.length ? <details className="mt-5 rounded-xl border border-[#191714]/10 p-3 text-sm"><summary className="cursor-pointer font-semibold">Credit ledger ({ledger.length})</summary><div className="mt-3 space-y-2">{ledger.slice(0, 20).map((entry) => <div key={entry.id} className="flex justify-between gap-3 text-xs"><span>{entry.description} · {formatDate(entry.created_at)}</span><strong className={entry.delta > 0 ? "text-[#287044]" : "text-[#8f301f]"}>{entry.delta > 0 ? "+" : ""}{entry.delta} → {entry.balance_after}</strong></div>)}</div></details> : null}
        </section>
      </div>

      <details className={cardClass}>
        <summary className="cursor-pointer list-none"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">Working request tools</p><div className="mt-2 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">What can I prepare here?</h2><span className="text-sm font-bold text-[#d94326]">Expand</span></div></summary>
        <div className="mt-5 grid gap-3 border-t border-[#191714]/10 pt-5 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Posting cadence", "Draft + queue", "Create daily or weekly plans, approve them, and send durable manual posting tasks to WOVO."],
            ["Website concepts", "Editable draft", "Prepare a site or product-page brief from your brand profile and rights-confirmed assets."],
            ["Authorized ad briefs", "Editable draft", "Turn client-supplied listing, mascot, or UGC inputs into a reviewable brief with rights and likeness confirmations."],
            ["Meetings & bookings", "Request intake", "Send a private organization-level request with the details WOVO needs to arrange the next step. Nothing is booked automatically."],
            ["Jobs", "Private intake", "Prepare job-posting or application materials without automated screening or hiring decisions."],
            ["Restaurant readiness", "Validated", "Restaurant generation requires a brand/logo plus at least one rights-confirmed food photo in the private asset library."],
          ].map(([title, status, copy]) => <article key={title} className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-[#191714]/[.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#655f56]">{status}</span></div><p className="mt-2 text-sm leading-6 text-[#655f56]">{copy}</p></article>)}
        </div>
      </details>
    </div>
  );
}

function Services({ account, orders, addons, busy, onAction }: { account: PortalAccount; orders: PortalOrder[]; addons: PortalSnapshot["setup"]["addonsConfigured"]; busy: string; onAction: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onAction({ action: "create_order", accountId: account.id, orderType: data.get("orderType"), description: data.get("description"), location: data.get("location"), requestedFor: data.get("requestedFor") }, "Service request sent to the WOVO operations team.");
    event.currentTarget.reset();
  }
  return (
    <div className="space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d94326]">Profile, billing & services</p><h1 className="mt-2 text-3xl font-semibold">{account.business_name}</h1><p className="mt-2 text-sm text-[#655f56]">Review your business workspace and request human-powered services. High-touch work stays separate from the workspace subscription and requires clear scope, availability, and payment.</p></div>
      <form onSubmit={(event) => void request(event)} className={cardClass}><h2 className="text-lg font-semibold">Request an add-on</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Service<select name="orderType" className={inputClass}><option value="website">Website creation</option><option value="ad_video">AI-assisted product / ad video</option><option value="shoot">In-person shoot</option><option value="drone">Commercial drone package</option></select></label><label className="text-sm">Requested date<input name="requestedFor" type="datetime-local" className={inputClass} /></label><label className="text-sm sm:col-span-2">Location<input name="location" maxLength={240} placeholder="Required for shoots and drone requests" className={inputClass} /></label><label className="text-sm sm:col-span-2">What do you need?<textarea name="description" maxLength={2000} className={textareaClass} /></label></div><div className="mt-4 rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] p-4 text-xs leading-5 text-[#655f56]"><p>Drone requests require advance notice, staff approval, availability/weather/airspace review, and an operational compliance check. Commercial fulfillment in the United States must be handled under applicable FAA Part 107 requirements. Travel is quoted transparently from WOVO's private dispatch point; no flight price is invented and no private address is disclosed.</p></div><button disabled={busy === "create_order"} className={`${primaryButton} mt-4`}>Submit request—no call required</button></form>
      <section className={cardClass}><h2 className="text-lg font-semibold">Orders & payments</h2><div className="mt-4 space-y-3">{orders.map((order) => <div key={order.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] p-4 sm:flex-row sm:items-center"><div><p className="font-medium capitalize">{order.order_type.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-[#7a7369]">{order.description || "Scope pending WOVO review."}</p></div><div className="flex flex-wrap items-center gap-2"><StatusPill status={order.status} />{["checkout_pending","requested"].includes(order.status) && addons[order.order_type] ? <button onClick={() => void onAction({ action: "start_checkout", accountId: account.id, purchaseType: "addon", orderId: order.id }, "Opening secure add-on checkout.")} className={primaryButton}>Pay configured base price</button> : null}</div></div>)}{!orders.length ? <p className="rounded-xl border border-dashed border-[#191714]/15 p-8 text-center text-sm text-[#7a7369]">No add-on orders yet. Submit a scoped request without booking a sales call.</p> : null}</div></section>
    </div>
  );
}
