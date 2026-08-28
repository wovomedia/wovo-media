"use client";

import { useCallback, useEffect, useState } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";

type ConnectionStatus = {
  runtime: { launchState: "connection_ready" | "blocked" };
  connection: null | {
    status: string;
    pageName: string;
    instagramUsername: string | null;
    actionPolicy: string;
    killSwitch: boolean;
  };
};

const button = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-4 text-sm font-bold text-[#191714] transition hover:bg-[#e34d2f] disabled:cursor-not-allowed disabled:opacity-50";

export default function ClientMetaConnection({ accountId }: { accountId: string }) {
  const [data, setData] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    return fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);

  const load = useCallback(async () => {
    const response = await request(`/api/integrations/meta/status?accountId=${encodeURIComponent(accountId)}`);
    const payload = await response.json() as ConnectionStatus & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Social connection status could not load.");
    setData(payload);
  }, [accountId, request]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Social connection status could not load.")); }, [load]);

  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await request("/api/integrations/meta/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Meta authorization could not start.");
      window.location.assign(payload.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Meta authorization could not start.");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this workspace from Facebook and Instagram? Scheduled provider posts will stop.")) return;
    setBusy(true); setError("");
    try {
      const response = await request("/api/integrations/meta/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The connection could not be removed.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The connection could not be removed."); }
    finally { setBusy(false); }
  }

  const connection = data?.connection;
  const connected = connection?.status === "healthy";
  const ready = data?.runtime.launchState === "connection_ready";

  return <section className="overflow-hidden rounded-[24px] border border-[#191714]/10 bg-[#fffdf8] shadow-[0_18px_55px_rgba(25,23,20,.08)]">
    <div className="grid lg:grid-cols-[.78fr_1.22fr]">
      <div className="bg-[#191714] p-6 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff8c70]">Social connections</p><h2 className="mt-3 text-3xl font-medium tracking-[-.035em]">Your Page. Your permission.</h2><p className="mt-3 text-sm leading-6 text-white/65">Connect through Meta’s official authorization screen. WOVO never receives your Facebook or Instagram password.</p><div className="mt-6 rounded-2xl border border-white/10 bg-white/[.06] p-4 text-sm leading-6 text-white/70"><strong className="block text-white">Approval first</strong>New connections start with publishing blocked. Content must be reviewed and scheduled before WOVO can send it to Meta.</div></div>
      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Facebook + Instagram</p><h3 className="mt-2 text-2xl font-semibold">{connected ? "Connected to this workspace" : "Connect your business accounts"}</h3></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${connected ? "bg-[#e0efe5] text-[#245a3b]" : "bg-[#eee7dd] text-[#655f56]"}`}>{connected ? "Connected" : "Not connected"}</span></div>
        {connected && connection ? <div className="mt-5 rounded-2xl border border-[#191714]/10 bg-[#f7f2e9] p-5"><p className="text-lg font-bold">{connection.pageName}</p><p className="mt-1 text-sm text-[#655f56]">{connection.instagramUsername ? `Instagram @${connection.instagramUsername}` : "No linked Instagram professional account was returned by Meta."}</p><div className="mt-4 grid gap-2 text-xs text-[#756e64] sm:grid-cols-2"><p><strong className="block text-[#191714]">Publishing mode</strong>{connection.actionPolicy === "approve_each" ? "Review every post" : connection.actionPolicy.replaceAll("_", " ")}</p><p><strong className="block text-[#191714]">Safety switch</strong>{connection.killSwitch ? "On—provider publishing blocked" : "Off—approved schedules may publish"}</p></div><button type="button" disabled={busy} onClick={() => void disconnect()} className="mt-5 min-h-11 text-sm font-bold text-[#8f301f] underline underline-offset-4 disabled:opacity-50">Disconnect accounts</button></div> : <div className="mt-5"><ol className="grid gap-3 text-sm sm:grid-cols-3">{["Sign in to Meta", "Choose your business Page", "Confirm its linked Instagram account"].map((item, index) => <li key={item} className="rounded-xl border border-[#191714]/10 bg-[#f7f2e9] p-3"><span className="mr-2 font-bold text-[#d94326]">{index + 1}</span>{item}</li>)}</ol>{ready ? <button type="button" disabled={busy} onClick={() => void connect()} className={`${button} mt-5`}>{busy ? "Opening Meta…" : "Connect Facebook & Instagram"}</button> : <p className="mt-5 rounded-xl border border-[#a9341f]/20 bg-[#fff1ec] p-3 text-sm font-semibold text-[#8f301f]">Meta authorization is temporarily unavailable. Your workspace remains private.</p>}</div>}
        {error ? <p role="alert" className="mt-4 rounded-xl border border-[#a9341f]/20 bg-[#fff1ec] p-3 text-sm font-semibold text-[#8f301f]">{error}</p> : null}
      </div>
    </div>
  </section>;
}
