"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortalContentItem } from "@/lib/portal/types";
import { getActiveSession } from "@/lib/supabase/session-client";

type Delivery = { id: string; source_content_item_id: string; destination: string; status: string; scheduled_for: string | null; provider_post_id: string | null; published_at: string | null; last_error_summary: string | null };
type Status = { connection: null | { status: string; pageName: string; instagramUsername: string | null; actionPolicy: string; killSwitch: boolean }; deliveries: Delivery[] };

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function ClientMetaDelivery({ accountId, items }: { accountId: string; items: PortalContentItem[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const approved = useMemo(() => items.filter((item) => item.status === "approved" && item.approved_snapshot_id && ["facebook", "instagram"].includes(item.platform)), [items]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    return fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);
  const load = useCallback(async () => {
    const response = await request(`/api/integrations/meta/status?accountId=${encodeURIComponent(accountId)}`);
    const payload = await response.json() as Status & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Meta delivery status could not load.");
    setStatus(payload);
  }, [accountId, request]);
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Meta delivery status could not load.")); }, [load]);

  async function act(item: PortalContentItem, action: "schedule_content" | "publish_content", scheduledFor?: string) {
    setBusy(`${action}:${item.id}`); setError(""); setNotice("");
    try {
      const response = await request("/api/integrations/meta/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, accountId, contentId: item.id, scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Meta did not accept this delivery.");
      setNotice(action === "publish_content" ? "Meta confirmed the post. Its provider receipt is recorded." : "The exact approved version is scheduled.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Meta did not accept this delivery."); }
    finally { setBusy(""); }
  }

  const connection = status?.connection;
  if (!connection || connection.status !== "healthy") return null;
  return <section className="rounded-[24px] border border-[#191714]/10 bg-[#191714] p-5 text-white shadow-[0_18px_50px_rgba(25,23,20,.12)] sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff8c70]">Connected publishing</p><h2 className="mt-2 text-2xl font-semibold">Choose the account, then schedule.</h2><p className="mt-2 text-sm text-white/60">Facebook: {connection.pageName}{connection.instagramUsername ? ` · Instagram: @${connection.instagramUsername}` : ""}</p></div><span className="rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-xs font-bold">Approval required</span></div>
    {connection.killSwitch || connection.actionPolicy === "draft_only" ? <p className="mt-5 rounded-xl border border-[#f05a3a]/30 bg-[#f05a3a]/10 p-4 text-sm text-[#ffc0b0]">Enable approved scheduling under Profile before sending anything to Meta.</p> : null}
    <div className="mt-5 space-y-3">{approved.map((item) => {
      const delivery = status?.deliveries?.find((entry) => entry.source_content_item_id === item.id);
      const destination = item.platform === "facebook" ? connection.pageName : connection.instagramUsername ? `@${connection.instagramUsername}` : "Instagram not connected";
      const mediaMissing = item.platform === "instagram" && !item.asset_id;
      return <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[.055] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#ff9b82]">{item.platform} · {destination}</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">{item.caption}</p></div>{delivery ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold capitalize">{delivery.status.replaceAll("_", " ")}</span> : null}</div>
        {mediaMissing ? <p className="mt-3 text-xs font-semibold text-[#ffc0b0]">Attach and reapprove a rights-confirmed image or video before Instagram delivery.</p> : null}
        {!delivery ? <form className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("scheduledFor") ?? ""); void act(item, "schedule_content", value); }}><label className="flex-1 text-xs font-semibold text-white/60">Publish date and time<input required name="scheduledFor" type="datetime-local" min={localDate(new Date(Date.now() + 120_000).toISOString())} defaultValue={localDate(item.scheduled_for)} className="mt-2 min-h-12 w-full rounded-xl border border-white/12 bg-[#11100f] px-3 text-sm text-white outline-none focus:border-[#f05a3a]" /></label><button disabled={Boolean(busy) || mediaMissing || connection.killSwitch} className="min-h-12 rounded-xl bg-[#f05a3a] px-5 text-sm font-bold text-[#191714] disabled:opacity-40">Schedule</button><button type="button" disabled={Boolean(busy) || mediaMissing || connection.killSwitch} onClick={() => void act(item, "publish_content")} className="min-h-12 rounded-xl border border-white/15 px-5 text-sm font-bold disabled:opacity-40">Publish now</button></form> : delivery.scheduled_for ? <p className="mt-3 text-xs text-white/55">Scheduled for {new Date(delivery.scheduled_for).toLocaleString()}</p> : null}
      </article>;
    })}{!approved.length ? <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">Approve a Facebook or Instagram draft and it will appear here for scheduling.</p> : null}</div>
    {notice ? <p className="mt-4 rounded-xl border border-[#4c8b62]/30 bg-[#2a5a3a]/25 p-3 text-sm font-semibold text-[#bde7c9]">{notice}</p> : null}{error ? <p role="alert" className="mt-4 rounded-xl border border-[#f05a3a]/30 bg-[#f05a3a]/10 p-3 text-sm font-semibold text-[#ffc0b0]">{error}</p> : null}
  </section>;
}
