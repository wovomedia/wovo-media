"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import WovoLogo from "@/components/ui/wovo-logo";
import ClientMetaConnection from "@/app/portal/ClientMetaConnection";
import ClientMetaDelivery from "@/app/portal/ClientMetaDelivery";
import {
  clearSession,
  getActiveSession,
  signOutAndClear,
} from "@/lib/supabase/session-client";
import type {
  PortalAccount,
  PortalContentItem,
  PortalOrder,
  PortalSnapshot,
} from "@/lib/portal/types";

type Tab = "overview" | "queue" | "calendar" | "studio" | "services";
type CreatorMode = "post" | "campaign" | "episode" | "website" | "video" | "music";
type ResumedGenerationIntent = { prompt?: string; type?: string; ratio?: string; modelId?: string; referenceName?: string | null };

const tabs: Array<{ value: Tab; label: string; mark: string }> = [
  { value: "overview", label: "Home", mark: "H" },
  { value: "queue", label: "Create", mark: "+" },
  { value: "calendar", label: "Calendar", mark: "C" },
  { value: "studio", label: "Projects", mark: "P" },
  { value: "services", label: "Settings", mark: "S" },
];

const CLIENT_CREDIT_PACKS = [
  { key: "usd10", units: 110, price: "$10", amount: 10 },
  { key: "usd20", units: 220, price: "$20", amount: 20 },
  { key: "usd50", units: 550, price: "$50", amount: 50 },
  { key: "usd100", units: 1100, price: "$100", amount: 100 },
  { key: "usd500", units: 5500, price: "$500", amount: 500 },
  { key: "usd1000", units: 11000, price: "$1,000", amount: 1000 },
] as const;

const inputClass =
  "mt-1 min-h-12 w-full rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] px-3.5 text-sm text-[#191714] outline-none transition focus:border-[#f05a3a]/60";
const textareaClass = `${inputClass} min-h-28 py-3`;
const studioFieldClass =
  "mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-[#24211f] px-3 text-sm text-white outline-none transition [color-scheme:dark] focus:border-[#f05a3a] focus:ring-2 focus:ring-[#f05a3a]/20";
const cardClass =
  "rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 shadow-[0_20px_80px_rgba(0,0,0,.16)]";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#f05a3a] px-4 text-sm font-semibold text-[#191714] transition hover:bg-[#d94326] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#191714]/15 bg-[#191714]/[.04] px-4 text-sm font-semibold text-[#191714] transition hover:bg-[#f05a3a]/10 disabled:opacity-45";

function formatDate(
  value: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(
    "en-US",
    options ?? {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

type BillingOption = PortalSnapshot["setup"]["billingOptions"][number];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok
      ? "WOVO received an unreadable server response. Please try again."
      : "WOVO could not complete that request. No successful generation was recorded.");
  }
}

