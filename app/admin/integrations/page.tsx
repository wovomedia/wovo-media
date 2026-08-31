"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { readSessionFromStorage } from "@/lib/supabase/session-client";

type Diagnostics = Record<string, unknown> & { generatedAt?: string; audience?: string };

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function status(value: unknown) { return value === true ? "Ready" : value === false ? "Blocked" : String(value ?? "Not checked"); }

export default function IntegrationDiagnosticsPage() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setError("");
    const token = readSessionFromStorage()?.access_token;
    if (!token) { window.location.replace("/login?next=/admin/integrations"); return; }
    const response = await fetch("/api/admin/integrations/diagnostics", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const payload = await response.json() as Diagnostics & { error?: string };
    if (response.status === 401 || response.status === 403) { window.location.replace("/wovo-ai"); return; }
    if (!response.ok) throw new Error(payload.error ?? "Diagnostics could not load.");
    setData(payload); setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Diagnostics could not load.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sections = data ? Object.entries(data).filter(([key, value]) => !["generatedAt", "audience"].includes(key) && isRecord(value)) : [];
  return <main className="min-h-screen bg-[#0d0c0b] px-4 py-8 text-[#fffaf2] sm:px-7">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff765c]">Owner-only development surface</p><h1 className="mt-3 text-4xl font-medium tracking-[-.05em]">Integration diagnostics</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Configuration and persisted provider proof only. Secrets and tokens are never returned to this page.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="min-h-11 rounded-full bg-[#f05a3a] px-5 text-sm font-bold text-[#191714]">Refresh snapshot</button><Link href="/admin" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-bold">Back to admin</Link></div></header>
      {loading ? <p className="py-16 text-sm text-white/55">Verifying owner access and loading diagnostics…</p> : null}
      {error ? <p className="mt-6 rounded-2xl border border-[#f05a3a]/30 bg-[#f05a3a]/10 p-4 text-sm">{error}</p> : null}
      {data ? <><div className="mt-5 flex flex-wrap gap-2 text-xs text-white/45"><span>Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "now"}</span><span>·</span><span>Admin authorization verified</span></div><div className="mt-7 grid gap-4 lg:grid-cols-2">{sections.map(([name, raw]) => {
        const values = raw as Record<string, unknown>;
        return <section key={name} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#171513]"><div className="border-b border-white/10 px-5 py-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ff765c]">{name}</p></div><dl className="divide-y divide-white/[.07]">{Object.entries(values).map(([key, value]) => <div key={key} className="grid gap-2 px-5 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-bold capitalize text-white/55">{key.replaceAll(/([A-Z])/g, " $1")}</dt><dd className="min-w-0 break-words text-sm">{typeof value === "boolean" ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${value ? "bg-[#f05a3a] text-[#191714]" : "bg-white/10 text-white/60"}`}>{status(value)}</span> : typeof value === "string" || typeof value === "number" ? String(value) : <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[11px] leading-5 text-white/65">{JSON.stringify(value, null, 2)}</pre>}</dd></div>)}</dl></section>;
      })}</div></> : null}
    </div>
  </main>;
}
