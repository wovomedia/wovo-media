"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { readSessionFromStorage } from "@/lib/supabase/session-client";
import { getAuthAccessState } from "@/lib/wovo-ai/access";
import { CREDIT_PACKS } from "@/lib/wovo-ai/plans";

function BuyCreditsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [processingId, setProcessingId] = useState<string|null>(null);
  const success = searchParams.get("success") === "1";

  useEffect(() => {
    const session = readSessionFromStorage();
    const auth = getAuthAccessState({ session });
    if (!auth.isAuthenticated || !session?.access_token) { setLoading(false); router.push("/login"); return; }
    setToken(session.access_token);
    void fetch("/api/wovo-ai/subscription", { cache:"no-store", headers:{ Authorization:`Bearer ${session.access_token}` } })
      .then(r => r.json()).then((d: {remaining?: {credits_remaining?: number}}) => setCreditsRemaining(d?.remaining?.credits_remaining ?? 0))
      .finally(() => setLoading(false));
  }, [router]);

  const startCheckout = async (priceId: string) => {
    if (!token) return;
    setProcessingId(priceId);
    try {
      const res = await fetch("/api/stripe/create-credit-checkout", { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body:JSON.stringify({ priceId }) });
      const data = (await res.json()) as { url?:string; error?:string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.url) window.location.href = data.url;
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); setProcessingId(null); }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#060807] text-white">Loading...</div>;

  return (
    <main className="min-h-screen bg-[#060807] text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Buy Credits</h1>
            <p className="mt-2 text-sm text-zinc-400">Top up your credits — never run out of AI power.</p>
            <p className="mt-2 text-sm text-zinc-300">Current credits: <span className="font-black text-emerald-400">{creditsRemaining}</span></p>
          </div>
          <Link href="/wovo-ai" className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10 transition">← Back to Wovo Media AI</Link>
        </div>
        {success && <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">✅ Credits added successfully!</div>}
        <div className="grid gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map(pack => (
            <article key={pack.priceId} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${pack.label === "Medium Pack" ? "border-emerald-400/80 bg-emerald-500/10" : "border-white/10 bg-black/30"}`}>
              {pack.label === "Medium Pack" && <p className="mb-2 inline-block rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-black text-black">Most Popular</p>}
              <h2 className="text-lg font-black text-white">{pack.label}</h2>
              <p className="text-2xl font-black text-white mt-1">${pack.price.toFixed(2)}</p>
              <p className="text-sm text-zinc-400 mb-4">+{pack.credits} credits · one-time</p>
              <button type="button" onClick={() => void startCheckout(pack.priceId)} disabled={processingId === pack.priceId} className="w-full rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60 transition">
                {processingId === pack.priceId ? "Redirecting..." : "Buy Credits"}
              </button>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-600">Credits never expire while your subscription is active. Secure checkout via Stripe.</p>
      </div>
    </main>
  );
}

export default function BuyCreditsPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#060807] text-white">Loading...</div>}><BuyCreditsContent /></Suspense>;
}
