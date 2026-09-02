"use client";

import { useCallback, useEffect, useState } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";

type Status = {
  runtime: { featureEnabled: boolean; appConfigured: boolean; tokenEncryptionConfigured: boolean; redirectUrl: string };
  connection: null | { status: string; actionPolicy: string; pageName: string; instagramUsername: string | null; killSwitch: boolean; lastCheckedAt: string; lastActionAt: string | null; grantedScopes: string[]; e2eVerifiedAt: string | null; autoPublishOptedInAt: string | null };
};

const button = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#191714] px-4 text-sm font-bold text-white disabled:opacity-45";

export default function OwnerMetaConnection() {
  const [data, setData] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your owner session expired.");
    return fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);
  const load = useCallback(async () => {
    const response = await request("/api/integrations/meta/status");
    const payload = await response.json() as Status & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Meta status could not load.");
    setData(payload);
  }, [request]);
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Meta status could not load.")); }, [load]);
  async function post(url: string, payload: Record<string, unknown>) {
    setBusy(String(payload.action || "connect")); setMessage("");
    try {
      const response = await request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; url?: string; published?: boolean; generated?: boolean };
      if (!response.ok) throw new Error(result.error || "Meta request failed.");
      if (result.url) { window.location.href = result.url; return; }
      setMessage(result.generated
        ? "AI video generation started. When the provider finishes, Facebook and Instagram drafts will appear in Verifying for your approval and scheduling. Nothing was published."
        : result.published
          ? "Meta confirmed the WOVO Page test post."
          : "Meta policy saved."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Meta request failed."); }
    finally { setBusy(""); }
  }
  if (!data) return <section className="rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5"><p className="text-sm text-[#655f56]">{message || "Checking official Meta connection…"}</p></section>;
  const ready = data.runtime.featureEnabled && data.runtime.appConfigured && data.runtime.tokenEncryptionConfigured;
  return <section className="rounded-2xl border border-[#191714]/10 bg-[#fffdf8] p-5 shadow-[0_18px_55px_rgba(25,23,20,.07)] sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d94326]">Official Meta publishing</p><h3 className="mt-2 text-2xl font-medium">WOVO Facebook + Instagram</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-[#655f56]">Uses Meta OAuth—never a stored social password. A kill switch blocks all provider posts.</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${data.connection?.status === "healthy" ? "bg-[#dff3e8] text-[#205b3b]" : "bg-[#eee7dd] text-[#6c6258]"}`}>{data.connection?.status === "healthy" ? "Connected" : "Not connected"}</span></div>
    {message ? <p role="status" className="mt-4 rounded-xl bg-[#f05a3a]/10 p-3 text-sm text-[#7d2d1f]">{message}</p> : null}
    {!data.connection ? <div className="mt-5"><p className="text-sm text-[#655f56]">{ready ? "Connect the WOVO-managed Facebook Page and its linked Instagram professional account." : "Meta stays blocked until the app credentials, feature gate, and token encryption key are configured."}</p>{ready ? <button disabled={busy === "connect"} className={`${button} mt-4`} onClick={() => void post("/api/integrations/meta/connect", {})}>Connect WOVO Meta accounts</button> : null}<p className="mt-3 text-xs text-[#81796f]">OAuth callback: {data.runtime.redirectUrl}</p></div> : <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-[#191714]/10 bg-white p-4"><p className="font-bold">{data.connection.pageName}</p><p className="mt-1 text-sm text-[#655f56]">{data.connection.instagramUsername ? `Instagram @${data.connection.instagramUsername}` : "No linked Instagram professional account returned"}</p><p className="mt-3 text-xs text-[#81796f]">Last checked {new Date(data.connection.lastCheckedAt).toLocaleString()} · last post {data.connection.lastActionAt ? new Date(data.connection.lastActionAt).toLocaleString() : "none"}</p><p className="mt-2 text-xs font-bold text-[#655f56]">Provider test: {data.connection.e2eVerifiedAt ? `verified ${new Date(data.connection.e2eVerifiedAt).toLocaleDateString()}` : "not yet verified"}</p><button className="mt-4 min-h-11 text-sm font-bold text-[#8f2118] underline underline-offset-4" onClick={() => void post("/api/integrations/meta/revoke", {})}>Disconnect</button></div>
      <form className="rounded-xl border border-[#191714]/10 bg-[#f5f0e7] p-4" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void post("/api/integrations/meta/publish", { action: "update_policy", actionPolicy: values.get("policy"), killSwitch: values.get("killSwitch") === "on" }); }}><label className="text-sm font-bold">Publishing policy<select name="policy" defaultValue={data.connection.actionPolicy} className="mt-1 min-h-11 w-full rounded-lg border border-[#191714]/15 bg-white px-3 text-sm"><option value="draft_only">Draft only</option><option value="approve_each">Approve each post</option><option value="scheduled_auto_publish">Scheduled automatic posts</option></select></label><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" name="killSwitch" defaultChecked={data.connection.killSwitch} className="mt-1" /><span><strong>Publishing kill switch</strong><span className="block text-xs text-[#655f56]">Keep checked to prevent all provider posts.</span></span></label><button disabled={busy === "update_policy"} className={`${button} mt-4`}>Save Meta policy</button></form>
      {!data.connection.killSwitch ? <div className="rounded-xl border border-[#f05a3a]/25 p-4 lg:col-span-2"><p className="font-bold">Automatic AI video drafts</p><p className="mt-2 text-sm leading-6 text-[#655f56]">With <strong>Scheduled automatic posts</strong> selected, WOVO can generate one original vertical AI video and a factual three-hashtag caption at 9:00 AM, 1:00 PM, and 6:00 PM America/Chicago. Every result enters <strong>Verifying</strong>. Nothing reaches Facebook or Instagram until you inspect the video, approve it, and choose a schedule time. Per-slot keys prevent duplicates and stale slots never catch up.</p>{data.connection.actionPolicy === "scheduled_auto_publish" ? <button disabled={busy === "generate_video_draft"} className={`${button} mt-4 bg-[#f05a3a] text-[#191714]`} onClick={() => void post("/api/integrations/meta/publish", { action: "generate_video_draft", confirmed: true })}>{busy === "generate_video_draft" ? "Starting video…" : "Generate today’s video draft"}</button> : <p className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-[#8a5d17]">Select Scheduled automatic posts and save to enable reviewed video generation.</p>}</div> : null}
    </div>}
  </section>;
}