function StatusPill({ status }: { status: string }) {
  const positive = [
    "active",
    "trialing",
    "approved",
    "queued",
    "manual_posted",
    "confirmed",
    "paid",
    "completed",
  ].includes(status);
  const warning = [
    "client_review",
    "requested",
    "pending_addon",
    "checkout_pending",
    "quote_required",
    "revision_requested",
  ].includes(status);
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${positive ? "border-[#f05a3a]/25 bg-[#f05a3a]/10 text-[#a9341f]" : warning ? "border-[#c58b21]/35 bg-[#fff3cf] text-[#694616]" : "border-[#191714]/10 bg-[#191714]/[.04] text-[#5f574e]"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function PortalPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [accountId, setAccountId] = useState("");
  const [tab, setTab] = useState<Tab>("queue");
  // Someone who clicked a plan on /pricing arrives with ?plan=…&term=…, and
  // BillingCard preselects from those. Show the plan card immediately for them;
  // for everyone else keep it off the composer so a free customer meets the
  // product before they meet a price.
  const creditBalance = accountId
    ? (snapshot?.creditAccounts.find((item) => item.account_id === accountId)
        ?.balance ?? 0)
    : 0;
  const [arrivedFromPricing] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("plan");
  });
  const [creatorMode, setCreatorMode] = useState<CreatorMode>("post");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resumedIntent, setResumedIntent] = useState<ResumedGenerationIntent | null>(null);

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
    const payload = (await response.json()) as PortalSnapshot & {
      error?: string;
    };
    if (!response.ok)
      throw new Error(payload.error ?? "The portal could not load.");
    setSnapshot(payload);
    setAccountId((current) => {
      return payload.accounts.some(
        (account) => account.id === current && !account.archived_at,
      )
        ? current
        : (payload.accounts.find((account) => !account.archived_at)?.id ?? "");
    });
    setLoading(false);
  }, [authedFetch, router]);

  const signOut = useCallback(async () => {
    await signOutAndClear();
    router.replace("/login?next=/portal");
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const credits = params.get("credits");
    const requestedPack = params.get("buyCredits");
    if (params.get("resume") === "1") {
      try {
        const restored = JSON.parse(localStorage.getItem("wovo-generation-intent") ?? "null") as ResumedGenerationIntent | null;
        if (restored?.prompt) {
          setResumedIntent(restored);
          setTab("queue");
          setCreatorMode(restored.type === "video" ? "video" : restored.type === "audio" ? "music" : restored.type === "cartoon" ? "episode" : restored.type === "social" ? "campaign" : "post");
          setNotice(restored.referenceName
            ? `Your creation settings and prompt were restored. Reconfirm the reference “${restored.referenceName}” before generating.`
            : "Your creation settings and prompt were restored. Review the exact credit quote before generating.");
        }
      } catch {
        localStorage.removeItem("wovo-generation-intent");
      }
    }
    if (checkout === "success")
      setNotice(
        "Payment received. Stripe is confirming your access; the dashboard will refresh automatically.",
      );
    if (checkout === "canceled")
      setNotice("Checkout was canceled. No new purchase was completed.");
    if (credits === "success")
      setNotice("Credit payment received. Stripe is verifying the purchase and will update this workspace ledger automatically.");
    if (credits === "canceled")
      setNotice("Credit checkout was canceled. No credits were purchased.");
    if (requestedPack && CLIENT_CREDIT_PACKS.some((pack) => pack.key === requestedPack || String(pack.amount) === requestedPack)) {
      setTab("studio");
      setNotice("Your one-time credit pack is ready below. Checkout starts only after you choose it again inside your verified workspace.");
    }
    void load().catch((reason) => {
      setLoading(false);
      setError(
        reason instanceof Error ? reason.message : "The portal could not load.",
      );
    });
  }, [load]);

  useEffect(() => {
    if (!snapshot || tab !== "studio" || window.location.hash !== "#credit-packs") return;
    const timer = window.setTimeout(() => document.getElementById("credit-packs")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    return () => window.clearTimeout(timer);
  }, [snapshot, tab]);

  const account =
    snapshot?.accounts.find((item) => item.id === accountId) ?? null;
  const content = useMemo(
    () =>
      snapshot?.content.filter(
        (item) => item.account_id === accountId && !item.archived_at,
      ) ?? [],
    [snapshot, accountId],
  );
  const events = useMemo(
    () =>
      snapshot?.events.filter((item) => item.account_id === accountId) ?? [],
    [snapshot, accountId],
  );
  const orders = useMemo(
    () =>
      snapshot?.orders.filter((item) => item.account_id === accountId) ?? [],
    [snapshot, accountId],
  );
  const assets = useMemo(
    () =>
      snapshot?.assets.filter(
        (item) => item.account_id === accountId && !item.archived_at,
      ) ?? [],
    [snapshot, accountId],
  );
  const workflowDrafts = useMemo(
    () =>
      snapshot?.workflowDrafts.filter(
        (item) => item.account_id === accountId,
      ) ?? [],
    [snapshot, accountId],
  );
  const creditLedger = useMemo(
    () =>
      snapshot?.creditLedger.filter((item) => item.account_id === accountId) ??
      [],
    [snapshot, accountId],
  );
  const entitlements = useMemo(
    () =>
      snapshot?.entitlements.filter((item) => item.account_id === accountId) ??
      [],
    [snapshot, accountId],
  );
  const knowledgeNotes = useMemo(
    () =>
      snapshot?.knowledgeNotes.filter(
        (item) => item.account_id === accountId,
      ) ?? [],
    [snapshot, accountId],
  );
  const knowledgeNoteVersions = useMemo(
    () =>
      snapshot?.knowledgeNoteVersions.filter(
        (item) => item.account_id === accountId,
      ) ?? [],
    [snapshot, accountId],
  );
  const commentContentWorkflows = useMemo(
    () =>
      snapshot?.commentContentWorkflows.filter(
        (item) => item.account_id === accountId,
      ) ?? [],
    [snapshot, accountId],
  );
  const subscription =
    snapshot?.subscriptions.find((item) => item.account_id === accountId) ??
    null;
  const activeGrant = snapshot?.accessGrants.find(
    (grant) =>
      grant.account_id === accountId &&
      !grant.revoked_at &&
      Date.parse(grant.starts_at) <= Date.now() &&
      Date.parse(grant.expires_at) > Date.now(),
  );
  const isPaid =
    ["active", "trialing"].includes(subscription?.status ?? "") ||
    Boolean(activeGrant);

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
      const result = (await response.json()) as {
        error?: string;
        url?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "The request could not be completed.");
      if (result.url) {
        window.location.href = result.url;
        return result;
      }
      setNotice(success);
      await load();
      return result;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The request could not be completed.",
      );
      return null;
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] text-[#191714]">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#191714]/15 border-t-[#f05a3a]"
          aria-label="Loading portal"
        />
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-5 text-[#191714]">
        <div className={`${cardClass} max-w-lg text-center`}>
          <h1 className="text-2xl font-semibold">Portal unavailable</h1>
          <p className="mt-3 text-[#655f56]">
            {error || "Try signing in again."}
          </p>
          <Link href="/login?next=/portal" className={`${primaryButton} mt-5`}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (snapshot.accounts.length === 0) {
    return (
      <PlanOnboarding
        busy={busy}
        error={error}
        onSubmit={async (payload) => {
          await action(
            payload,
            "Your workspace is ready and your 10 starter credits are in it.",
          );
        }}
      />
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0d0c0b] text-[#191714]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0c0b]/92 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-3 sm:px-6">
          <WovoLogo variant="full" size={126} className="" />
          <span className="hidden h-6 w-px bg-white/10 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {account?.business_name}
            </p>
            <p className="truncate text-xs text-white/45">Your WOVO workspace</p>
          </div>
          <button
            className="min-h-11 rounded-xl border border-white/10 px-3 text-sm text-white/65 hover:border-[#f05a3a]/50 hover:text-white"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1900px] gap-4 px-3 py-4 pb-28 sm:px-4 sm:pb-4 lg:grid-cols-[268px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-[#171513] p-3 text-white lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <nav className="hidden space-y-1 sm:block" aria-label="Portal">
            {tabs.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  if (item.value === "queue") setCreatorMode("post");
                  setTab(item.value);
                }}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition ${tab === item.value ? "bg-[#f05a3a] text-[#191714] shadow-sm" : "text-white/55 hover:bg-white/[.06] hover:text-white"}`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black ${tab === item.value ? "bg-[#191714] text-white" : "bg-white/[.07]"}`}
                >
                  {item.mark}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
          {account ? (
            <div className="mt-4 hidden rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">
                WOVO Credits
              </p>
              <p className="mt-2 text-3xl font-semibold leading-none">
                {creditBalance.toLocaleString()}
              </p>
              <p className="mt-2 text-[11px] leading-4 text-white/38">
                Server-authoritative. Every job shows its cost before it runs.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTab("studio");
                  window.requestAnimationFrame(() =>
                    document
                      .getElementById("credit-packs")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-white text-xs font-bold text-black transition hover:bg-white/85"
              >
                Buy credits
              </button>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#111011] p-3 text-[#f7f4ee] sm:p-5">
          {notice ? (
            <div
              role="status"
              className="mb-4 rounded-2xl border border-[#f05a3a]/25 bg-[#f05a3a]/10 p-4 text-sm text-[#ffb9a4]"
            >
              {notice}
            </div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-[#b42318]/40 bg-[#b42318]/12 p-4 text-sm text-[#ffb4a6]"
            >
              {error}
            </div>
          ) : null}
          {!isPaid
          && account
          && (arrivedFromPricing || tab === "overview" || tab === "services") ? (
            <BillingCard
              snapshot={snapshot}
              account={account}
              busy={busy}
              onAction={action}
            />
          ) : null}
          {tab === "overview" && account ? (
            <Overview
              account={account}
              content={content}
              orders={orders}
              assets={assets}
              subscriptionStatus={subscription?.status ?? "inactive"}
              activeGrant={activeGrant ?? null}
              busy={busy}
              onAction={action}
              onNavigate={setTab}
              authedFetch={authedFetch}
              reload={load}
              setError={setError}
              setNotice={setNotice}
            />
          ) : null}
          {tab === "queue" && account ? (
            <Queue
              account={account}
              items={content}
              drafts={workflowDrafts}
              assets={assets}
              creditBalance={
                snapshot.creditAccounts.find(
                  (item) => item.account_id === account.id,
                )?.balance ?? 0
              }
              resumedIntent={resumedIntent}
              creatorMode={creatorMode}
              onCreatorModeChange={setCreatorMode}
              paid={isPaid}
              staff={false}
              busy={busy}
              onAction={action}
              authedFetch={authedFetch}
              reload={load}
              setError={setError}
              setNotice={setNotice}
            />
          ) : null}
          {tab === "calendar" && account ? (
            <Calendar
              account={account}
              events={events}
              content={content}
              busy={busy}
              staff={false}
              onAction={action}
            />
          ) : null}
          {tab === "studio" && account ? (
            <BuildStudio
              snapshot={snapshot}
              account={account}
              drafts={workflowDrafts}
              ledger={creditLedger}
              entitlements={entitlements}
              notes={knowledgeNotes}
              noteVersions={knowledgeNoteVersions}
              commentWorkflows={commentContentWorkflows}
              busy={busy}
              onAction={action}
            />
          ) : null}
          {tab === "services" && account ? (
            <Services
              account={account}
              orders={orders}
              addons={snapshot.setup.addonsConfigured}
              busy={busy}
              onAction={action}
            />
          ) : null}
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#0d0c0b]/95 px-1 pb-2 pt-1.5 shadow-[0_-16px_42px_rgba(0,0,0,.5)] backdrop-blur-xl sm:hidden"
        aria-label="Mobile workspace"
      >
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              if (item.value === "queue") setCreatorMode("post");
              setTab(item.value);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-current={tab === item.value ? "page" : undefined}
            className={`min-h-14 rounded-xl px-1 text-[10px] font-bold leading-3 transition ${tab === item.value ? "bg-[#f05a3a]/15 text-[#ff8c70]" : "text-white/55"}`}
          >
            <span
              className={`mx-auto mb-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-[9px] ${tab === item.value ? "bg-[#f05a3a] text-[#191714]" : "bg-white/10"}`}
            >
              {item.mark}
            </span>
            <span className="block">{item.label}</span>
          </button>
        ))}
      </nav>

      <footer className="border-t border-[#191714]/10 px-4 py-7 text-sm text-[#7a7369]">
        <div className="mx-auto flex max-w-[1800px] flex-col justify-between gap-4 sm:flex-row">
          <p>
            WOVO — your work, your workspace.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms-of-use" className="hover:text-[#191714]">
              Terms
            </Link>
            <Link href="/privacy-policy" className="hover:text-[#191714]">
              Privacy
            </Link>
            <Link
              href="/cancellation-refund-policy"
              className="hover:text-[#191714]"
            >
              Cancellation & refunds
            </Link>
            <Link href="/contact" className="hover:text-[#191714]">
              Contact & support
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

const WORKSPACE_BUSINESS_TYPES: Array<[string, string]> = [
  ["local_business", "Local business"],
  ["restaurant", "Restaurant or food"],
  ["contractor", "Contractor or trades"],
  ["realtor", "Real estate"],
  ["other", "Something else"],
];

const WORKSPACE_PLATFORMS: Array<[string, string]> = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"],
  ["google_business", "Google Business"],
];

// The only job of this screen is to create the workspace and release the ten
// one-time starter credits. It asks for nothing WOVO cannot use immediately,
// and it never asks for a plan or a card: a customer has to be able to make
// something before being asked to pay for anything. The wizard this replaced
// collected plan tiers, add-ons, employee invites and a website brief before a
// single credit had been spent.
function PlanOnboarding({
  busy,
  error,
  onSubmit,
}: {
  busy: string;
  error: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("local_business");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [cadence, setCadence] = useState(3);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [rights, setRights] = useState(false);
  const [localError, setLocalError] = useState("");

  function togglePlatform(id: string) {
    setPlatforms((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    if (!businessName.trim()) {
      setLocalError("Add your business name so WOVO can put it on your work.");
      return;
    }
    if (!location.trim()) {
      setLocalError("Add the city or area you serve.");
      return;
    }
    if (!rights) {
      setLocalError(
        "Confirm you own or have permission to use the material you upload.",
      );
      return;
    }
    await onSubmit({
      action: "onboard",
      businessName: businessName.trim(),
      businessType,
      location: location.trim(),
      websiteUrl: websiteUrl.trim() || undefined,
      cadence,
      platforms,
      rightsConfirmed: true,
    });
  }

  const message = localError || error;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b0b0c] text-[#f7f4ee]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(240,90,58,.16),transparent_70%)]"
      />

      <header className="relative flex min-h-16 items-center px-5 sm:px-8">
        <WovoLogo variant="full" size={112} className="brightness-0 invert" />
      </header>

      <div className="relative flex flex-1 justify-center px-4 py-6 sm:px-6 sm:py-10">
        <form onSubmit={submit} className="w-full max-w-[540px]">
          <div className="rounded-[28px] border border-white/12 bg-[#151516] p-6 shadow-[0_32px_100px_rgba(0,0,0,.5)] sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff7659]">
              One quick step
            </p>
            <h1 className="mt-3 text-[2.1rem] font-medium leading-[1.05] tracking-[-.045em]">
              Set up your workspace.
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/45">
              WOVO puts your business name, place and platforms on everything it
              makes for you. Your 10 free credits are released the moment this is
              saved — no card, no plan to pick.
            </p>

            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="text-xs font-semibold text-white/70">
                  Business name
                </span>
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  maxLength={120}
                  autoComplete="organization"
                  placeholder="Columbia Auto"
                  className={studioFieldClass}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-white/70">
                  What kind of business is it?
                </span>
                <select
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                  className={studioFieldClass}
                >
                  {WORKSPACE_BUSINESS_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-white/70">
                  City or area you serve
                </span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  maxLength={240}
                  placeholder="Columbia, MO"
                  className={studioFieldClass}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-white/70">
                  Website{" "}
                  <span className="font-normal text-white/35">(optional)</span>
                </span>
                <input
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  maxLength={300}
                  inputMode="url"
                  placeholder="columbiaauto.com"
                  className={studioFieldClass}
                />
              </label>

              <div>
                <span className="text-xs font-semibold text-white/70">
                  Where do you post?{" "}
                  <span className="font-normal text-white/35">(optional)</span>
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WORKSPACE_PLATFORMS.map(([value, label]) => {
                    const on = platforms.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePlatform(value)}
                        className={`inline-flex min-h-10 items-center rounded-xl border px-3.5 text-xs font-semibold transition ${on ? "border-[#f05a3a] bg-[#f05a3a]/12 text-[#ff8c70]" : "border-white/12 bg-white/[.03] text-white/55 hover:border-white/25 hover:text-white"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-white/70">
                  Roughly how many posts a week?
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={cadence === value}
                      onClick={() => setCadence(value)}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold transition ${cadence === value ? "border-[#f05a3a] bg-[#f05a3a] text-[#140b08]" : "border-white/12 bg-white/[.03] text-white/55 hover:border-white/25 hover:text-white"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-white/32">
                  A starting point for planning. You can change it any time.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(event) => setRights(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#f05a3a]"
                />
                <span className="text-xs leading-5 text-white/55">
                  I own, or have permission to use, the logos, photos and other
                  material I bring into WOVO.
                </span>
              </label>
            </div>

            {message ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-[#b42318]/35 bg-[#b42318]/10 p-3.5 text-sm text-[#ffb4a6]"
              >
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy === "onboard"}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-sm font-black text-[#140b08] transition hover:bg-[#ff7659] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy === "onboard"
                ? "Setting up your workspace…"
                : "Create workspace and claim 10 credits"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function BillingPeriodSelector({
  options,
  value,
  onChange,
  dark = false,
}: {
  options: BillingOption[];
  value: BillingOption["frequency"];
  onChange: (value: BillingOption["frequency"]) => void;
  dark?: boolean;
}) {
  return (
    <div
      className="mt-4 grid gap-2"
      role="radiogroup"
      aria-label="Billing period"
    >
      {options.map((option) => {
        const selected = option.frequency === value;
        return (
          <button
            key={option.frequency}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.frequency)}
            className={`min-h-16 w-full rounded-xl border px-3 py-2.5 text-left transition ${selected ? (dark ? "border-[#ff8c72] bg-white/10" : "border-[#f05a3a] bg-[#f05a3a]/10") : dark ? "border-white/15 hover:border-white/35" : "border-[#191714]/12 hover:border-[#f05a3a]/45"}`}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <strong className="block text-sm">{option.label}</strong>
                <span
                  className={`mt-1 block text-xs ${dark ? "text-white/55" : "text-[#6d665d]"}`}
                >
                  {formatMoney(option.amountCents)} due today ·{" "}
                  {formatMoney(option.effectiveMonthlyCents)}/month effective
                </span>
              </span>
              {option.savingsCents > 0 ? (
                <span
                  className={`shrink-0 text-xs font-bold ${dark ? "text-[#ff8c72]" : "text-[#a9341f]"}`}
                >
                  Save {option.savingsPercent}%
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BillingPlanSelector({ options, value, onChange, dark = false }: { options: BillingOption[]; value: BillingOption["planId"]; onChange: (value: BillingOption["planId"]) => void; dark?: boolean }) {
  const plans = (["starter", "creator", "pro"] as const).map((planId) => options.find((option) => option.planId === planId)).filter((option): option is BillingOption => Boolean(option));
  return <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="WOVO plan">{plans.map((option) => <button key={option.planId} type="button" role="radio" aria-checked={option.planId === value} onClick={() => onChange(option.planId)} className={`min-h-14 rounded-xl border px-2 text-left ${option.planId === value ? (dark ? "border-[#ff8c72] bg-white/10" : "border-[#f05a3a] bg-[#f05a3a]/10") : dark ? "border-white/15" : "border-[#191714]/12"}`}><strong className="block text-xs">{option.planName}</strong><span className={`mt-1 block text-[10px] ${dark ? "text-white/50" : "text-[#6d665d]"}`}>{option.monthlyCredits} credits/mo</span></button>)}</div>;
}

function BillingCard({
  snapshot,
  account,
  busy,
  onAction,
}: {
  snapshot: PortalSnapshot;
  account: PortalAccount;
  busy: string;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
}) {
  const [billingPlan, setBillingPlan] = useState<BillingOption["planId"]>(() => {
    if (typeof window === "undefined") return "starter";
    const value = new URLSearchParams(window.location.search).get("plan");
    return value === "creator" || value === "pro" ? value : "starter";
  });
  const [billingFrequency, setBillingFrequency] =
    useState<BillingOption["frequency"]>(() => {
      if (typeof window === "undefined") return "monthly";
      const value = new URLSearchParams(window.location.search).get("term");
      return value === "quarterly" || value === "semiannual" || value === "annual" ? value : "monthly";
    });
  const selected =
    snapshot.setup.billingOptions.find(
      (option) => option.planId === billingPlan && option.frequency === billingFrequency,
    ) ??
    snapshot.setup.billingOptions.find((option) => option.planId === billingPlan) ??
    null;
  return (
    <section className={`${cardClass} mb-5 border-[#f05a3a]/20`}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d94326]">
            When you want more than 10 credits
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.03em]">
            A plan adds monthly credits.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f574e]">
            Your workspace already works. Everything you make is yours to
            download, and your starter credits do not expire. A plan simply adds
            credits every month so you can keep going without buying packs.
          </p>
          <p className="mt-3 text-xs leading-5 text-[#7a7369]">
            Stripe displays the final price and renewal cadence before payment.
            Cancel future renewal from the visible Manage billing button; timing
            of access and refund eligibility follow the posted policy and Stripe
            checkout terms.
          </p>
        </div>
        <div className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4">
          <BillingPlanSelector options={snapshot.setup.billingOptions} value={billingPlan} onChange={setBillingPlan} />
          <BillingPeriodSelector
            options={snapshot.setup.billingOptions.filter((option) => option.planId === billingPlan)}
            value={selected?.frequency ?? "monthly"}
            onChange={setBillingFrequency}
          />
          <div className="mt-4 flex items-end justify-between border-t border-[#191714]/10 pt-4">
            <span className="text-xs font-semibold text-[#655f56]">
              Due today
            </span>
            <strong className="text-3xl">
              {selected ? formatMoney(selected.amountCents) : "—"}
            </strong>
          </div>
          <button
            disabled={!selected || busy === "start_checkout"}
            onClick={() =>
              void onAction(
                {
                  action: "start_checkout",
                  accountId: account.id,
                  purchaseType: "subscription",
                  planConfirmed: true,
                  planId: selected?.planId,
                  billingFrequency: selected?.frequency,
                },
                "Opening secure Stripe checkout.",
              )
            }
            className={`${primaryButton} mt-4 w-full`}
          >
            {selected
              ? "Continue to secure checkout"
              : "Billing setup required"}
          </button>
        </div>
      </div>
    </section>
  );
}

function Overview({
  account,
  content,
  orders,
  assets,
  subscriptionStatus,
  activeGrant,
  busy,
  onAction,
  onNavigate,
  authedFetch,
  reload,
  setError,
  setNotice,
}: {
  account: PortalAccount;
  content: PortalContentItem[];
  orders: PortalOrder[];
  assets: PortalSnapshot["assets"];
  subscriptionStatus: string;
  activeGrant: PortalSnapshot["accessGrants"][number] | null;
  busy: string;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
  onNavigate: (tab: Tab) => void;
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  reload: () => Promise<void>;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
}) {
  const weekEnd = Date.now() + 7 * 86400000;
  const thisWeek = content.filter(
    (item) =>
      item.scheduled_for &&
      Date.parse(item.scheduled_for) <= weekEnd &&
      Date.parse(item.scheduled_for) >= Date.now() - 86400000,
  );
  const posted = content.filter((item) => item.status === "manual_posted");
  const awaiting = content.filter((item) =>
    ["client_review", "approved", "queued"].includes(item.status),
  );
  const hasBrandAsset = assets.some(
    (item) => item.asset_kind === "brand" && item.rights_confirmed,
  );
  const hasFoodAsset = assets.some(
    (item) => item.asset_kind === "food" && item.rights_confirmed,
  );
  const missingRequiredAssets =
    !hasBrandAsset || (account.business_type === "restaurant" && !hasFoodAsset);
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
      const preparedPayload = (await prepared.json()) as {
        error?: string;
        bucket?: string;
        path?: string;
        token?: string;
      };
      if (
        !prepared.ok ||
        !preparedPayload.path ||
        !preparedPayload.token ||
        !preparedPayload.bucket
      ) {
        throw new Error(preparedPayload.error ?? "Unable to prepare upload.");
      }
      const storage = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      setNotice(`Uploading ${file.name} privately...`);
      const { error: uploadError } = await storage.storage
        .from(preparedPayload.bucket)
        .uploadToSignedUrl(preparedPayload.path, preparedPayload.token, file, {
          contentType: file.type,
        });
      if (uploadError) throw uploadError;
      const finalized = await authedFetch("/api/portal/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          path: preparedPayload.path,
          ...metadata,
        }),
      });
      const finalizedPayload = (await finalized.json()) as { error?: string };
      if (!finalized.ok)
        throw new Error(
          finalizedPayload.error ?? "Upload verification failed.",
        );
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
    const result = await onAction(
      {
        action: "update_account_profile",
        accountId: account.id,
        brandVoice: data.get("brandVoice"),
        audience: data.get("audience"),
        goals: data.get("goals"),
        cadence: Number(data.get("cadence")),
        platforms: data.getAll("platforms"),
      },
      "Brand profile updated for future WOVO drafts.",
    );
    if (result) await reload();
  }
  const profileReady = Boolean(
    account.brand_voice && account.audience && account.goals,
  );
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#191714] p-5 text-white shadow-[0_24px_80px_rgba(25,23,20,.16)] sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff8c70]">
          {account.business_name}
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-medium leading-tight tracking-[-.035em] sm:text-5xl">
          What do you want WOVO to handle?
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
          Describe the job in your own words and WOVO routes it — an image, a
          video, a caption, a plan for the week. Every job shows its exact credit
          cost before it runs.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("queue")}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-6 text-sm font-black text-[#140b08] transition hover:bg-[#ff7659]"
        >
          Open the composer
        </button>
      </section>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Primary workspace actions"
      >
        {[
          [
            "Create content",
            "Draft a post or build the next review queue.",
            "queue",
          ],
          [
            "Upload brand assets",
            "Add a logo, photo, menu, or approved reference.",
            "assets",
          ],
          [
            "View schedule",
            `${thisWeek.length} item${thisWeek.length === 1 ? "" : "s"} planned this week.`,
            "calendar",
          ],
          [
            "Your projects",
            "Media, drafts and revisions you have already made.",
            "studio",
          ],
        ].map(([title, copy, target]) => (
          <button
            key={title}
            type="button"
            onClick={() =>
              target === "assets"
                ? document
                    .getElementById("brand-assets")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                : onNavigate(target as Tab)
            }
            className="group min-h-36 rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left text-[#f7f4ee] transition hover:-translate-y-0.5 hover:border-[#f05a3a]/45 hover:bg-white/[.06]"
          >
            <p className="font-semibold">{title}</p>
            <p className="mt-2 text-sm leading-6 text-white/50">{copy}</p>
            <span className="mt-4 inline-flex text-xs font-bold uppercase tracking-[.12em] text-[#d94326]">
              Open →
            </span>
          </button>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <details className={cardClass}>
          <summary className="cursor-pointer list-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
                  Brand profile
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  How WOVO should sound and plan
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#655f56]">
                  {account.brand_voice || "Add a clear voice"} ·{" "}
                  {account.audience || "define the audience"}
                </p>
              </div>
              <StatusPill
                status={profileReady ? "complete" : "needs details"}
              />
            </div>
            <p className="mt-4 text-sm font-bold text-[#d94326]">
              Edit profile
            </p>
          </summary>
          <form
            onSubmit={(event) => void saveProfile(event)}
            className="mt-5 space-y-3 border-t border-[#191714]/10 pt-5"
          >
            <label className="text-sm font-medium">
              Brand voice
              <textarea
                required
                name="brandVoice"
                defaultValue={account.brand_voice ?? ""}
                maxLength={1000}
                className={textareaClass}
                placeholder="For example: confident, plainspoken, warm, never pushy"
              />
            </label>
            <label className="text-sm font-medium">
              Audience
              <textarea
                required
                name="audience"
                defaultValue={account.audience ?? ""}
                maxLength={1000}
                className={textareaClass}
                placeholder="Who they are, their age range, needs, and local context"
              />
            </label>
            <label className="text-sm font-medium">
              Marketing goal
              <textarea
                required
                name="goals"
                defaultValue={account.goals ?? ""}
                maxLength={1500}
                className={textareaClass}
                placeholder="What should this month's content help accomplish?"
              />
            </label>
            <label className="text-sm font-medium">
              Weekly cadence
              <select
                name="cadence"
                defaultValue={account.posting_cadence_per_week}
                className={inputClass}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                  <option key={value} value={value}>
                    {value} post{value === 1 ? "" : "s"} per week
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="text-sm font-medium">Platforms</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "instagram",
                  "facebook",
                  "google_business",
                  "linkedin",
                  "tiktok",
                  "youtube",
                ].map((platform) => (
                  <label
                    key={platform}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#191714]/10 px-3 text-sm"
                  >
                    <input
                      name="platforms"
                      value={platform}
                      type="checkbox"
                      defaultChecked={account.preferred_platforms.includes(
                        platform,
                      )}
                    />
                    {platform.replace("_", " ")}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              disabled={busy === "update_account_profile"}
              className={`${primaryButton} w-full sm:w-auto`}
            >
              Save brand profile
            </button>
          </form>
        </details>

        <section className={`${cardClass} flex flex-col justify-between`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
              This week at a glance
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Only what needs attention
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f05a3a]/10 px-3 py-2 text-sm font-semibold text-[#8f301f]">
                {awaiting.length} awaiting action
              </span>
              <span className="rounded-full bg-[#191714]/[.05] px-3 py-2 text-sm">
                {posted.length} posted
              </span>
              <span className="rounded-full bg-[#191714]/[.05] px-3 py-2 text-sm">
                {
                  orders.filter(
                    (order) =>
                      !["fulfilled", "canceled", "refunded"].includes(
                        order.status,
                      ),
                  ).length
                }{" "}
                service requests
              </span>
            </div>
          </div>
          <div className="mt-5 border-t border-[#191714]/10 pt-4 text-sm leading-6 text-[#655f56]">
            <p>
              <strong className="text-[#191714]">Posting queue</strong> means
              drafts waiting for review, approval, scheduling, or a WOVO team
              posting task.
            </p>
            {activeGrant ? (
              <p className="mt-2">
                <strong className="text-[#191714]">
                  Temporary {activeGrant.grant_type.replace("_", " ")} access
                </strong>{" "}
                is active through {formatDate(activeGrant.expires_at)}. This
                audited owner grant does not change the Stripe subscription,
                which remains {subscriptionStatus.replace("_", " ")}.
              </p>
            ) : (
              <p className="mt-2">
                <strong className="text-[#191714]">Billing</strong> stays
                separate from add-ons. The core workspace is{" "}
                {subscriptionStatus.replace("_", " ")}.
              </p>
            )}
            {["active", "trialing"].includes(subscriptionStatus) ? (
              <button
                onClick={() =>
                  void onAction(
                    { action: "billing_portal", accountId: account.id },
                    "Opening Stripe billing.",
                  )
                }
                disabled={busy === "billing_portal"}
                className={`${secondaryButton} mt-4`}
              >
                Billing & cancellation
              </button>
            ) : null}
          </div>
        </section>
      </section>

      {missingRequiredAssets ? (
        <div className="rounded-2xl border border-[#c58b21]/35 bg-[#fff3cf] p-4 text-sm leading-6 text-[#50360f]">
          <p className="font-semibold">One short setup step remains.</p>
          <p className="mt-1">
            Every workspace needs a rights-confirmed brand/logo. Restaurant
            workspaces also need at least one rights-confirmed food photo before
            AI generation. Uploads stay private by default.
          </p>
        </div>
      ) : null}

      <details
        id="brand-assets"
        className={`${cardClass} scroll-mt-24`}
        open={missingRequiredAssets}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
                Private brand library
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Upload only what WOVO may use
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#655f56]">
                Assets are your logo, photos, videos, menus, property material,
                and references. They remain tenant-private unless you explicitly
                approve a public result.
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold text-[#d94326]">
              {assets.length} stored · Add asset
            </span>
          </div>
        </summary>
        <form
          onSubmit={(event) => void upload(event)}
          className="mt-5 space-y-3 border-t border-[#191714]/10 pt-5"
        >
          <label className="block cursor-pointer rounded-2xl border border-dashed border-[#f05a3a]/45 bg-[#fff7f3] p-6 text-center">
            <span className="block font-semibold">
              Choose a photo, video, logo, menu, or reference
            </span>
            <span className="mt-2 block text-xs leading-5 text-[#756e64]">
              Images/PDFs up to 10 MB · MP4/WebM/QuickTime up to 100 MB
            </span>
            <input
              required
              name="file"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
              className="mx-auto mt-4 block max-w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#191714] file:px-4 file:py-2.5 file:font-semibold file:text-white"
            />
          </label>
          <label className="text-sm font-medium">
            What is this?
            <select name="kind" className={inputClass}>
              <option value="brand">Brand / logo</option>
              <option value="food">Food photo</option>
              <option value="menu">Menu</option>
              <option value="property">Authorized property</option>
              <option value="project">Project</option>
              <option value="reference">Reference</option>
            </select>
          </label>
          <details className="rounded-xl border border-[#191714]/10 p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Permissions required before upload
            </summary>
            <p className="mt-2 text-xs leading-5 text-[#756e64]">
              These confirmations protect your business, the people shown, and
              WOVO. They are stored with the private asset record.
            </p>
            <div className="mt-3 space-y-2">
              <label className="flex min-h-12 items-start gap-2 rounded-xl bg-[#f7f2e9] p-3 text-sm">
                <input
                  required
                  name="rightsConfirmed"
                  type="checkbox"
                  className="mt-1"
                />
                I own or have permission to use this asset.
              </label>
              <label className="flex min-h-12 items-start gap-2 rounded-xl bg-[#f7f2e9] p-3 text-sm">
                <input
                  required
                  name="peopleConsentConfirmed"
                  type="checkbox"
                  className="mt-1"
                />
                I have consent for every identifiable person, likeness, and
                voice depicted.
              </label>
            </div>
          </details>
          <button className={`${primaryButton} w-full sm:w-auto`}>
            Upload privately
          </button>
        </form>
        <p className="mt-4 text-xs text-[#7a7369]">
          Brand/logo: {hasBrandAsset ? "ready" : "required"}
          {account.business_type === "restaurant"
            ? ` · restaurant food photo: ${hasFoodAsset ? "ready" : "required"}`
            : ""}
          . Nothing here is publicly indexed.
        </p>
      </details>

      <section className="rounded-2xl border border-[#191714]/10 bg-white/60 p-4 text-sm leading-6 text-[#655f56]">
        <p>
          <strong className="text-[#191714]">Where things live:</strong>{" "}
          the composer makes the work, Projects holds everything you have made,
          and anything scheduled shows up on Calendar.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate("studio")}
            className="font-bold text-[#d94326]"
          >
            Open Build & automate
          </button>
        </div>
      </section>
    </div>
  );
}

type WorkbenchProject = {
  id: string;
  title: string;
  kind: string;
  status: string;
  date: string;
  source: "content" | "workflow" | "video" | "music";
  caption?: string;
  brief?: string;
  generated?: Record<string, unknown>;
  publishedUrl?: string | null;
};

function mediaUrls(value?: Record<string, unknown>) {
  if (!value) return [] as string[];
  const found: string[] = [];
  const visit = (entry: unknown) => {
    if (
      typeof entry === "string" &&
      /^https:\/\//.test(entry) &&
      (/\.(mp4|webm|mov|png|jpe?g|webp|mp3|wav|ogg|m4a)(\?|$)/i.test(entry) ||
        /\/api\/wovo\/(video|music)\/[0-9a-f-]+(?:\?|$)/i.test(entry))
    )
      found.push(entry);
    else if (Array.isArray(entry)) entry.forEach(visit);
    else if (entry && typeof entry === "object")
      Object.values(entry).forEach(visit);
  };
  visit(value);
  return [...new Set(found)].slice(0, 6);
}

const CREATOR_MODES: Array<{
  value: CreatorMode;
  label: string;
  eyebrow: string;
}> = [
  { value: "post", label: "Post", eyebrow: "Ready-to-review caption" },
  {
    value: "campaign",
    label: "Campaign",
    eyebrow: "Multi-post planning brief",
  },
  {
    value: "episode",
    label: "Character episode",
    eyebrow: "Rights-confirmed series brief",
  },
  {
    value: "website",
    label: "Website preview",
    eyebrow: "Private concept brief",
  },
  {
    value: "video",
    label: "AI video",
    eyebrow: "Metered WOVO AI video render",
  },
  {
    value: "music",
    label: "AI music",
    eyebrow: "Playable commercial-use audio",
  },
];

function CreatorWorkbench({
  account,
  items,
  drafts,
  assets,
  creditBalance,
  mode,
  onModeChange,
  busy,
  onAction,
  authedFetch,
  reload,
  setError,
  setNotice,
  initialPrompt,
}: {
  account: PortalAccount;
  items: PortalContentItem[];
  drafts: PortalSnapshot["workflowDrafts"];
  assets: PortalSnapshot["assets"];
  creditBalance: number;
  mode: CreatorMode;
  onModeChange: (mode: CreatorMode) => void;
  paid: boolean;
  busy: string;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  reload: () => Promise<void>;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
  initialPrompt?: string;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [channel, setChannel] = useState("download");
  const [format, setFormat] = useState("single_post");
  const [aspect, setAspect] = useState("9:16");
  const [surface, setSurface] = useState<"light" | "dark">("light");
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatingMedia, setGeneratingMedia] = useState(false);
  const [videoJobs, setVideoJobs] = useState<Array<{
    id: string; status: string; prompt: string; result_url: string | null;
    created_at: string; result_payload?: Record<string, unknown> | null;
  }>>([]);
  const [musicJobs, setMusicJobs] = useState<Array<{
    id: string; status: string; prompt: string; mediaUrl: string | null;
    createdAt: string; quality: string; durationSeconds: number;
  }>>([]);
  const [selectedProject, setSelectedProject] =
    useState<WorkbenchProject | null>(null);
  const [projectMessage, setProjectMessage] = useState("");
  const [projectReply, setProjectReply] = useState("");
  const [projectAttachment, setProjectAttachment] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [socialDestinations, setSocialDestinations] = useState<Array<{
    id: string;
    provider: "facebook" | "instagram" | "tiktok" | "youtube";
    accountName: string;
    status: string;
  }>>([]);
  const imageAssets = assets.filter(
    (asset) => asset.mime_type.startsWith("image/") && asset.rights_confirmed,
  );
  const activeMode =
    CREATOR_MODES.find((item) => item.value === mode) ?? CREATOR_MODES[0];
  const refreshMediaJobs = useCallback(async () => {
    const [videoResponse, musicResponse] = await Promise.all([
      authedFetch(`/api/wovo/video?accountId=${encodeURIComponent(account.id)}`),
      authedFetch(`/api/wovo/music?accountId=${encodeURIComponent(account.id)}`),
    ]);
    const videoPayload = videoResponse.ok
      ? await videoResponse.json() as { jobs?: typeof videoJobs }
      : { jobs: [] as typeof videoJobs };
    const musicPayload = musicResponse.ok
      ? await musicResponse.json() as { jobs?: typeof musicJobs }
      : { jobs: [] as typeof musicJobs };
    const videos = videoPayload.jobs ?? [];
    const music = musicPayload.jobs ?? [];
    const refreshedVideos = await Promise.all(videos.map(async (job) => {
      if (!["queued", "processing"].includes(job.status)) return job;
      const response = await authedFetch(`/api/wovo/video/${encodeURIComponent(job.id)}`);
      if (!response.ok) return job;
      const payload = await response.json() as { job?: typeof job };
      return payload.job ?? job;
    }));
    const refreshedMusic = await Promise.all(music.map(async (job) => {
      if (!["queued", "processing"].includes(job.status)) return job;
      const response = await authedFetch(`/api/wovo/music/${encodeURIComponent(job.id)}`);
      if (!response.ok) return job;
      const payload = await response.json() as { job?: typeof job };
      return payload.job ?? job;
    }));
    setVideoJobs(refreshedVideos);
    setMusicJobs(refreshedMusic);
  }, [account.id, authedFetch]);

  useEffect(() => {
    let active = true;
    const refresh = () => void refreshMediaJobs().catch(() => {
      if (!active) return;
    });
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshMediaJobs]);

  const recentOutputs = [
    ...videoJobs.slice(0, 6).map((job) => ({
      id: job.id,
      title: `AI video · ${(job.prompt || "Untitled video").slice(0, 72)}`,
      kind: "AI video",
      status: job.status,
      date: job.created_at,
      source: "video" as const,
      brief: job.prompt || "Private AI video render",
      generated: job.result_url ? { video: job.result_url } : undefined,
    })),
    ...musicJobs.slice(0, 6).map((job) => ({
      id: job.id,
      title: `AI music · ${(job.prompt || "Untitled track").slice(0, 72)}`,
      kind: `${job.quality} music`,
      status: job.status,
      date: job.createdAt,
      source: "music" as const,
      brief: job.prompt || "Private AI music render",
      generated: job.mediaUrl ? { audio: job.mediaUrl } : undefined,
    })),
    ...items.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.platform,
      status: item.status,
      date: item.created_at,
      source: "content" as const,
      caption: item.caption,
    })),
    ...drafts.slice(0, 4).map((draft) => ({
      id: draft.id,
      title: draft.title,
      kind: draft.workflow_type.replaceAll("_", " "),
      status: draft.status,
      date: draft.created_at,
      source: "workflow" as const,
      brief: draft.brief,
      generated: draft.generated_output,
      publishedUrl: draft.published_url,
    })),
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 6);

  async function uploadProjectAttachment(file: File) {
    if (!file.type.startsWith("image/"))
      throw new Error("Paste or choose a JPG, PNG, or WebP logo/reference.");
    const metadata = {
      accountId: account.id,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      assetKind: "brand",
      rightsConfirmed: true,
      peopleConsentConfirmed: true,
    };
    const prepared = await authedFetch("/api/portal/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare", ...metadata }),
    });
    const payload = (await prepared.json()) as {
      error?: string;
      bucket?: string;
      path?: string;
      token?: string;
    };
    if (!prepared.ok || !payload.bucket || !payload.path || !payload.token)
      throw new Error(payload.error ?? "Unable to prepare attachment.");
    const storage = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: uploadError } = await storage.storage
      .from(payload.bucket)
      .uploadToSignedUrl(payload.path, payload.token, file, {
        contentType: file.type,
      });
    if (uploadError) throw uploadError;
    const finalized = await authedFetch("/api/portal/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "finalize",
        path: payload.path,
        ...metadata,
      }),
    });
    const finished = (await finalized.json()) as {
      error?: string;
      asset?: { id: string };
    };
    if (!finalized.ok || !finished.asset?.id)
      throw new Error(finished.error ?? "Attachment verification failed.");
    setProjectAttachment({ id: finished.asset.id, name: file.name });
  }

  async function askAdamAboutProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !projectMessage.trim()) return;
    setProjectBusy(true);
    setProjectReply("");
    setError("");
    try {
      const response = await authedFetch("/api/portal/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          projectId: selectedProject.id,
          source: selectedProject.source,
          message: projectMessage,
          attachmentId: projectAttachment?.id,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        reply?: string;
      };
      if (!response.ok || !payload.reply)
        throw new Error(payload.error ?? "Adam could not answer.");
      setProjectReply(payload.reply);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Adam could not answer.",
      );
    } finally {
      setProjectBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    void authedFetch(
      `/api/integrations/social/connections?accountId=${encodeURIComponent(account.id)}`,
    )
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{
              connections?: Array<{ id: string; provider: "facebook" | "instagram" | "tiktok" | "youtube"; accountName: string; status: string }>;
            }>)
          : null,
      )
      .then((payload) => {
        if (active) setSocialDestinations((payload?.connections ?? []).filter((item) => !["action_required", "expired", "disconnected", "error"].includes(item.status)));
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [account.id, authedFetch]);

  function selectMode(nextMode: CreatorMode) {
    onModeChange(nextMode);
  }

  useEffect(() => {
    if (mode === "video") {
      setChannel("download");
      setFormat("vertical_video");
      setAspect("9:16");
    } else if (mode === "website") {
      setChannel("website");
      setFormat("landing_page");
      setAspect("16:9");
    } else if (mode === "episode") {
      setChannel("download");
      setFormat("vertical_episode");
      setAspect("9:16");
    } else if (mode === "campaign") {
      setChannel("download");
      setFormat("campaign_plan");
      setAspect("1:1");
    } else if (mode === "music") {
      setChannel("download");
      setFormat("instrumental");
      setAspect("audio");
    } else {
      setChannel("download");
      setFormat("single_post");
      setAspect("1:1");
    }
  }, [mode]);

  const connectedChannelChoices = socialDestinations
    .filter((connection) => mode !== "post" || connection.provider === "facebook" || connection.provider === "instagram")
    .map((connection) => ({
      value: `${connection.provider}:${connection.id}`,
      label: `${connection.provider === "youtube" ? "YouTube" : connection.provider[0].toUpperCase() + connection.provider.slice(1)} · ${connection.accountName}`,
    }));
  const channelChoices = mode === "website"
    ? [{ value: "website", label: "Website preview" }]
    : mode === "music"
      ? [{ value: "download", label: "Download track" }]
      : [{ value: "download", label: "Download only" }, ...connectedChannelChoices];
  const formatChoices =
    mode === "website"
      ? [
          { value: "landing_page", label: "Landing page" },
          { value: "storefront", label: "Storefront" },
          { value: "services_site", label: "Services" },
          { value: "portfolio", label: "Portfolio" },
        ]
      : mode === "music"
        ? [
            { value: "instrumental", label: "Instrumental" },
            { value: "jingle", label: "Brand jingle" },
            { value: "soundtrack", label: "Video soundtrack" },
          ]
      : mode === "episode"
        ? [
            { value: "vertical_episode", label: "Vertical episode" },
            { value: "storyboard", label: "Storyboard" },
            { value: "character_card", label: "Character card" },
          ]
        : mode === "video"
          ? [
              { value: "vertical_video", label: "Reel / Short" },
              { value: "video_ad", label: "Video ad" },
              { value: "story_video", label: "Story" },
            ]
          : mode === "campaign"
            ? [
                { value: "campaign_plan", label: "Campaign plan" },
                { value: "launch_sequence", label: "Launch sequence" },
                { value: "weekly_series", label: "Weekly series" },
              ]
            : [
                { value: "single_post", label: "Single post" },
                { value: "carousel", label: "Carousel" },
                { value: "story", label: "Story" },
              ];
  const aspectChoices =
    mode === "music"
      ? [{ value: "audio", label: "Audio track" }]
      : mode === "website"
      ? [
          { value: "16:9", label: "Desktop" },
          { value: "9:16", label: "Mobile" },
        ]
      : mode === "video" || mode === "episode"
        ? [
            { value: "9:16", label: "Vertical" },
            { value: "16:9", label: "Landscape" },
          ]
        : [
            { value: "1:1", label: "Square" },
            { value: "9:16", label: "Portrait" },
            { value: "16:9", label: "Landscape" },
          ];

  async function uploadFrame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/"))
      return setError("Choose a JPG, PNG, or WebP start frame.");
    setError("");
    setUploading(true);
    setNotice("Preparing a private reference upload…");
    const metadata = {
      accountId: account.id,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      assetKind: "reference",
      rightsConfirmed: form.get("rightsConfirmed") === "on",
      peopleConsentConfirmed: form.get("peopleConsentConfirmed") === "on",
    };
    try {
      const prepared = await authedFetch("/api/portal/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", ...metadata }),
      });
      const payload = (await prepared.json()) as {
        error?: string;
        bucket?: string;
        path?: string;
        token?: string;
      };
      if (!prepared.ok || !payload.bucket || !payload.path || !payload.token)
        throw new Error(
          payload.error ?? "Unable to prepare the private upload.",
        );
      const storage = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { error: uploadError } = await storage.storage
        .from(payload.bucket)
        .uploadToSignedUrl(payload.path, payload.token, file, {
          contentType: file.type,
        });
      if (uploadError) throw uploadError;
      const finalized = await authedFetch("/api/portal/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          path: payload.path,
          ...metadata,
        }),
      });
      const finished = (await finalized.json()) as { error?: string };
      if (!finalized.ok)
        throw new Error(finished.error ?? "Upload verification failed.");
      formElement.reset();
      setNotice(
        "Reference frame stored privately. Select it in the video brief when the list refreshes.",
      );
      await reload();
    } catch (reason) {
      setNotice("");
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const prompt = String(data.get("prompt") ?? "").trim();
    const title =
      String(data.get("title") ?? "").trim() ||
      `${CREATOR_MODES.find((item) => item.value === mode)?.label ?? "Creative"} · ${prompt.slice(0, 64)}`;
    const rightsConfirmed = data.get("rightsConfirmed") === "on";
    if (mode === "post") {
      const selectedProvider = channel.includes(":") ? channel.split(":")[0] : "instagram";
      if (!["facebook", "instagram"].includes(selectedProvider)) {
        setError("Image posts can currently be prepared for Facebook or Instagram. Choose Video for TikTok or YouTube.");
        return;
      }
      setError("");
      setNotice("Writing the caption and rendering an original image…");
      setGeneratingPost(true);
      try {
        const response = await authedFetch("/api/portal/generate-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.id,
            title,
            prompt,
            platform: selectedProvider,
            destinationConnectionId: channel.includes(":") ? channel.split(":")[1] : null,
            aspect,
            scheduledFor: data.get("scheduledFor"),
            rightsConfirmed,
          }),
        });
        const payload = await readJsonResponse<{
          error?: string;
          previewUrl?: string | null;
        }>(response);
        if (!response.ok)
          throw new Error(payload.error ?? "The post could not be generated.");
        setNotice(
          "Caption and image created together. Review the exact post before approving or scheduling it.",
        );
        form.reset();
        await reload();
      } catch (reason) {
        setNotice("");
        setError(
          reason instanceof Error
            ? reason.message
            : "The post could not be generated.",
        );
      } finally {
        setGeneratingPost(false);
      }
      return;
    }
    if (mode === "music") {
      setError("");
      setNotice("Submitting a private, metered WOVO AI music render…");
      setGeneratingMedia(true);
      try {
        const quality = data.get("musicQuality") === "premium" ? "premium" : "economy";
        const response = await authedFetch("/api/wovo/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.id,
            prompt: `${format.replaceAll("_", " ")}. ${prompt}`,
            quality,
            durationSeconds: Number(data.get("musicDuration") ?? 60),
          }),
        });
        const payload = await readJsonResponse<{ error?: string; job?: { id: string }; reservedCredits?: number; ownerExempt?: boolean }>(response);
        if (!response.ok || !payload.job?.id) throw new Error(payload.error ?? "The music render could not start.");
        setNotice(payload.ownerExempt
          ? "Your private music render started. It will appear here when WOVO finishes."
          : `${payload.reservedCredits ?? 0} credits reserved. The playable track will appear here when WOVO finishes.`);
        form.reset();
        await refreshMediaJobs();
      } catch (reason) {
        setNotice("");
        setError(reason instanceof Error ? reason.message : "The music render could not start.");
      } finally {
        setGeneratingMedia(false);
      }
      return;
    }
    if (mode === "video" || mode === "episode") {
      setError("");
      setNotice("Submitting a private, metered WOVO AI video render…");
      setGeneratingMedia(true);
      try {
        const characterName = String(data.get("characterName") ?? "").trim();
        const characterPersonality = String(data.get("characterPersonality") ?? "").trim();
        const episodeGoal = String(data.get("episodeGoal") ?? "").trim();
        const renderPrompt = mode === "episode"
          ? `Animated vertical cartoon episode. Character: ${characterName || "an original recurring character"}. Personality: ${characterPersonality || "warm and expressive"}. Episode goal: ${episodeGoal || prompt}. Creative direction: ${prompt}. Do not add protected logos or recognizable people unless they are present in an approved reference.`
          : prompt;
        const response = await authedFetch("/api/wovo/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.id,
            prompt: renderPrompt,
            remixMode: "standard",
          }),
        });
        const payload = await readJsonResponse<{ error?: string; job?: { id: string }; reserved_credits?: number }>(response);
        if (!response.ok || !payload.job?.id) throw new Error(payload.error ?? "The video render could not start.");
        setNotice(`${payload.reserved_credits ?? 0} credits reserved. The playable video will appear here when WOVO finishes.`);
        form.reset();
        await refreshMediaJobs();
      } catch (reason) {
        setNotice("");
        setError(reason instanceof Error ? reason.message : "The video render could not start.");
      } finally {
        setGeneratingMedia(false);
      }
      return;
    }
    const workflowType =
      mode === "campaign"
        ? "post_plan"
        : "website_site";
    const result = await onAction(
      {
        action: "create_workflow_draft",
        accountId: account.id,
        workflowType,
        title,
        brief: prompt,
        rightsConfirmed,
        sourceAuthorized: rightsConfirmed,
        peopleConsentConfirmed: data.get("peopleConsentConfirmed") === "on",
        voiceConsentConfirmed: data.get("voiceConsentConfirmed") === "on",
        cadence: data.get("cadence"),
        mode,
        channel: String(data.get("channel") ?? "download").split(":")[0],
        destinationConnectionId: String(data.get("channel") ?? "").includes(":")
          ? String(data.get("channel")).split(":")[1]
          : null,
        outputFormat: data.get("format"),
        aspect: data.get("aspect"),
        style: data.get("style"),
        durationSeconds: data.get("duration"),
        startFrameAssetId: data.get("startFrameAssetId") || null,
      },
      "Private creation brief saved for review. Nothing was published.",
    );
    if (result) form.reset();
  }

  const actionLabel = mode === "post"
    ? "Generate post + image"
    : mode === "music"
      ? "Generate playable music"
      : mode === "video" || mode === "episode"
        ? "Generate AI video"
        : "Save draft";
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0f0e0d] text-white shadow-[0_28px_90px_rgba(0,0,0,.35)]">
      <header className="flex flex-col gap-4 border-b border-white/10 bg-[#0f0e0d] px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#d94326]">
            WOVO Creative Studio
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-.04em] sm:text-[2.7rem]">
            Describe what you want Adam to create.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Create a private, reviewable draft. Nothing publishes or starts a
            paid media render from this screen.
          </p>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] lg:min-w-72">
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">
              Credits
            </p>
            <p className="mt-1 text-lg font-semibold">{creditBalance}</p>
          </div>
          <div className="border-l border-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">
              Draft status
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-[#f05a3a]" />
              Review first
            </p>
          </div>
        </div>
      </header>

      <div className="bg-[#171513] text-white">
        <nav
          className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 sm:px-5"
          role="tablist"
          aria-label="Creation mode"
        >
          {CREATOR_MODES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={mode === item.value}
              onClick={() => selectMode(item.value)}
              className={`min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold transition ${mode === item.value ? "bg-[#f05a3a] text-[#191714] shadow-[0_8px_24px_rgba(240,90,58,.22)]" : "text-white/60 hover:bg-white/[.06] hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <form onSubmit={(event) => void submit(event)} className="p-3 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_240px]">
            <aside
              className="order-2 space-y-4 rounded-2xl border border-white/10 bg-[#201d1b] p-3 xl:order-1"
              aria-label="Project controls"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ff8c70]">
                  Project setup
                </p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Choose where this draft is designed to work.
                </p>
              </div>
              <input type="hidden" name="channel" value={channel} />
              <input type="hidden" name="format" value={format} />
              <input type="hidden" name="aspect" value={aspect} />
              <fieldset>
                <legend className="text-xs font-semibold text-white/65">
                  Destination
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {channelChoices.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={channel === choice.value}
                      onClick={() => setChannel(choice.value)}
                      className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition ${channel === choice.value ? "border-[#f05a3a] bg-[#f05a3a] text-[#191714]" : "border-white/10 bg-white/[.04] text-white/65 hover:border-white/25"}`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold text-white/65">
                  {mode === "website"
                    ? "Site type"
                    : mode === "music"
                      ? "Track type"
                    : mode === "episode"
                      ? "Episode output"
                      : mode === "campaign"
                        ? "Campaign structure"
                        : "Format"}
                </legend>
                <div className="mt-2 grid gap-2">
                  {formatChoices.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={format === choice.value}
                      onClick={() => setFormat(choice.value)}
                      className={`min-h-10 rounded-xl border px-3 text-left text-xs font-semibold transition ${format === choice.value ? "border-[#f05a3a] bg-[#f05a3a]/15 text-[#ff9b82]" : "border-white/10 bg-white/[.04] text-white/65 hover:border-white/25"}`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold text-white/65">
                  {mode === "music" ? "Output" : "Canvas"}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {aspectChoices.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={aspect === choice.value}
                      onClick={() => setAspect(choice.value)}
                      className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition ${aspect === choice.value ? "border-[#f05a3a] bg-[#f05a3a]/15 text-[#ff9b82]" : "border-white/10 bg-white/[.04] text-white/65"}`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {mode === "website" ? (
                <fieldset>
                  <legend className="text-xs font-semibold text-white/65">
                    Preview theme
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={surface === "light"}
                      onClick={() => setSurface("light")}
                      className={`min-h-11 rounded-xl border bg-[#fffdf8] text-xs font-bold text-[#191714] ${surface === "light" ? "border-[#f05a3a] ring-2 ring-[#f05a3a]/25" : "border-white/10"}`}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      aria-pressed={surface === "dark"}
                      onClick={() => setSurface("dark")}
                      className={`min-h-11 rounded-xl border bg-[#11100f] text-xs font-bold text-white ${surface === "dark" ? "border-[#f05a3a] ring-2 ring-[#f05a3a]/25" : "border-white/10"}`}
                    >
                      Dark
                    </button>
                  </div>
                </fieldset>
              ) : null}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">Media source</p>
                  <span className="rounded-full bg-[#f05a3a]/15 px-2 py-1 text-[10px] font-bold text-[#ff9b82]">WOVO AI</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  {mode === "music"
                    ? "Generate a playable track, store it privately in WOVO, then download it or use it in a later music-video project."
                    : mode === "video" || mode === "episode"
                      ? "This starts a real 720p WOVO AI video render. The result is stored privately and credits are returned if generation fails."
                      : mode === "post"
                        ? "Every new post includes an original generated image saved privately with its caption for approval."
                        : "This workflow saves a structured brief first; no provider render is started."}
                </p>
                <div className="mt-3 flex min-h-11 items-center rounded-xl border border-[#f05a3a] bg-[#f05a3a]/12 p-3 text-xs font-semibold text-[#ff9b82]">
                  {mode === "music"
                    ? "Generate playable audio"
                    : mode === "video" || mode === "episode"
                      ? "Generate a real AI video"
                      : mode === "post"
                        ? "Generate a new image"
                        : "Save a reviewable brief"}
                </div>
              </div>
            </aside>

            <div className="order-1 min-w-0 xl:order-2">
              <div className="overflow-hidden rounded-[22px] border border-white/12 bg-[#24211f] shadow-[0_24px_70px_rgba(0,0,0,.28)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ff8c70]">
                      {activeMode.label}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {activeMode.eyebrow}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/50">
                    <span className="rounded-full border border-white/10 px-2.5 py-1">
                      {channel}
                    </span>
                    <span className="rounded-full border border-[#f05a3a]/35 bg-[#f05a3a]/10 px-2.5 py-1 text-[#ff9b82]">
                      {aspect}
                    </span>
                  </div>
                </div>
                <div className="grid min-h-[390px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_150px] lg:p-6">
                  <label className="flex min-w-0 flex-col text-sm font-semibold text-white">
                    Creative direction
                    <textarea
                      key={initialPrompt ?? "blank-prompt"}
                      required
                      name="prompt"
                      defaultValue={initialPrompt}
                      minLength={10}
                      maxLength={5000}
                      className="mt-3 min-h-56 flex-1 resize-y rounded-2xl border border-white/10 bg-[#171513] p-4 text-base font-normal leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-[#f05a3a] focus:ring-2 focus:ring-[#f05a3a]/15"
                      placeholder={
                        mode === "episode"
                          ? "Introduce the character, setting, episode beats, and approved call to action…"
                          : mode === "music"
                            ? "Describe the genre, mood, instruments, tempo, structure, and where this track will be used…"
                          : mode === "website"
                            ? "Describe the offer, audience, hero message, sections, and primary action…"
                            : mode === "video"
                              ? "Describe the opening frame, subject motion, camera movement, scene beats, and ending…"
                              : "Describe the idea, audience, offer, tone, and what should happen next…"
                      }
                    />
                    <span className="mt-2 text-xs font-normal leading-5 text-white/40">
                      Use approved facts and assets only. Adam will save the
                      result for review.
                    </span>
                  </label>
                  <div
                    className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-[#1b1917] p-4 text-center"
                    aria-label={`${activeMode.label} preview`}
                  >
                    {mode === "music" ? (
                      <div className="w-full rounded-2xl border border-[#f05a3a]/40 bg-gradient-to-br from-[#f05a3a]/20 to-transparent p-3">
                        <div className="flex h-24 items-center justify-center gap-1" aria-hidden="true">
                          {[28, 52, 78, 42, 88, 60, 34, 70, 96, 48, 74, 38].map((height, index) => (
                            <span key={`${height}-${index}`} className="w-1.5 rounded-full bg-[#f05a3a]" style={{ height: `${height}%`, opacity: .55 + (index % 3) * .18 }} />
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-white/45">
                          <span>00:00</span><span>WOVO AUDIO</span>
                        </div>
                      </div>
                    ) : mode === "website" ? (
                      <div
                        className={`w-full overflow-hidden rounded-lg border border-[#f05a3a]/50 shadow-xl ${surface === "light" ? "bg-[#fffdf8] text-[#191714]" : "bg-[#11100f] text-white"}`}
                      >
                        <div className="flex items-center gap-1 border-b border-current/10 px-2 py-1.5">
                          <i className="h-1.5 w-1.5 rounded-full bg-[#f05a3a]" />
                          <i className="h-1.5 w-1.5 rounded-full bg-current/20" />
                          <i className="h-1.5 w-1.5 rounded-full bg-current/20" />
                        </div>
                        <div className="p-3 text-left">
                          <div className="h-1.5 w-10 rounded bg-[#f05a3a]" />
                          <div className="mt-2 h-2 w-4/5 rounded bg-current/70" />
                          <div className="mt-1 h-1.5 w-3/5 rounded bg-current/20" />
                          <div className="mt-3 h-12 rounded bg-[#f05a3a]/15" />
                        </div>
                      </div>
                    ) : mode === "episode" ? (
                      <div className="relative h-36 w-24 rounded-[20px] border-2 border-[#f05a3a] bg-gradient-to-b from-[#f05a3a]/35 to-[#2a201d] p-2 shadow-xl">
                        <div className="mx-auto mt-3 h-12 w-12 rounded-full border border-white/30 bg-white/10" />
                        <div className="mt-3 h-1.5 rounded bg-white/60" />
                        <div className="mt-1 h-1.5 w-2/3 rounded bg-white/20" />
                        <span className="absolute bottom-2 right-2 rounded-full bg-[#f05a3a] px-1.5 py-0.5 text-[8px] font-bold text-[#191714]">
                          EP 01
                        </span>
                      </div>
                    ) : mode === "video" ? (
                      <div
                        className={`relative border-2 border-[#f05a3a] bg-[#2a201d] shadow-xl ${aspect === "9:16" ? "h-36 w-20 rounded-[18px]" : "h-20 w-36 rounded-xl"}`}
                      >
                        <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#f05a3a] text-sm text-[#191714]">
                          ▶
                        </span>
                        <span className="absolute bottom-2 left-2 text-[8px] font-bold text-white/60">
                          START → END
                        </span>
                      </div>
                    ) : mode === "campaign" ? (
                      <div className="grid w-full grid-cols-2 gap-2">
                        <div className="col-span-2 h-8 rounded-lg border border-[#f05a3a]/40 bg-[#f05a3a]/15" />
                        <div className="h-16 rounded-lg border border-white/10 bg-white/[.05]" />
                        <div className="h-16 rounded-lg border border-white/10 bg-white/[.05]" />
                      </div>
                    ) : (
                      <div
                        className={`border-2 border-[#f05a3a] bg-[#f05a3a]/8 shadow-[0_0_0_5px_rgba(240,90,58,.08)] ${aspect === "9:16" ? "h-32 w-[72px] rounded-xl" : aspect === "16:9" ? "h-[72px] w-32 rounded-lg" : "h-28 w-28 rounded-xl"}`}
                      />
                    )}
                    <p className="mt-4 text-xs font-semibold">
                      {mode === "website"
                        ? `${surface} ${format.replaceAll("_", " ")}`
                        : mode === "music"
                          ? format.replaceAll("_", " ")
                        : `${aspect} ${activeMode.label.toLowerCase()}`}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-white/35">
                      A layout preview for this specific creation workflow.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-expanded={advanced}
                onClick={() => setAdvanced((value) => !value)}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[#ff9b82] hover:text-white"
              >
                <span aria-hidden="true">{advanced ? "−" : "+"}</span>
                {advanced ? "Hide project details" : "Add project details"}
              </button>
              {advanced ? (
                <div className="mt-2 grid gap-3 rounded-2xl border border-white/10 bg-[#201d1b] p-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-white/65">
                    Internal title
                    <input
                      name="title"
                      maxLength={180}
                      className={studioFieldClass}
                      placeholder="Optional project title"
                    />
                  </label>
                  <label className="text-xs font-semibold text-white/65">
                    Style / motion
                    <select name="style" className={studioFieldClass}>
                      <option value="editorial">Editorial and composed</option>
                      <option value="energetic">Energetic movement</option>
                      <option value="cinematic">
                        Cinematic and restrained
                      </option>
                      <option value="playful">Playful character motion</option>
                      <option value="product">Product-focused</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-white/65">
                    Hashtags
                    <input
                      name="hashtags"
                      maxLength={300}
                      className={studioFieldClass}
                      placeholder="#marketing #localbusiness"
                    />
                  </label>
                  <label className="text-xs font-semibold text-white/65">
                    Schedule
                    <input
                      name="scheduledFor"
                      type="datetime-local"
                      className={studioFieldClass}
                    />
                  </label>
                  <label className="text-xs font-semibold text-white/65">
                    Cadence
                    <input
                      name="cadence"
                      maxLength={80}
                      className={studioFieldClass}
                      placeholder="One-time or weekly"
                    />
                  </label>
                </div>
              ) : null}
              {mode === "episode" ? (
                <div className="mt-3 grid gap-3 rounded-2xl border border-[#f05a3a]/25 bg-[#f05a3a]/8 p-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-white/65">
                    Character name
                    <input
                      name="characterName"
                      maxLength={100}
                      className={studioFieldClass}
                      placeholder="Mrs. Hellen, Boots…"
                    />
                  </label>
                  <label className="text-xs font-semibold text-white/65">
                    Personality
                    <input
                      name="characterPersonality"
                      maxLength={300}
                      className={studioFieldClass}
                      placeholder="Warm, funny, direct…"
                    />
                  </label>
                  <label className="text-xs font-semibold text-white/65 sm:col-span-2">
                    Episode goal
                    <textarea
                      name="episodeGoal"
                      maxLength={1200}
                      className={`${studioFieldClass} min-h-24 py-3`}
                      placeholder="What happens, what viewers learn, and how the episode ends"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-white/65">
                      Approved logo or character reference
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="characterAssetId"
                          value=""
                          defaultChecked
                          className="peer sr-only"
                        />
                        <span className="flex min-h-11 items-center rounded-xl border border-white/10 px-3 text-xs text-white/60 peer-checked:border-[#f05a3a] peer-checked:text-[#ff9b82]">
                          No reference selected
                        </span>
                      </label>
                      {imageAssets.map((asset) => (
                        <label key={asset.id} className="cursor-pointer">
                          <input
                            type="radio"
                            name="characterAssetId"
                            value={asset.id}
                            className="peer sr-only"
                          />
                          <span className="flex min-h-11 items-center truncate rounded-xl border border-white/10 px-3 text-xs text-white/60 peer-checked:border-[#f05a3a] peer-checked:text-[#ff9b82]">
                            {asset.file_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {mode === "music" ? (
                <div className="mt-3 grid gap-4 rounded-2xl border border-[#f05a3a]/25 bg-[#f05a3a]/8 p-4 lg:grid-cols-2">
                  <fieldset>
                    <legend className="text-xs font-semibold text-white/65">Music model</legend>
                    <div className="mt-2 grid gap-2">
                      <label className="cursor-pointer">
                        <input type="radio" name="musicQuality" value="economy" defaultChecked className="peer sr-only" />
                        <span className="block rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs text-white/60 peer-checked:border-[#f05a3a] peer-checked:bg-[#f05a3a]/12 peer-checked:text-white">
                          <strong className="block text-sm">Fast track · CassetteAI</strong>
                          <span className="mt-1 block leading-5 text-white/45">2 credits per started minute · up to 3 minutes</span>
                        </span>
                      </label>
                      <label className="cursor-pointer">
                        <input type="radio" name="musicQuality" value="premium" className="peer sr-only" />
                        <span className="block rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs text-white/60 peer-checked:border-[#f05a3a] peer-checked:bg-[#f05a3a]/12 peer-checked:text-white">
                          <strong className="block text-sm">Studio track · Stable Audio 2.5</strong>
                          <span className="mt-1 block leading-5 text-white/45">13 credits · richer fixed-price render</span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-xs font-semibold text-white/65">Length</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[30, 60, 120, 180].map((seconds) => (
                        <label key={seconds} className="cursor-pointer">
                          <input type="radio" name="musicDuration" value={seconds} defaultChecked={seconds === 60} className="peer sr-only" />
                          <span className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-xs font-bold text-white/60 peer-checked:border-[#f05a3a] peer-checked:text-[#ff9b82]">
                            {seconds < 60 ? `${seconds}s` : `${seconds / 60} min`}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-white/40">Commercial-use provider models. WOVO stores the result privately; you remain responsible for the prompt and intended use.</p>
                  </fieldset>
                </div>
              ) : null}
              {mode === "video" ? (
                <div className="mt-3 rounded-2xl border border-[#f05a3a]/25 bg-[#f05a3a]/8 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f05a3a]" />
                    <div>
                      <p className="text-sm font-semibold">
                        Storyboard workflow active
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/55">
                        Build the exact shot brief and approved reference
                        package before spending credits on a provider render.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[.04] p-3">
                    <p className="text-xs font-semibold text-white/65">Model-set short clip</p>
                    <p className="mt-1 text-[11px] leading-5 text-white/40">
                      Wan Turbo controls the final clip length. WOVO verifies 720p output and never promises an exact runtime the provider does not accept.
                    </p>
                  </div>
                  <fieldset className="mt-4">
                    <legend className="text-xs font-semibold text-white/65">
                      Private start frame
                    </legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="startFrameAssetId"
                          value=""
                          defaultChecked
                          className="peer sr-only"
                        />
                        <span className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[.04] px-3 text-xs text-white/60 peer-checked:border-[#f05a3a] peer-checked:text-[#ff9b82]">
                          No start frame
                        </span>
                      </label>
                      {imageAssets.map((asset) => (
                        <label key={asset.id} className="cursor-pointer">
                          <input
                            type="radio"
                            name="startFrameAssetId"
                            value={asset.id}
                            className="peer sr-only"
                          />
                          <span className="flex min-h-11 items-center truncate rounded-xl border border-white/10 bg-white/[.04] px-3 text-xs text-white/60 peer-checked:border-[#f05a3a] peer-checked:text-[#ff9b82]">
                            {asset.file_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : null}
              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-[#201d1b] p-4">
                <label className="flex min-h-11 items-start gap-2 text-sm text-white/75">
                  <input
                    required
                    name="rightsConfirmed"
                    type="checkbox"
                    className="mt-1 accent-[#f05a3a]"
                  />
                  <span>
                    I own or have permission to use every supplied reference and
                    business fact.
                  </span>
                </label>
                {["episode", "video"].includes(mode) ? (
                  <>
                    <label className="flex min-h-11 items-start gap-2 text-sm text-white/75">
                      <input
                        required
                        name="peopleConsentConfirmed"
                        type="checkbox"
                        className="mt-1 accent-[#f05a3a]"
                      />
                      <span>
                        I have permission for every recognizable person or
                        likeness.
                      </span>
                    </label>
                    <label className="flex min-h-11 items-start gap-2 text-sm text-white/75">
                      <input
                        required
                        name="voiceConsentConfirmed"
                        type="checkbox"
                        className="mt-1 accent-[#f05a3a]"
                      />
                      <span>
                        I have permission for every referenced voice; no
                        impersonation.
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            </div>

            <aside
              className="order-3 rounded-2xl border border-white/10 bg-[#201d1b] p-3"
              aria-label="Output gallery"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ff8c70]">
                    Output gallery
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Saved in this workspace
                  </p>
                </div>
                <span className="text-xs font-semibold text-white/55">
                  {recentOutputs.length}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {recentOutputs.slice(0, 4).map((item) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProject(item);
                      setProjectReply("");
                      setProjectMessage("");
                      setProjectAttachment(null);
                    }}
                    key={item.id}
                    className="group rounded-xl border border-white/8 bg-white/[.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#f05a3a]/55"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[.1em] text-white/35">
                        {item.kind}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f05a3a]" />
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-[11px] capitalize text-[#ff9b82]">
                      {item.status.replaceAll("_", " ")} · Open →
                    </p>
                  </button>
                ))}
                {!recentOutputs.length ? (
                  <div className="rounded-xl border border-dashed border-white/12 p-5 text-center">
                    <p className="text-sm font-medium">No saved output yet</p>
                    <p className="mt-2 text-xs leading-5 text-white/40">
                      Your first reviewable draft will appear here.
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="sticky bottom-[4.25rem] z-20 mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#171513]/95 p-3 shadow-[0_-12px_35px_rgba(0,0,0,.35)] backdrop-blur-xl sm:bottom-3 sm:flex-row sm:items-center sm:justify-between xl:static xl:bg-transparent xl:p-0 xl:shadow-none">
            <div>
              <p className="text-xs font-semibold">
                {mode === "post"
                  ? "2 credits · caption + original image"
                  : mode === "music"
                    ? "2–13 credits · shown by music model and duration"
                    : mode === "video" || mode === "episode"
                      ? "12 credits · real 720p AI video render"
                      : "0 credits to save this draft"}
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                Credits are reserved server-side and automatically returned if
                generation fails.
              </p>
            </div>
            <button
              disabled={
                generatingPost ||
                generatingMedia ||
                busy === "create_content" ||
                busy === "create_workflow_draft"
              }
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f05a3a] px-6 text-sm font-bold text-[#191714] shadow-[0_12px_30px_rgba(240,90,58,.24)] transition hover:bg-[#ff7658] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#171513] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {generatingPost
                ? "Creating caption + image…"
                : generatingMedia
                  ? mode === "music" ? "Starting music render…" : "Starting video render…"
                  : actionLabel}
            </button>
          </div>
        </form>

        {mode === "video" ? (
          <form
            onSubmit={(event) => void uploadFrame(event)}
            className="border-t border-white/10 bg-[#201d1b] p-4 sm:p-5"
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-sm font-semibold">
                  Add a private reference frame
                </p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  JPG, PNG, or WebP up to 10 MB. It stays private to this
                  workspace.
                </p>
                <input
                  required
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-3 block max-w-full text-sm text-white/55 file:mr-3 file:rounded-xl file:border-0 file:bg-[#f05a3a] file:px-4 file:py-2.5 file:font-semibold file:text-[#191714]"
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="flex min-h-11 items-center gap-2 text-xs text-white/65">
                    <input
                      required
                      name="rightsConfirmed"
                      type="checkbox"
                      className="accent-[#f05a3a]"
                    />
                    I own or can use this frame.
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-xs text-white/65">
                    <input
                      required
                      name="peopleConsentConfirmed"
                      type="checkbox"
                      className="accent-[#f05a3a]"
                    />
                    People and likeness consent is confirmed.
                  </label>
                </div>
              </div>
              <button
                disabled={uploading}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[.06] px-4 text-sm font-semibold text-white hover:border-[#f05a3a]/45"
              >
                {uploading ? "Uploading…" : "Upload privately"}
              </button>
            </div>
          </form>
        ) : null}

        <footer className="border-t border-white/10 bg-[#11100f] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ff8c70]">
                Project workbench
              </p>
              <h2 className="mt-1 text-lg font-medium">
                Drafts moving through review
              </h2>
            </div>
            <span className="text-xs text-white/40">
              {items.length + drafts.length} saved
            </span>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {recentOutputs.map((item) => (
              <button
                type="button"
                onClick={() => {
                  setSelectedProject(item);
                  setProjectReply("");
                  setProjectMessage("");
                  setProjectAttachment(null);
                }}
                key={item.id}
                className="min-w-56 rounded-xl border border-white/10 bg-white/[.045] p-3 text-left transition hover:border-[#f05a3a]/55"
              >
                <div className="h-1 w-10 rounded-full bg-[#f05a3a]" />
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[.12em] text-white/35">
                  {item.kind}
                </p>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold">
                  {item.title}
                </h3>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] capitalize text-[#ff9b82]">
                    {item.status.replaceAll("_", " ")}
                  </p>
                  <p className="text-[10px] text-white/30">Open →</p>
                </div>
              </button>
            ))}
            {!recentOutputs.length ? (
              <p className="w-full rounded-xl border border-dashed border-white/12 p-5 text-center text-sm text-white/40">
                Create the first private draft to start this workbench.
              </p>
            ) : null}
          </div>
        </footer>
      </div>
      {selectedProject ? (
        <ProjectWorkspace
          project={selectedProject}
          accountId={account.id}
          connections={socialDestinations}
          authedFetch={authedFetch}
          reply={projectReply}
          message={projectMessage}
          attachment={projectAttachment}
          busy={projectBusy}
          onMessage={setProjectMessage}
          onClose={() => setSelectedProject(null)}
          onAsk={askAdamAboutProject}
          onFile={(file) => {
            setProjectBusy(true);
            void uploadProjectAttachment(file)
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Attachment failed.",
                ),
              )
              .finally(() => setProjectBusy(false));
          }}
        />
      ) : null}
    </section>
  );
}

function ProjectWorkspace({
  project,
  accountId,
  connections,
  authedFetch,
  reply,
  message,
  attachment,
  busy,
  onMessage,
  onClose,
  onAsk,
  onFile,
}: {
  project: WorkbenchProject;
  accountId: string;
  connections: Array<{ id: string; provider: "facebook" | "instagram" | "tiktok" | "youtube"; accountName: string; status: string }>;
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  reply: string;
  message: string;
  attachment: { id: string; name: string } | null;
  busy: boolean;
  onMessage: (value: string) => void;
  onClose: () => void;
  onAsk: (event: FormEvent<HTMLFormElement>) => void;
  onFile: (file: File) => void;
}) {
  const urls = mediaUrls(project.generated);
  const publishableMediaUrl = urls[0] ?? null;
  const publishType = project.source === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(publishableMediaUrl ?? "")
    ? "video"
    : "image";
  const eligibleConnections = connections.filter((connection) =>
    publishType === "video" || ["facebook", "instagram"].includes(connection.provider),
  );
  const [publishCaption, setPublishCaption] = useState(project.caption || project.brief || "");
  const [publishConnectionId, setPublishConnectionId] = useState(eligibleConnections[0]?.id ?? "");
  const [publishSchedule, setPublishSchedule] = useState("");
  const [publishJob, setPublishJob] = useState<{ id: string; status: string; provider: string } | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  async function createPublishDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publishableMediaUrl || !publishConnectionId) return;
    const connection = eligibleConnections.find((item) => item.id === publishConnectionId);
    if (!connection) return;
    setPublishBusy(true);
    setPublishMessage("");
    try {
      const response = await authedFetch("/api/integrations/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", accountId, connectionId: connection.id, provider: connection.provider,
          publishType, title: project.title.slice(0, 100), caption: publishCaption,
          mediaUrl: publishableMediaUrl, mediaMimeType: publishType === "video" ? "video/mp4" : "image/jpeg",
          privacyStatus: connection.provider === "youtube" ? "private" : undefined,
          idempotencyKey: `project:${project.source}:${project.id}:${connection.id}`,
        }),
      });
      const payload = await response.json() as { error?: string; job?: { id: string; status: string; provider: string } };
      if (!response.ok || !payload.job) throw new Error(payload.error ?? "Unable to create the publish draft.");
      setPublishJob(payload.job);
      setPublishMessage("Saved for review. Approve this exact media, caption, and destination before scheduling.");
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Unable to create the publish draft.");
    } finally {
      setPublishBusy(false);
    }
  }

  async function updatePublish(action: "approve" | "schedule") {
    if (!publishJob) return;
    setPublishBusy(true);
    setPublishMessage("");
    try {
      const response = await authedFetch("/api/integrations/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, accountId, jobId: publishJob.id,
          scheduledFor: action === "schedule" ? new Date(publishSchedule).toISOString() : undefined,
        }),
      });
      const payload = await response.json() as { error?: string; job?: { id: string; status: string; provider: string } };
      if (!response.ok || !payload.job) throw new Error(payload.error ?? "Unable to update the publish draft.");
      setPublishJob(payload.job);
      setPublishMessage(action === "approve"
        ? "Approved. Choose a future time and schedule it. Nothing has been sent yet."
        : "Scheduled. WOVO will re-verify the connection before the delivery window; no stale backlog is sent.");
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Unable to update the publish draft.");
    } finally {
      setPublishBusy(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-7"
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-[1380px] overflow-hidden rounded-[28px] border border-white/10 bg-[#171513] text-white shadow-2xl lg:grid-cols-[1.15fr_.85fr]">
        <section className="p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff8c70]">
                {project.kind} · {project.status.replaceAll("_", " ")}
              </p>
              <h2 className="mt-3 text-3xl font-medium sm:text-5xl">
                {project.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-full border border-white/15 px-4 text-sm"
            >
              Close
            </button>
          </div>
          <div className="mt-7 rounded-2xl border border-white/10 bg-black/25 p-5">
            {urls.map((url) =>
              project.source === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url) ? (
                <div key={url} className="mb-4">
                  <video controls playsInline className="max-h-[520px] w-full rounded-xl bg-black" src={url} />
                  <a href={url} download className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-white/15 px-4 text-xs font-bold text-white hover:border-[#f05a3a]">Download video</a>
                </div>
              ) : project.source === "music" || /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url) ? (
                <div key={url} className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="mb-4 flex h-24 items-center justify-center gap-1" aria-hidden="true">
                    {[34, 62, 88, 46, 74, 96, 52, 80, 40, 68, 90, 44].map((height, index) => (
                      <span key={`${height}-${index}`} className="w-2 rounded-full bg-[#f05a3a]" style={{ height: `${height}%`, opacity: .5 + (index % 3) * .2 }} />
                    ))}
                  </div>
                  <audio controls preload="metadata" className="w-full" src={url} />
                  <a href={url} download className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-white/15 px-4 text-xs font-bold text-white hover:border-[#f05a3a]">Download track</a>
                </div>
              ) : (
                <div key={url} className="mb-4">
                  <Image unoptimized width={960} height={960} alt="Generated project media" className="max-h-[520px] w-full rounded-xl object-contain" src={url} />
                  <a href={url} download className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-white/15 px-4 text-xs font-bold text-white hover:border-[#f05a3a]">Download image</a>
                </div>
              ),
            )}
            {!urls.length ? (
              <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-white/15 text-center">
                <div>
                  <p className="text-lg font-semibold">
                    No rendered media saved yet
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
                    This project currently contains a brief or caption. Media
                    appears after a provider render finishes.
                  </p>
                </div>
              </div>
            ) : null}
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/70">
              {project.caption || project.brief || "No project brief saved."}
            </p>
          </div>
        </section>
        <aside className="border-t border-white/10 bg-[#0f0e0d] p-5 sm:p-8 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff8c70]">
            Talk to Adam about this project
          </p>
          <h3 className="mt-2 text-2xl font-medium">
            Caption it, revise it, or add a logo.
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Rendering or publishing still requires confirmation.
          </p>
          {reply ? (
            <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-white/[.07] p-4 text-sm leading-7">
              {reply}
            </div>
          ) : null}
          <form
            className="mt-5"
            onSubmit={onAsk}
            onPaste={(event) => {
              const pasted = Array.from(event.clipboardData.items)
                .find((item) => item.type.startsWith("image/"))
                ?.getAsFile();
              if (pasted) {
                event.preventDefault();
                onFile(new File([pasted], pasted.name || `pasted-reference-${Date.now()}.png`, { type: pasted.type || "image/png" }));
              }
            }}
          >
            <label
              className="block rounded-2xl border border-white/15 bg-white/[.035] p-4 text-sm text-white/55 focus-within:border-[#f05a3a]"
            >
              <span>
                {attachment
                  ? `Attached: ${attachment.name}`
                  : "Paste an image here with Ctrl+V, or choose one from your device"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-3 block w-full text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFile(file);
                }}
              />
            </label>
            <p className="mt-2 text-[11px] leading-5 text-white/35">
              Uploading confirms you own or may use the reference and have
              consent for people shown.
            </p>
            <textarea
              value={message}
              onChange={(event) => onMessage(event.target.value)}
              required
              minLength={3}
              maxLength={3000}
              className="mt-4 min-h-40 w-full rounded-2xl border border-white/10 bg-[#24211f] p-4 text-sm text-white outline-none focus:border-[#f05a3a]"
              placeholder="Make a caption for this video… or remake it using the attached logo."
            />
            <button
              disabled={busy}
              className="mt-3 min-h-12 w-full rounded-xl bg-[#f05a3a] px-5 text-sm font-bold text-[#191714] disabled:opacity-45"
            >
              {busy ? "Adam is working…" : "Ask Adam"}
            </button>
          </form>
          {project.source !== "music" && publishableMediaUrl ? (
            <form onSubmit={(event) => void createPublishDraft(event)} className="mt-8 border-t border-white/10 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff8c70]">Approve & schedule</p>
              <h3 className="mt-2 text-xl font-medium">Choose the exact social account.</h3>
              {eligibleConnections.length ? (
                <>
                  <label className="mt-4 block text-xs font-semibold text-white/65">
                    Destination
                    <select value={publishConnectionId} onChange={(event) => setPublishConnectionId(event.target.value)} disabled={Boolean(publishJob)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#24211f] px-3 text-sm text-white">
                      {eligibleConnections.map((connection) => (
                        <option key={connection.id} value={connection.id}>{connection.provider} · {connection.accountName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-xs font-semibold text-white/65">
                    Caption
                    <textarea value={publishCaption} onChange={(event) => setPublishCaption(event.target.value)} disabled={Boolean(publishJob)} maxLength={5000} className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-[#24211f] p-3 text-sm font-normal text-white outline-none focus:border-[#f05a3a]" placeholder="Write or ask Adam for the final caption…" />
                  </label>
                  {!publishJob ? (
                    <button disabled={publishBusy} className="mt-3 min-h-12 w-full rounded-xl border border-[#f05a3a] px-4 text-sm font-bold text-[#ff9b82] disabled:opacity-45">Save exact post for review</button>
                  ) : publishJob.status === "draft" || publishJob.status === "failed" ? (
                    <button type="button" onClick={() => void updatePublish("approve")} disabled={publishBusy} className="mt-3 min-h-12 w-full rounded-xl bg-[#f05a3a] px-4 text-sm font-bold text-[#191714] disabled:opacity-45">Approve this exact post</button>
                  ) : publishJob.status === "approved" ? (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-white/65">Publish time<input required type="datetime-local" value={publishSchedule} onChange={(event) => setPublishSchedule(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#24211f] px-3 text-sm text-white [color-scheme:dark]" /></label>
                      <button type="button" onClick={() => void updatePublish("schedule")} disabled={publishBusy || !publishSchedule} className="mt-3 min-h-12 w-full rounded-xl bg-[#f05a3a] px-4 text-sm font-bold text-[#191714] disabled:opacity-45">Schedule approved post</button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[.05] p-3 text-sm capitalize text-white/70">Status: {publishJob.status.replaceAll("_", " ")}</div>
                  )}
                  {publishMessage ? <p role="status" className="mt-3 text-xs leading-5 text-white/55">{publishMessage}</p> : null}
                </>
              ) : (
                <p className="mt-3 rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm leading-6 text-white/50">Connect a compatible Facebook, Instagram, TikTok, or YouTube account in Settings first. Download still works without a social connection.</p>
              )}
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Queue({
  account,
  items,
  drafts,
  assets,
  creditBalance,
  creatorMode,
  onCreatorModeChange,
  paid,
  staff,
  busy,
  onAction,
  authedFetch,
  reload,
  setError,
  setNotice,
  resumedIntent,
}: {
  account: PortalAccount;
  items: PortalContentItem[];
  drafts: PortalSnapshot["workflowDrafts"];
  assets: PortalSnapshot["assets"];
  creditBalance: number;
  creatorMode: CreatorMode;
  onCreatorModeChange: (mode: CreatorMode) => void;
  paid: boolean;
  staff: boolean;
  busy: string;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  reload: () => Promise<void>;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
  resumedIntent?: ResumedGenerationIntent | null;
}) {
  async function approveRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onAction(
      {
        action: "approve_content_range",
        accountId: account.id,
        startDate: data.get("startDate"),
        endDate: data.get("endDate"),
      },
      "The exact scheduled versions in this range were approved and recorded.",
    );
  }
  return (
    <div className="space-y-5">
      <CreatorWorkbench
        account={account}
        items={items}
        drafts={drafts}
        assets={assets}
        creditBalance={creditBalance}
        mode={creatorMode}
        onModeChange={onCreatorModeChange}
        paid={paid}
        busy={busy}
        onAction={onAction}
        authedFetch={authedFetch}
        reload={reload}
        setError={setError}
        setNotice={setNotice}
        initialPrompt={resumedIntent?.prompt}
      />
      <ClientMetaDelivery accountId={account.id} items={items} />
      <section className={cardClass}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-semibold">Scheduled posts</h2>
            <p className="mt-1 text-xs leading-5 text-[#756e64]">
              Approval locks the current caption, platform, asset, and time. Any
              later change requires a new approval.
            </p>
          </div>
          <span className="text-sm text-[#7a7369]">{items.length} total</span>
        </div>
        {items.some(
          (item) =>
            item.scheduled_for &&
            ["draft", "client_review", "revision_requested"].includes(
              item.status,
            ),
        ) ? (
          <form
            onSubmit={(event) => void approveRange(event)}
            className="mt-4 grid gap-3 rounded-2xl border border-[#f05a3a]/20 bg-[#fff7f3] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="text-sm font-medium">
              Approve from
              <input
                required
                name="startDate"
                type="date"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              Through
              <input
                required
                name="endDate"
                type="date"
                className={inputClass}
              />
            </label>
            <button
              disabled={busy === "approve_content_range"}
              className={primaryButton}
            >
              Approve date range
            </button>
          </form>
        ) : null}
        <div className="mt-4 grid gap-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[#191714]/10 bg-[#191714]/[.035] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs capitalize text-[#7a7369]">
                    {item.platform.replace("_", " ")} ·{" "}
                    {formatDate(item.scheduled_for)}
                  </p>
                  {item.approved_snapshot_id ? (
                    <p className="mt-2 text-xs font-semibold text-[#8f301f]">
                      Approval v{item.approval_version} recorded
                    </p>
                  ) : null}
                </div>
                <StatusPill status={item.status} />
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#5f574e]">
                {item.caption}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={secondaryButton}
                  onClick={() =>
                    void navigator.clipboard.writeText(item.caption)
                  }
                >
                  Copy caption
                </button>
                {["client_review", "revision_requested", "draft"].includes(
                  item.status,
                ) ? (
                  <>
                    <button
                      className={primaryButton}
                      onClick={() =>
                        void onAction(
                          {
                            action: "update_content",
                            accountId: account.id,
                            contentId: item.id,
                            status: "approved",
                          },
                          "The exact post version was approved and the WOVO team was notified.",
                        )
                      }
                    >
                      Approve exact version
                    </button>
                    <button
                      className={secondaryButton}
                      onClick={() =>
                        void onAction(
                          {
                            action: "update_content",
                            accountId: account.id,
                            contentId: item.id,
                            status: "revision_requested",
                            feedback: "Please revise this post.",
                          },
                          "Revision requested.",
                        )
                      }
                    >
                      Request revision
                    </button>
                  </>
                ) : null}
                {item.approved_snapshot_id &&
                item.status !== "manual_posted" ? (
                  <button
                    className={secondaryButton}
                    onClick={() =>
                      void onAction(
                        {
                          action: "revoke_content_approval",
                          accountId: account.id,
                          contentId: item.id,
                          reason: "Approval revoked for revision",
                        },
                        "Approval revoked. The post returned to review.",
                      )
                    }
                  >
                    Revoke approval
                  </button>
                ) : null}
                {staff &&
                item.status === "approved" &&
                item.approved_snapshot_id ? (
                  <button
                    className={primaryButton}
                    onClick={() =>
                      void onAction(
                        {
                          action: "update_content",
                          accountId: account.id,
                          contentId: item.id,
                          status: "manual_posted",
                        },
                        "Post marked as manually published.",
                      )
                    }
                  >
                    Mark posted
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!items.length ? (
            <div className="rounded-2xl border border-dashed border-[#191714]/15 p-8 text-center">
              <p className="font-medium">No posts in the queue yet</p>
              <p className="mt-2 text-sm text-[#7a7369]">
                Generate a weekly plan or add the first caption manually.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Calendar({
  account,
  events,
  content,
  busy,
  staff,
  onAction,
}: {
  account: PortalAccount;
  events: PortalSnapshot["events"];
  content: PortalContentItem[];
  busy: string;
  staff: boolean;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
}) {
  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onAction(
      {
        action: "create_event",
        accountId: account.id,
        eventType: data.get("eventType"),
        startsAt: data.get("startsAt"),
        participantCount: Number(data.get("participantCount")),
        location: data.get("location"),
      },
      "Request received. A WOVO manager will confirm availability and the organization meeting link.",
    );
    event.currentTarget.reset();
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d94326]">
          One shared organization
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Content & consultation calendar
        </h1>
        <p className="mt-2 text-sm text-[#655f56]">
          WOVO managers assign qualified staff internally. Clients never book or
          message individual employees.
        </p>
      </div>
      <form onSubmit={(event) => void schedule(event)} className={cardClass}>
        <h2 className="text-lg font-semibold">
          Request a consultation or shoot
        </h2>
        <p className="mt-1 text-sm text-[#7a7369]">
          Video calls use an approved external provider with optional camera and
          screen sharing. One WOVO representative is included; extra
          participants require a paid add-on.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Type
            <select name="eventType" className={inputClass}>
              <option value="consultation">30-minute video consultation</option>
              <option value="shoot">On-location shoot request</option>
            </select>
          </label>
          <label className="text-sm">
            Preferred start
            <input
              required
              name="startsAt"
              type="datetime-local"
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Participants
            <select
              name="participantCount"
              defaultValue="1"
              className={inputClass}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Location for shoots
            <input
              name="location"
              placeholder="Full service location"
              maxLength={240}
              className={inputClass}
            />
          </label>
        </div>
        <button
          disabled={busy === "create_event"}
          className={`${primaryButton} mt-4`}
        >
          Submit scheduling request
        </button>
      </form>
      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Upcoming work</h2>
        <div className="mt-4 space-y-3">
          {[
            ...events.map((item) => ({
              id: item.id,
              title: item.title,
              date: item.starts_at,
              status: item.status,
              detail: item.meeting_url
                ? "Secure meeting link ready"
                : (item.travel_estimate_note ?? "Awaiting WOVO confirmation"),
              event: item,
            })),
            ...content
              .filter((item) => item.scheduled_for)
              .map((item) => ({
                id: item.id,
                title: item.title,
                date: item.scheduled_for!,
                status: item.status,
                detail: `${item.platform.replace("_", " ")} posting queue`,
                event: null,
              })),
          ]
            .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
            .map((item) => (
              <div
                key={`${item.event ? "event" : "content"}-${item.id}`}
                className="flex flex-col justify-between gap-3 rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-[#7a7369]">
                    {formatDate(item.date)} · {item.detail}
                  </p>
                  {item.event?.meeting_url ? (
                    <a
                      className="mt-2 inline-block text-sm font-semibold text-[#d94326]"
                      href={item.event.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open secure meeting
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={item.status} />
                  {staff && item.event && item.status === "requested" ? (
                    <button
                      className={secondaryButton}
                      onClick={() => {
                        const url = window.prompt(
                          "Secure HTTPS Google Meet, Zoom, or Teams link",
                        );
                        if (url)
                          void onAction(
                            {
                              action: "update_event",
                              accountId: account.id,
                              eventId: item.id,
                              status: "confirmed",
                              meetingProvider: "other",
                              meetingUrl: url,
                            },
                            "Event confirmed with an organization meeting link.",
                          );
                      }}
                    >
                      Confirm link
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          {!events.length && !content.some((item) => item.scheduled_for) ? (
            <p className="rounded-xl border border-dashed border-[#191714]/15 p-8 text-center text-sm text-[#7a7369]">
              Nothing scheduled yet. Submit a request or create a posting plan.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function KnowledgeStudio({
  account,
  notes,
  versions,
  workflows,
  busy,
  onAction,
}: {
  account: PortalAccount;
  notes: PortalSnapshot["knowledgeNotes"];
  versions: PortalSnapshot["knowledgeNoteVersions"];
  workflows: PortalSnapshot["commentContentWorkflows"];
  busy: string;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
}) {
  const [editingNoteId, setEditingNoteId] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const editingNote = notes.find((note) => note.id === editingNoteId);
  const editingVersion = editingNote
    ? versions.find(
        (version) =>
          version.note_id === editingNote.id &&
          version.version_number === editingNote.current_version,
      )
    : null;
  const approvedNotes = notes.filter(
    (note) =>
      note.status === "approved" &&
      note.approved_version_id &&
      !note.archived_at,
  );

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const approve = submitter?.dataset.approve === "true";
    const result = await onAction(
      {
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
      },
      approve
        ? "Approved note saved for factual WOVO context."
        : "Draft note version saved.",
    );
    if (result) {
      setEditingNoteId("");
      form.reset();
    }
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await onAction(
      {
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
      },
      "Private, note-backed content brief saved for human review.",
    );
    if (result) {
      setSelectedNoteIds([]);
      form.reset();
    }
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">
            WOVO Notes
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Approved knowledge for your business
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">
            Store facts, programs, services, event details, history, and voice
            guidance. AI may use only the explicitly approved version; drafts
            never become factual context.
          </p>
        </div>
        <span className="text-sm text-[#655f56]">
          {approvedNotes.length} approved · {notes.length} total
        </span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <details
          className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"
          open={notes.length === 0 || Boolean(editingNoteId)}
        >
          <summary className="cursor-pointer list-none font-semibold">
            {editingNote ? `Edit ${editingNote.title}` : "Add a business note"}
          </summary>
          <form
            key={editingNoteId || "new"}
            onSubmit={(event) => void saveNote(event)}
            className="mt-4 space-y-3 border-t border-[#191714]/10 pt-4"
          >
            <label className="text-sm font-medium">
              Title
              <input
                name="title"
                required
                minLength={2}
                maxLength={180}
                defaultValue={editingVersion?.title ?? ""}
                className={inputClass}
                placeholder="For example: Spring food pantry schedule"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Category
                <select
                  name="category"
                  defaultValue={editingNote?.category ?? "business_facts"}
                  className={inputClass}
                >
                  <option value="business_facts">Business facts</option>
                  <option value="programs">Programs</option>
                  <option value="locations">Locations</option>
                  <option value="services">Services</option>
                  <option value="history">History</option>
                  <option value="events">Events</option>
                  <option value="voice_guidance">Do / don&apos;t say</option>
                  <option value="faq">FAQ</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                How WOVO should use it
                <select
                  name="guidanceKind"
                  defaultValue={editingVersion?.guidance_kind ?? "fact"}
                  className={inputClass}
                >
                  <option value="fact">Approved fact</option>
                  <option value="context">Background context</option>
                  <option value="do_say">Preferred wording</option>
                  <option value="dont_say">Avoid this wording</option>
                </select>
              </label>
            </div>
            <label className="text-sm font-medium">
              Note
              <textarea
                name="body"
                required
                minLength={3}
                maxLength={20000}
                defaultValue={editingVersion?.body ?? ""}
                className={textareaClass}
                placeholder="Write the exact, reviewable context WOVO should know. Separate confirmed facts from suggestions."
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Source link, if available
                <input
                  name="sourceUrl"
                  type="url"
                  maxLength={1000}
                  defaultValue={editingVersion?.source_url ?? ""}
                  className={inputClass}
                  placeholder="https://"
                />
              </label>
              <label className="text-sm font-medium">
                Source date
                <input
                  name="sourceDate"
                  type="date"
                  defaultValue={editingVersion?.source_date ?? ""}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="text-sm font-medium">
              What changed?
              <input
                name="changeNote"
                maxLength={500}
                className={inputClass}
                placeholder="Optional version note"
              />
            </label>
            <p className="rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-3 text-xs leading-5 text-[#655f56]">
              Save draft keeps this version out of AI context. Save &amp;
              approve marks this exact version as factual context and records
              who approved it.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                disabled={busy === "save_knowledge_note"}
                className={secondaryButton}
              >
                Save draft
              </button>
              <button
                data-approve="true"
                disabled={busy === "save_knowledge_note"}
                className={primaryButton}
              >
                Save &amp; approve
              </button>
              {editingNote ? (
                <button
                  type="button"
                  onClick={() => setEditingNoteId("")}
                  className={secondaryButton}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </details>

        <div className="space-y-3">
          {notes.map((note) => {
            const current = versions.find(
              (version) =>
                version.note_id === note.id &&
                version.version_number === note.current_version,
            );
            const approved = versions.find(
              (version) => version.id === note.approved_version_id,
            );
            return (
              <article
                key={note.id}
                className="rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">
                      {note.category.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-1 font-semibold">{note.title}</h3>
                  </div>
                  <StatusPill status={note.status} />
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#5f574e]">
                  {current?.body ?? "Version content unavailable."}
                </p>
                <p className="mt-3 text-xs text-[#756e64]">
                  Current v{note.current_version}
                  {approved
                    ? ` · approved v${approved.version_number}`
                    : " · no approved version"}
                  {approved?.source_url ? " · source retained" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingNoteId(note.id)}
                    className={secondaryButton}
                  >
                    Edit / new version
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void onAction(
                        {
                          action: "set_knowledge_note_archive",
                          accountId: account.id,
                          noteId: note.id,
                          archive: note.status !== "archived",
                        },
                        note.status === "archived"
                          ? "Note restored."
                          : "Note archived with history preserved.",
                      )
                    }
                    className={secondaryButton}
                  >
                    {note.status === "archived" ? "Restore" : "Archive"}
                  </button>
                </div>
              </article>
            );
          })}
          {!notes.length ? (
            <p className="rounded-2xl border border-dashed border-[#191714]/15 p-7 text-center text-sm leading-6 text-[#756e64]">
              No notes yet. Add one confirmed fact or voice guideline to create
              a trustworthy knowledge base.
            </p>
          ) : null}
        </div>
      </div>

      <details className="mt-5 rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4">
        <summary className="cursor-pointer list-none">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
            Comment to content
          </p>
          <h3 className="mt-2 text-xl font-semibold">
            Turn a public question into a factual review brief
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#655f56]">
            Manual intake only. Remove commenter identity and private details,
            then pair the question with approved Notes. WOVO does not import
            social comments or auto-reply.
          </p>
        </summary>
        <form
          onSubmit={(event) => void saveQuestion(event)}
          className="mt-5 grid gap-4 border-t border-[#191714]/10 pt-5 lg:grid-cols-2"
        >
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Redacted public question
              <textarea
                name="redactedQuestion"
                required
                minLength={5}
                maxLength={4000}
                className={textareaClass}
                placeholder="Paste only the useful question. Remove names, handles, email addresses, phone numbers, and private context."
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Category
                <select
                  name="category"
                  defaultValue="faq"
                  className={inputClass}
                >
                  <option value="faq">FAQ</option>
                  <option value="program">Program</option>
                  <option value="service">Service</option>
                  <option value="event">Event</option>
                  <option value="education">Education</option>
                  <option value="myth">Myth / clarification</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Prepare as
                <select
                  name="outputType"
                  defaultValue="faq_answer"
                  className={inputClass}
                >
                  <option value="faq_answer">FAQ answer</option>
                  <option value="social_post">Social post</option>
                  <option value="caption">Caption</option>
                  <option value="content_theme">Content theme</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Public source
                <select
                  name="sourcePlatform"
                  defaultValue="website"
                  className={inputClass}
                >
                  <option value="website">Website</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Source date
                <input name="sourceDate" type="date" className={inputClass} />
              </label>
            </div>
            <label className="text-sm font-medium">
              Public source link, optional
              <input
                name="sourceUrl"
                type="url"
                maxLength={1000}
                className={inputClass}
                placeholder="https://"
              />
            </label>
          </div>
          <div className="space-y-3">
            <fieldset className="rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-3">
              <legend className="px-1 text-sm font-semibold">
                Approved Notes supporting the facts
              </legend>
              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                {approvedNotes.map((note) => (
                  <label
                    key={note.id}
                    className="flex min-h-11 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedNoteIds.includes(note.id)}
                      onChange={(event) =>
                        setSelectedNoteIds((current) =>
                          event.target.checked
                            ? [...current, note.id]
                            : current.filter((id) => id !== note.id),
                        )
                      }
                    />
                    {note.title}
                  </label>
                ))}
                {!approvedNotes.length ? (
                  <p className="text-xs leading-5 text-[#756e64]">
                    Approve a WOVO Note before marking factual claims as
                    supported.
                  </p>
                ) : null}
              </div>
            </fieldset>
            <label className="text-sm font-medium">
              Reviewed draft, optional
              <textarea
                name="draftOutput"
                maxLength={10000}
                className={textareaClass}
                placeholder="Add or edit the human-reviewed answer here. Without a configured AI runtime, WOVO saves the factual brief only."
              />
            </label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-3 text-sm">
              <input
                required
                name="privacyConfirmed"
                type="checkbox"
                className="mt-1"
              />
              <span>
                I removed commenter identity and private details. This is a
                selected public question I am authorized to use for business
                content.
              </span>
            </label>
            <button
              disabled={busy === "save_comment_content_workflow"}
              className={`${primaryButton} w-full`}
            >
              Save factual review brief
            </button>
          </div>
        </form>
        {workflows.length ? (
          <div className="mt-5 grid gap-3 border-t border-[#191714]/10 pt-5 md:grid-cols-2">
            {workflows.slice(0, 8).map((workflow) => (
              <article
                key={workflow.id}
                className="rounded-xl border border-[#191714]/10 bg-[#fffdf8] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold capitalize">
                    {workflow.output_type.replaceAll("_", " ")}
                  </p>
                  <StatusPill status={workflow.status} />
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5f574e]">
                  {workflow.redacted_question}
                </p>
                <p className="mt-3 text-xs text-[#756e64]">
                  {workflow.approved_note_ids.length} approved source note
                  {workflow.approved_note_ids.length === 1 ? "" : "s"} ·{" "}
                  {workflow.factual_support_status.replaceAll("_", " ")}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </details>
    </section>
  );
}

function BuildStudio({
  snapshot,
  account,
  drafts,
  ledger,
  entitlements,
  notes,
  noteVersions,
  commentWorkflows,
  busy,
  onAction,
}: {
  snapshot: PortalSnapshot;
  account: PortalAccount;
  drafts: PortalSnapshot["workflowDrafts"];
  ledger: PortalSnapshot["creditLedger"];
  entitlements: PortalSnapshot["entitlements"];
  notes: PortalSnapshot["knowledgeNotes"];
  noteVersions: PortalSnapshot["knowledgeNoteVersions"];
  commentWorkflows: PortalSnapshot["commentContentWorkflows"];
  busy: string;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
}) {
  const [workflowType, setWorkflowType] =
    useState<PortalSnapshot["workflowDrafts"][number]["workflow_type"]>(
      "website_site",
    );
  const [customCreditAmount, setCustomCreditAmount] = useState("75");
  const balance =
    snapshot.creditAccounts.find((item) => item.account_id === account.id)
      ?.balance ?? 0;
  const usagePolicy = snapshot.aiUsagePolicies.find((item) => item.account_id === account.id) ?? null;
  const dm = entitlements.find(
    (item) => item.entitlement_key === "ai_dm_manager",
  );
  const hosting = entitlements.find(
    (item) => item.entitlement_key === "website_hosting",
  );
  const assistant = entitlements.find(
    (item) => item.entitlement_key === "personal_ai_assistant",
  );

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await onAction(
      {
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
      },
      "Private workflow draft created. Nothing was published or purchased.",
    );
    if (result) form.reset();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d94326]">
          Private production studio
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Build drafts, then approve the next step.
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">
          Every workflow begins as a tenant-private brief. External publishing,
          phone handling, site hosting, and provider generation stay blocked
          until the required connection, entitlement, consent, and provisioning
          checks succeed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section id="credit-packs" className={`${cardClass} scroll-mt-24`}>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
            Credits
          </p>
          <p className="mt-3 text-4xl font-semibold">{balance}</p>
          <p className="mt-2 text-sm leading-6 text-[#655f56]">
            Server-authoritative balance. Purchases and generation costs will
            appear as idempotent ledger entries.
          </p>
          {usagePolicy?.monthly_included_units ? <p className="mt-3 rounded-xl bg-[#f7f2e9] p-3 text-xs leading-5 text-[#655f56]">{usagePolicy.monthly_included_units} subscription credits per month · next refill {formatDate(usagePolicy.period_end)}</p> : null}
          {balance < 12 ? <p className="mt-3 rounded-xl border border-[#f05a3a]/25 bg-[#f05a3a]/8 p-3 text-xs leading-5 text-[#8f2f1d]">Low balance: a short video currently needs 12 credits. Buy only what you need below, upgrade, or wait for the refill shown above.</p> : null}
          {snapshot.setup.expansion.creditPurchaseReady ? (
            <div className="mt-4 grid gap-2" aria-label="Credit packs">
              {CLIENT_CREDIT_PACKS.map((pack) => (
                <button
                  key={pack.key}
                  className={`${secondaryButton} w-full justify-between`}
                  onClick={() =>
                    void onAction(
                      {
                        action: "start_credit_checkout",
                        accountId: account.id,
                        packKey: pack.key,
                      },
                      `Opening secure Stripe Checkout for ${pack.units} credits.`,
                    )
                  }
                >
                  <span>{pack.units} credits</span>
                  <span>{pack.price}</span>
                </button>
              ))}
              <div className="mt-2 rounded-xl border border-[#191714]/10 p-3">
                <label className="text-xs font-semibold text-[#655f56]">Custom whole-dollar amount · $10–$10,000<input value={customCreditAmount} onChange={(event) => setCustomCreditAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 5))} inputMode="numeric" className={`${inputClass} mt-2`} /></label>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span>{Math.max(10, Number(customCreditAmount) || 0) * 11} credits</span><button disabled={busy === "start_credit_checkout" || !Number.isInteger(Number(customCreditAmount)) || Number(customCreditAmount) < 10 || Number(customCreditAmount) > 10000} className={primaryButton} onClick={() => void onAction({ action: "start_credit_checkout", accountId: account.id, amountDollars: Number(customCreditAmount) }, `Opening secure Stripe Checkout for $${customCreditAmount} in credits.`)}>Continue</button></div>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-[#f7f2e9] p-3 text-xs leading-5 text-[#655f56]">
              Purchasing is hidden until all six Stripe prices pass the server
              allowlist. Your existing balance and history remain available.
            </p>
          )}
        </section>
        {snapshot.setup.expansion.dmManagerCheckoutReady ? (
          <section className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
                  Optional add-on
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  AI DM Manager · $1.99/month
                </h2>
              </div>
              <StatusPill status={dm?.status ?? "inactive"} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#655f56]">
              Draft-reply workflow only. It does not read or send platform
              messages automatically while official Meta permissions, encrypted
              tokens, and background jobs remain unverified.
            </p>
            <button className={`${secondaryButton} mt-4 w-full`}>
              Manage add-on
            </button>
          </section>
        ) : null}
        {snapshot.setup.expansion.websiteHostingCheckoutReady ? (
          <section className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
                  Optional add-on
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Website hosting · $35/month
                </h2>
              </div>
              <StatusPill status={hosting?.status ?? "inactive"} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#655f56]">
              Hosting is separate from AI website drafts and covers managed
              runtime/hosting only after provisioning. It does not imply a
              custom domain or published site before readiness succeeds.
            </p>
            {hosting?.current_period_end ? (
              <p className="mt-2 text-xs text-[#756e64]">
                Current period ends {formatDate(hosting.current_period_end)}
                {hosting.cancel_at_period_end ? " · cancels at period end" : ""}
              </p>
            ) : null}
            <button className={`${secondaryButton} mt-4 w-full`}>
              Manage hosting
            </button>
          </section>
        ) : null}
        {snapshot.setup.expansion.personalAssistantCheckoutReady ? (
          <section className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
                  Optional add-on
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Personal AI assistant · $59.99/month
                </h2>
              </div>
              <StatusPill status={assistant?.status ?? "inactive"} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#655f56]">
              Plain-language booking requests with details, history, status, and
              a required confirmation before any future outbound action. Launch
              mode is request/setup only—no autonomous calls or bookings.
            </p>
            <button className={`${secondaryButton} mt-4 w-full`}>
              Manage assistant
            </button>
          </section>
        ) : null}
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
        <form
          onSubmit={(event) => void createDraft(event)}
          className={cardClass}
        >
          <h2 className="text-xl font-semibold">
            Create a private workflow brief
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#655f56]">
            This saves an editable draft and alerts the WOVO team. It never
            scrapes a listing, publishes a site/post, places a call, screens an
            applicant, or charges credits by itself.
          </p>
          <div className="mt-5 space-y-3">
            <label className="text-sm font-medium">
              Workflow
              <select
                name="workflowType"
                value={workflowType}
                onChange={(event) =>
                  setWorkflowType(event.target.value as typeof workflowType)
                }
                className={inputClass}
              >
                <option value="website_site">AI-guided website brief</option>
                <option value="website_page">
                  Product / service page draft
                </option>
                <option value="listing_ad">
                  Authorized listing-to-ad storyboard
                </option>
                <option value="post_plan">Daily / weekly posting plan</option>
                <option value="mascot_series">
                  Authorized mascot / cartoon series
                </option>
                <option value="ugc_ad">Authorized UGC ad brief</option>
                <option value="meeting">Private meeting setup</option>
                <option value="call_agent">
                  After-hours call-agent configuration
                </option>
                <option value="booking_request">
                  Personal assistant booking request
                </option>
                <option value="job_posting">
                  Job posting / application intake
                </option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Title
              <input
                required
                name="title"
                minLength={3}
                maxLength={180}
                className={inputClass}
                placeholder="Name this draft"
              />
            </label>
            <label className="text-sm font-medium">
              Source URL, when relevant
              <input
                name="sourceUrl"
                type="url"
                maxLength={1000}
                className={inputClass}
                placeholder="https:// — used as authorized context only; never scraped"
              />
            </label>
            <label className="text-sm font-medium">
              Cadence or mode
              <input
                name="cadence"
                maxLength={80}
                className={inputClass}
                placeholder="For example: weekly, approval required"
              />
            </label>
            <label className="text-sm font-medium">
              Brief
              <textarea
                required
                name="brief"
                minLength={10}
                maxLength={5000}
                className={textareaClass}
                placeholder="Describe the audience, offer, pages/scenes, facts, approved calls to action, and desired result."
              />
            </label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm">
              <input name="sourceAuthorized" type="checkbox" className="mt-1" />
              <span>
                I am authorized to supply facts from the source. WOVO may not
                scrape or reuse unlicensed source media.
              </span>
            </label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm">
              <input name="rightsConfirmed" type="checkbox" className="mt-1" />
              <span>
                I own or have permission to use every referenced/uploaded asset.
              </span>
            </label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm">
              <input
                name="peopleConsentConfirmed"
                type="checkbox"
                className="mt-1"
              />
              <span>
                Every identifiable person consented to the requested use of
                their likeness.
              </span>
            </label>
            <label className="flex min-h-12 items-start gap-2 rounded-xl border border-[#191714]/10 p-3 text-sm">
              <input
                name="voiceConsentConfirmed"
                type="checkbox"
                className="mt-1"
              />
              <span>
                Every referenced voice is mine or is used with explicit
                permission; no impersonation.
              </span>
            </label>
          </div>
          <button
            disabled={busy === "create_workflow_draft"}
            className={`${primaryButton} mt-4 w-full`}
          >
            {busy === "create_workflow_draft"
              ? "Saving…"
              : "Save private draft"}
          </button>
        </form>

        <section className={cardClass}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
                Draft queue
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Review before external action
              </h2>
            </div>
            <span className="text-sm text-[#655f56]">
              {drafts.length} draft{drafts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {drafts.map((draft) => (
              <article
                key={draft.id}
                className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-[#a9341f]">
                      {draft.workflow_type.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-1 font-semibold">{draft.title}</h3>
                  </div>
                  <StatusPill status={draft.status} />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5f574e]">
                  {draft.brief}
                </p>
                <p className="mt-3 text-xs text-[#756e64]">
                  {draft.provider_status === "provider_required"
                    ? "WOVO review required"
                    : draft.provider_status.replaceAll("_", " ")}{" "}
                  · created {formatDate(draft.created_at)}
                </p>
                {draft.published_url ? (
                  <a
                    href={draft.published_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center font-bold text-[#d94326]"
                  >
                    Open provisioned result
                  </a>
                ) : (
                  <p className="mt-3 text-xs font-bold text-[#8f301f]">
                    Saved as a private draft.
                  </p>
                )}
              </article>
            ))}
            {!drafts.length ? (
              <p className="rounded-2xl border border-dashed border-[#191714]/15 p-8 text-center text-sm leading-6 text-[#756e64]">
                No build drafts yet. Start with a website, authorized ad,
                posting plan, or provider setup brief.
              </p>
            ) : null}
          </div>
          {ledger.length ? (
            <details className="mt-5 rounded-xl border border-[#191714]/10 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">
                Credit ledger ({ledger.length})
              </summary>
              <div className="mt-3 space-y-2">
                {ledger.slice(0, 20).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex justify-between gap-3 text-xs"
                  >
                    <span>
                      {entry.description} · {formatDate(entry.created_at)}
                    </span>
                    <strong
                      className={
                        entry.delta > 0 ? "text-[#d94326]" : "text-[#8f301f]"
                      }
                    >
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta} → {entry.balance_after}
                    </strong>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      </div>

      <details className={cardClass}>
        <summary className="cursor-pointer list-none">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756e64]">
            Working request tools
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">What can I prepare here?</h2>
            <span className="text-sm font-bold text-[#d94326]">Expand</span>
          </div>
        </summary>
        <div className="mt-5 grid gap-3 border-t border-[#191714]/10 pt-5 sm:grid-cols-2 xl:grid-cols-3">
          {[
            [
              "Posting cadence",
              "Draft + queue",
              "Create daily or weekly plans, approve them, and send durable manual posting tasks to WOVO.",
            ],
            [
              "Website concepts",
              "Editable draft",
              "Prepare a site or product-page brief from your brand profile and rights-confirmed assets.",
            ],
            [
              "Authorized ad briefs",
              "Editable draft",
              "Turn client-supplied listing, mascot, or UGC inputs into a reviewable brief with rights and likeness confirmations.",
            ],
            [
              "Meetings & bookings",
              "Request intake",
              "Send a private organization-level request with the details WOVO needs to arrange the next step. Nothing is booked automatically.",
            ],
            [
              "Jobs",
              "Private intake",
              "Prepare job-posting or application materials without automated screening or hiring decisions.",
            ],
            [
              "Restaurant readiness",
              "Validated",
              "Restaurant generation requires a brand/logo plus at least one rights-confirmed food photo in the private asset library.",
            ],
          ].map(([title, status, copy]) => (
            <article
              key={title}
              className="rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{title}</h3>
                <span className="rounded-full bg-[#191714]/[.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#655f56]">
                  {status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#655f56]">{copy}</p>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}

function Services({
  account,
  orders,
  addons,
  busy,
  onAction,
}: {
  account: PortalAccount;
  orders: PortalOrder[];
  addons: PortalSnapshot["setup"]["addonsConfigured"];
  busy: string;
  onAction: (
    payload: Record<string, unknown>,
    success: string,
  ) => Promise<unknown>;
}) {
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onAction(
      {
        action: "create_order",
        accountId: account.id,
        orderType: data.get("orderType"),
        description: data.get("description"),
        location: data.get("location"),
        requestedFor: data.get("requestedFor"),
      },
      "Service request sent to the WOVO operations team.",
    );
    event.currentTarget.reset();
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d94326]">
          Workspace settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{account.business_name}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">
          Manage connected channels, service requests, and payment activity
          without digging through a long settings form.
        </p>
      </div>
      <nav aria-label="Settings sections" className="grid gap-3 md:grid-cols-3">
        <a
          href="#connections"
          className="rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 transition hover:-translate-y-0.5 hover:border-[#f05a3a]/45 hover:shadow-lg"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#f05a3a] text-xs font-black">
            01
          </span>
          <h2 className="mt-4 font-semibold">Connected channels</h2>
          <p className="mt-1 text-xs leading-5 text-[#756e64]">
            Facebook, Instagram, TikTok, and YouTube
          </p>
        </a>
        <a
          href="#service-request"
          className="rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 transition hover:-translate-y-0.5 hover:border-[#f05a3a]/45 hover:shadow-lg"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#191714] text-xs font-black text-white">
            02
          </span>
          <h2 className="mt-4 font-semibold">Service requests</h2>
          <p className="mt-1 text-xs leading-5 text-[#756e64]">
            Website, video, shoot, and drone work
          </p>
        </a>
        <a
          href="#orders"
          className="rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 transition hover:-translate-y-0.5 hover:border-[#f05a3a]/45 hover:shadow-lg"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4e5d9] text-xs font-black">
            03
          </span>
          <h2 className="mt-4 font-semibold">Orders & billing</h2>
          <p className="mt-1 text-xs leading-5 text-[#756e64]">
            Status, checkout, and history
          </p>
        </a>
      </nav>
      <section id="connections" className="scroll-mt-24">
        <ClientMetaConnection accountId={account.id} />
      </section>
      <form
        id="service-request"
        onSubmit={(event) => void request(event)}
        className={`${cardClass} scroll-mt-24`}
      >
        <h2 className="text-lg font-semibold">Request an add-on</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Service
            <select name="orderType" className={inputClass}>
              <option value="website">Website creation</option>
              <option value="ad_video">AI-assisted product / ad video</option>
              <option value="shoot">In-person shoot</option>
              <option value="drone">Commercial drone package</option>
            </select>
          </label>
          <label className="text-sm">
            Requested date
            <input
              name="requestedFor"
              type="datetime-local"
              className={inputClass}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Location
            <input
              name="location"
              maxLength={240}
              placeholder="Required for shoots and drone requests"
              className={inputClass}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            What do you need?
            <textarea
              name="description"
              maxLength={2000}
              className={textareaClass}
            />
          </label>
        </div>
        <div className="mt-4 rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] p-4 text-xs leading-5 text-[#655f56]">
          <p>
            Drone requests require advance notice, staff approval,
            availability/weather/airspace review, and an operational compliance
            check. Commercial fulfillment in the United States must be handled
            under applicable FAA Part 107 requirements. Travel is quoted
            transparently from WOVO&apos;s private dispatch point; no flight
            price is invented and no private address is disclosed.
          </p>
        </div>
        <button
          disabled={busy === "create_order"}
          className={`${primaryButton} mt-4`}
        >
          Submit request—no call required
        </button>
      </form>
      <section id="orders" className={`${cardClass} scroll-mt-24`}>
        <h2 className="text-lg font-semibold">Orders & payments</h2>
        <div className="mt-4 space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-[#191714]/10 bg-[#191714]/[.035] p-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-medium capitalize">
                  {order.order_type.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-sm text-[#7a7369]">
                  {order.description || "Scope pending WOVO review."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={order.status} />
                {["checkout_pending", "requested"].includes(order.status) &&
                addons[order.order_type] ? (
                  <button
                    onClick={() =>
                      void onAction(
                        {
                          action: "start_checkout",
                          accountId: account.id,
                          purchaseType: "addon",
                          orderId: order.id,
                        },
                        "Opening secure add-on checkout.",
                      )
                    }
                    className={primaryButton}
                  >
                    Pay configured base price
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!orders.length ? (
            <p className="rounded-xl border border-dashed border-[#191714]/15 p-8 text-center text-sm text-[#7a7369]">
              No add-on orders yet. Submit a scoped request without booking a
              sales call.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
