"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";

type Snapshot = {
  series: null | { title: string; character_name: string; character_description: string; audience: string; series_goal: string; style_direction: string; do_not_include: string; timezone: string; source_rights_confirmed: boolean; identifiable_person_included: boolean; likeness_consent_confirmed: boolean; voice_consent_confirmed: boolean; auto_generate_enabled: boolean; kill_switch: boolean; status: string };
  episodes: Array<{ id: string; episode_number: number; status: string; title: string | null; premise: string | null; caption: string | null; created_at: string; last_error_summary: string | null }>;
  hasAccess: boolean;
  staffTestAccess: boolean;
  provider: { text: boolean; video: boolean };
  checkout: { enabled: boolean; label: string; renewalLabel: string };
};

const surface = "rounded-2xl border border-[#191714]/10 bg-[#fffdf8] shadow-[0_18px_55px_rgba(25,23,20,.07)]";
const field = "mt-1 min-h-12 w-full rounded-xl border border-[#191714]/14 bg-white px-3.5 text-sm outline-none focus:border-[#f05a3a] focus:ring-2 focus:ring-[#f05a3a]/15";
const button = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-sm font-bold text-[#191714] hover:bg-[#df4c30] disabled:cursor-not-allowed disabled:opacity-45";

function readable(value: string) { return value.replaceAll("_", " "); }

export default function CartoonSeries({ accountId }: { accountId: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (init?: RequestInit) => {
    const token = (await getActiveSession())?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    const suffix = init?.method ? "" : `?accountId=${encodeURIComponent(accountId)}`;
    return fetch(`/api/portal/cartoon${suffix}`, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, [accountId]);

  const load = useCallback(async () => {
    const response = await request();
    const payload = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Cartoon Episodes could not load.");
    setData(payload);
  }, [request]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Cartoon Episodes could not load.")); }, [load]);

  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(String(payload.action)); setError(""); setNotice("");
    try {
      const response = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, accountId }) });
      const result = await response.json() as { error?: string; url?: string };
      if (!response.ok) throw new Error(result.error || "That request could not be completed.");
      if (result.url) { window.location.href = result.url; return; }
      setNotice(success); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "That request could not be completed."); }
    finally { setBusy(""); }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void action({
      action: "save_series",
      title: values.get("title"),
      characterName: values.get("characterName"),
      characterDescription: values.get("characterDescription"),
      audience: values.get("audience"),
      seriesGoal: values.get("seriesGoal"),
      styleDirection: values.get("styleDirection"),
      doNotInclude: values.get("doNotInclude"),
      timezone: values.get("timezone"),
      sourceRightsConfirmed: values.get("rights") === "on",
      identifiablePersonIncluded: values.get("person") === "on",
      likenessConsentConfirmed: values.get("likeness") === "on",
      voiceConsentConfirmed: values.get("voice") === "on",
      autoGenerateEnabled: values.get("automatic") === "on",
      paused: values.get("paused") === "on",
    }, "Series setup saved. Nothing was published.");
  }

  if (!data) return <section className={`${surface} p-5`}><p className="text-sm text-[#655f56]">{error || "Loading Cartoon Episodes…"}</p></section>;

  return <section className={`${surface} overflow-hidden`}>
    <div className="grid lg:grid-cols-[1.25fr_.75fr]">
      <div className="p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">Cartoon Episodes</p>
        <h2 className="mt-2 max-w-xl text-3xl font-medium tracking-[-.035em]">Your character. Three short episodes every week.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#655f56]">WOVO prepares an original eight-second vertical cartoon on Monday, Wednesday, and Friday from your approved character brief. Each video and caption stays private until you review it.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">{["3 episodes / week", "8-second vertical video", "Private review queue"].map((item) => <div key={item} className="rounded-xl border border-[#191714]/10 bg-white p-3 text-sm font-semibold">{item}</div>)}</div>
      </div>
      <div className="flex flex-col justify-between bg-[#191714] p-5 text-white sm:p-7">
        <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ff8c70]">Separate subscription</p><p className="mt-3 text-3xl font-medium">$39.99<span className="text-base text-white/65"> / month</span></p><p className="mt-3 text-sm leading-6 text-white/65">Renews monthly until canceled. Human editing, custom shoots, and social ad spend are not included.</p></div>
        {!data.hasAccess && data.checkout.enabled ? <button disabled={busy === "start_checkout"} className={`${button} mt-5 w-full`} onClick={() => void action({ action: "start_checkout" }, "Opening secure checkout.")}>Activate Cartoon Episodes</button> : <p className="mt-5 text-sm font-semibold text-[#ffb6a4]">{data.hasAccess ? (data.staffTestAccess ? "Owner test access · audited" : "Subscription active") : "Activation is temporarily unavailable"}</p>}
      </div>
    </div>

    <div className="border-t border-[#191714]/10 p-5 sm:p-7">
      {notice ? <p role="status" className="mb-4 rounded-xl bg-[#f05a3a]/10 p-3 text-sm text-[#7d2d1f]">{notice}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl bg-[#fff1ed] p-3 text-sm text-[#8f2118]">{error}</p> : null}
      <details open={!data.series}>
        <summary className="cursor-pointer text-lg font-bold">Character and series setup</summary>
        <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={save}>
          <label className="text-sm font-bold">Series name<input required name="title" maxLength={120} defaultValue={data.series?.title || ""} className={field} placeholder="The Corner Crew" /></label>
          <label className="text-sm font-bold">Character name<input required name="characterName" maxLength={100} defaultValue={data.series?.character_name || ""} className={field} placeholder="Milo" /></label>
          <label className="text-sm font-bold lg:col-span-2">Who is the character?<textarea required name="characterDescription" maxLength={3000} defaultValue={data.series?.character_description || ""} className={`${field} min-h-24 py-3`} placeholder="An original upbeat fox mascot who helps customers understand our weekly specials." /></label>
          <label className="text-sm font-bold">Audience<input required name="audience" maxLength={1000} defaultValue={data.series?.audience || ""} className={field} placeholder="Local families and lunch customers" /></label>
          <label className="text-sm font-bold">Series goal<input required name="seriesGoal" maxLength={1500} defaultValue={data.series?.series_goal || ""} className={field} placeholder="Make our specials memorable" /></label>
          <label className="text-sm font-bold">Visual direction<input required name="styleDirection" maxLength={1500} defaultValue={data.series?.style_direction || ""} className={field} placeholder="Warm hand-drawn animation, bold shapes" /></label>
          <label className="text-sm font-bold">Never include<input name="doNotInclude" maxLength={1500} defaultValue={data.series?.do_not_include || ""} className={field} placeholder="Competitor logos, prices not supplied by us" /></label>
          <label className="text-sm font-bold">Timezone<input required name="timezone" maxLength={80} defaultValue={data.series?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} className={field} /></label>
          <div className="space-y-2 lg:col-span-2">
            <label className="flex min-h-12 items-start gap-3 rounded-xl border border-[#191714]/10 p-3 text-sm"><input required name="rights" type="checkbox" defaultChecked={data.series?.source_rights_confirmed} className="mt-1" /><span>I own or have permission to use every character and reference asset supplied to WOVO.</span></label>
            <label className="flex min-h-12 items-start gap-3 rounded-xl border border-[#191714]/10 p-3 text-sm"><input name="person" type="checkbox" defaultChecked={data.series?.identifiable_person_included} className="mt-1" /><span>The series includes a recognizable real person.</span></label>
            <label className="flex min-h-12 items-start gap-3 rounded-xl border border-[#191714]/10 p-3 text-sm"><input name="likeness" type="checkbox" defaultChecked={data.series?.likeness_consent_confirmed} className="mt-1" /><span>Each recognizable person gave explicit likeness permission.</span></label>
            <label className="flex min-h-12 items-start gap-3 rounded-xl border border-[#191714]/10 p-3 text-sm"><input name="voice" type="checkbox" defaultChecked={data.series?.voice_consent_confirmed} className="mt-1" /><span>Each recognizable voice owner gave explicit permission.</span></label>
          </div>
          {data.hasAccess && data.provider.video ? <label className="flex min-h-12 items-start gap-3 rounded-xl border border-[#f05a3a]/25 bg-[#f05a3a]/5 p-3 text-sm lg:col-span-2"><input name="automatic" type="checkbox" defaultChecked={data.series?.auto_generate_enabled} className="mt-1" /><span><strong>Prepare three episodes automatically.</strong><span className="mt-1 block text-[#655f56]">WOVO queues Monday, Wednesday, and Friday drafts. Publishing still requires review and a separately verified connection.</span></span></label> : null}
          {data.series ? <label className="flex items-center gap-2 text-sm lg:col-span-2"><input name="paused" type="checkbox" defaultChecked={data.series.kill_switch} />Pause all future episode generation</label> : null}
          <button disabled={busy === "save_series"} className={`${button} lg:col-span-2 lg:w-fit`}>Save series setup</button>
        </form>
      </details>

      {data.hasAccess && data.series && data.provider.video ? <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#191714]/10 pt-5"><div><h3 className="font-bold">Episode queue</h3><p className="mt-1 text-sm text-[#655f56]">Nothing in this queue is posted automatically.</p></div><button disabled={busy === "generate_now"} className={button} onClick={() => void action({ action: "generate_now" }, "Episode queued. Generation continues securely on WOVO servers.")}>Create next episode</button></div> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2">{data.episodes.map((episode) => <article key={episode.id} className="rounded-xl border border-[#191714]/10 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#d94326]">Episode {episode.episode_number}</p><h4 className="mt-1 font-bold">{episode.title || "Preparing episode"}</h4></div><span className="text-xs font-bold capitalize text-[#655f56]">{readable(episode.status)}</span></div>{episode.premise ? <p className="mt-3 text-sm leading-6 text-[#655f56]">{episode.premise}</p> : null}{episode.last_error_summary ? <p className="mt-3 text-sm text-[#8f2118]">{episode.last_error_summary}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{["needs_approval", "draft_ready", "approved"].includes(episode.status) ? <button className="min-h-11 rounded-lg border border-[#191714]/15 px-3 text-sm font-bold" onClick={() => void action({ action: "open_episode", episodeId: episode.id }, "Opening private video.")}>Open video</button> : null}{["needs_approval", "draft_ready"].includes(episode.status) ? <button className="min-h-11 rounded-lg bg-[#191714] px-3 text-sm font-bold text-white" onClick={() => void action({ action: "approve_episode", episodeId: episode.id }, "Episode approved. It was not published.")}>Approve draft</button> : null}</div></article>)}{!data.episodes.length ? <p className="rounded-xl border border-dashed border-[#191714]/15 p-6 text-center text-sm text-[#756e64] md:col-span-2">Your first episode appears here after setup and activation.</p> : null}</div>
    </div>
  </section>;
}
