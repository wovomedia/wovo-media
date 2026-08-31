"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";

type Provider = "facebook" | "instagram" | "tiktok" | "youtube";
type Connection = {
  id: string;
  provider: Provider;
  accountId: string;
  accountName: string;
  status: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  metadata: Record<string, unknown>;
};
type ProviderRuntime = { configured: boolean; enabled: boolean; callbackUrl: string; audited?: boolean; oauthVerified?: boolean };
type ConnectionsPayload = { runtime: Record<Provider, ProviderRuntime>; connections: Connection[] };

const providerInfo: Record<Provider, { label: string; mark: string; description: string }> = {
  facebook: { label: "Facebook", mark: "f", description: "Pages, image posts, and Page Reels" },
  instagram: { label: "Instagram", mark: "◎", description: "Professional accounts, posts, and Reels" },
  tiktok: { label: "TikTok", mark: "♪", description: "Official Content Posting API" },
  youtube: { label: "YouTube", mark: "▶", description: "Videos and Shorts through YouTube Data API" },
};

const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-full bg-[#f05a3a] px-5 text-sm font-bold text-[#191714] transition hover:bg-[#df432d] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-full border border-[#191714]/15 bg-[#fffdf8] px-5 text-sm font-bold transition hover:border-[#f05a3a]/60 disabled:cursor-not-allowed disabled:opacity-45";

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    publishing_ready: "Publishing ready", connected: "Connected", action_required: "Action required",
    expired: "Expired", disconnected: "Disconnected", under_review: "Under review", test_mode: "Test mode",
    error: "Error", healthy: "Connected",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function checkedAt(value: string | null) {
  if (!value) return "not verified yet";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "not verified yet";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)} hours ago`;
  return new Date(time).toLocaleDateString();
}

export default function ClientMetaConnection({ accountId }: { accountId: string }) {
  const [data, setData] = useState<ConnectionsPayload | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    return fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);

  const load = useCallback(async () => {
    const response = await request(`/api/integrations/social/connections?accountId=${encodeURIComponent(accountId)}`);
    const payload = await response.json() as ConnectionsPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Connections could not load.");
    setData(payload);
  }, [accountId, request]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Connections could not load.")); }, [load]);

  const byProvider = useMemo(() => {
    const grouped = new Map<Provider, Connection[]>();
    for (const provider of Object.keys(providerInfo) as Provider[]) grouped.set(provider, []);
    for (const connection of data?.connections ?? []) grouped.get(connection.provider)?.push(connection);
    return grouped;
  }, [data]);

  async function connect(provider: Provider) {
    setBusy(`connect:${provider}`); setError("");
    try {
      const endpoint = provider === "facebook" || provider === "instagram" ? "/api/integrations/meta/connect" : `/api/integrations/${provider}/connect`;
      const response = await request(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || `${providerInfo[provider].label} authorization could not start.`);
      window.location.assign(payload.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authorization could not start.");
      setBusy("");
    }
  }

  async function connectionAction(connection: Connection, action: "verify" | "disconnect") {
    if (action === "disconnect" && !window.confirm(`Disconnect ${connection.accountName} from WOVO? Scheduled publishing to this destination will stop.`)) return;
    setBusy(`${action}:${connection.id}`); setError("");
    try {
      if (connection.id.startsWith("legacy-") && action === "disconnect") {
        const response = await request("/api/integrations/meta/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
        if (!response.ok) throw new Error("Meta connection could not be removed.");
      } else if (connection.id.startsWith("legacy-")) {
        throw new Error("Deploy the normalized social migration before running a live verification check.");
      } else {
        const response = await request("/api/integrations/social/connections", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, connectionId: connection.id, action }),
        });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || `Unable to ${action} this connection.`);
      }
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to ${action} this connection.`); }
    finally { setBusy(""); }
  }

  return <section className="overflow-hidden rounded-[28px] border border-[#191714]/10 bg-[#fffdf8] shadow-[0_24px_75px_rgba(25,23,20,.10)]">
    <header className="grid gap-6 border-b border-[#191714]/10 bg-[#191714] p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff8c70]">Connections</p><h2 className="mt-3 text-3xl font-medium tracking-[-.04em] sm:text-4xl">Connect WOVO to the places you publish.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Official provider authorization only. WOVO never asks for a Facebook, Instagram, TikTok, Google, or YouTube password.</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 text-xs leading-5 text-white/65"><strong className="block text-white">Approval first</strong>New work stays private until you review it, choose an account, and approve or schedule the post.</div>
    </header>
    <div className="grid gap-px bg-[#191714]/10 md:grid-cols-2">
      {(Object.keys(providerInfo) as Provider[]).map((provider) => {
        const info = providerInfo[provider];
        const providerRuntime = data?.runtime?.[provider];
        const connections = byProvider.get(provider) ?? [];
        const isMeta = provider === "facebook" || provider === "instagram";
        const productionGate = isMeta || (providerRuntime?.audited === true && (provider !== "youtube" || providerRuntime.oauthVerified === true));
        const canConnect = providerRuntime?.configured === true && productionGate;
        const aggregateStatus = connections.some((item) => item.status === "publishing_ready") ? "publishing_ready" : connections[0]?.status;
        return <article key={provider} className="bg-[#fffdf8] p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#191714] text-lg font-black text-[#ff765c]">{info.mark}</span><div><h3 className="text-xl font-semibold">{info.label}</h3><p className="mt-1 text-xs leading-5 text-[#756e64]">{info.description}</p></div></div>
            <span className="rounded-full border border-[#191714]/10 bg-[#f3ede4] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.08em]">{connections.length ? statusLabel(aggregateStatus) : providerRuntime?.configured ? productionGate ? "Disconnected" : "Under review" : "Unavailable"}</span>
          </div>
          <div className="mt-5 space-y-3">
            {connections.map((connection) => <div key={connection.id} className="rounded-2xl border border-[#191714]/10 bg-[#f6f0e7] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{connection.accountName}</p><p className="mt-1 text-xs text-[#756e64]">{statusLabel(connection.status)} · checked {checkedAt(connection.lastVerifiedAt)}</p></div><span className="h-2.5 w-2.5 rounded-full bg-[#f05a3a]" /></div>
              {connection.lastErrorMessage ? <p className="mt-3 rounded-xl border border-[#f05a3a]/25 bg-[#fff1ec] p-3 text-xs leading-5 text-[#8f301f]">{connection.lastErrorMessage}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void connectionAction(connection, "verify")} className={secondaryButton}>{busy === `verify:${connection.id}` ? "Checking…" : "Check publishing"}</button><button type="button" disabled={Boolean(busy)} onClick={() => void connectionAction(connection, "disconnect")} className="min-h-11 px-2 text-xs font-bold text-[#8f301f] underline underline-offset-4 disabled:opacity-40">Disconnect</button></div>
              <details className="mt-3 text-xs text-[#756e64]"><summary className="cursor-pointer font-bold text-[#191714]">Technical details</summary><dl className="mt-2 grid gap-1 leading-5"><div><dt className="inline font-bold">Provider account: </dt><dd className="inline">{connection.accountId}</dd></div><div><dt className="inline font-bold">Authorization expiry: </dt><dd className="inline">{connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).toLocaleString() : "Provider did not return an expiry"}</dd></div><div><dt className="inline font-bold">Last error code: </dt><dd className="inline">{connection.lastErrorCode ?? "None"}</dd></div></dl></details>
            </div>)}
          </div>
          {!connections.length ? <div className="mt-5 rounded-2xl border border-dashed border-[#191714]/15 p-4 text-sm leading-6 text-[#655f56]">{!providerRuntime?.configured ? `${info.label} credentials are not configured on this deployment.` : !productionGate ? `${info.label} implementation is ready for controlled testing, but the provider’s production review/audit is still required.` : `No ${info.label} account is connected to this workspace.`}</div> : null}
          <button type="button" disabled={Boolean(busy) || !canConnect} onClick={() => void connect(provider)} className={`${primaryButton} mt-4`}>{busy === `connect:${provider}` ? "Opening…" : connections.length ? `Add another ${info.label} account` : `Connect ${info.label}`}</button>
        </article>;
      })}
    </div>
    {error ? <p role="alert" className="m-5 rounded-xl border border-[#a9341f]/20 bg-[#fff1ec] p-3 text-sm font-semibold text-[#8f301f] sm:m-7">{error}</p> : null}
  </section>;
}
