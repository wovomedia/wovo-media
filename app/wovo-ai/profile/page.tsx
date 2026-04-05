"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { readSessionFromStorage } from "@/lib/supabase/session-client";
import { getAuthAccessState, resolveAiAccessState } from "@/lib/wovo-ai/access";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

const PLANS = [
  { name:"Starter", price:"$24.99/mo", credits:"50 credits/mo", priceId:"price_1T76wyFmIvQosWF9UoGSKAe2", perks:["50 AI credits/mo","Caption + Image","Business network"] },
  { name:"Growth",  price:"$49.99/mo", credits:"150 credits/mo", priceId:"price_1T76wSFmIvQosWF9u3GWCWBV", badge:"Most Popular", perks:["150 AI credits/mo","Everything in Starter","Network messaging"] },
  { name:"Pro",     price:"$99/mo",    credits:"300 credits/mo", priceId:"price_1T76vlFmIvQosWF9gmdPrCVT", perks:["300 AI credits/mo","Priority generation","Brand voice presets"] },
];

export default function WovoAiProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [token, setToken] = useState<string|null>(null);
  const [subscription, setSubscription] = useState<UnifiedSubscriptionResponse|null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState("");
  const [error, setError] = useState("");

  const active = resolveAiAccessState(subscription).hasAccess;
  const creditsLeft = subscription?.remaining.credits_remaining ?? 0;
  const planName = subscription?.plan?.trim() || "None";

  useEffect(() => {
    const session = readSessionFromStorage();
    const auth = getAuthAccessState({ session });
    if (!auth.isAuthenticated || !session?.access_token) { router.push("/login"); return; }
    setToken(session.access_token);
    void (async () => {
      try {
        const res = await fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        setSubscription((await res.json()) as UnifiedSubscriptionResponse);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed to load."); }
      finally { setLoading(false); }
    })();
  }, [router]);

  const checkout = async (priceId: string) => {
    if (!token) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body:JSON.stringify({ priceId, trial_period_days: 7 }) });
      const data = (await res.json()) as { url?:string; error?:string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Unable to start checkout.");
      window.location.href = data.url;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed."); setBusy(false); }
  };

  const openPortal = async () => {
    if (!token) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/stripe/portal", { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
      const data = (await res.json()) as { url?:string; error?:string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Unable to open billing portal.");
      window.location.href = data.url;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed."); setBusy(false); }
  };

  const deleteAccount = async () => {
    if (deletePrompt !== "DELETE") { setError("Type DELETE to confirm."); return; }
    if (!token) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/account/delete", { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json() as {error?:string}).error ?? "Failed.");
      await supabase.auth.signOut();
      router.push("/signup");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed."); setBusy(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">Loading profile…</main>;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/wovo-ai" className="text-sm text-zinc-500 hover:text-zinc-300 transition">← Back to Wovo Media AI</Link>
        </div>

        {/* Status */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-2xl font-black text-white mb-4">Account</h1>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center">
              <p className="text-2xl font-black text-emerald-400">{creditsLeft}</p>
              <p className="text-xs text-zinc-500 mt-1">Credits remaining</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center">
              <p className="text-lg font-bold text-white capitalize">{planName}</p>
              <p className="text-xs text-zinc-500 mt-1">Current plan</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center">
              <p className="text-lg font-bold text-white">{active ? "Active" : "Inactive"}</p>
              <p className="text-xs text-zinc-500 mt-1">Subscription status</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/wovo-ai/buy-credits" className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-300 transition">+ Buy Credits</Link>
            {active && <button onClick={() => void openPortal()} disabled={busy} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-60 transition">Manage Billing</button>}
          </div>
        </section>

        {/* Plans */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-white mb-1">{active ? "Change Plan" : "Choose a Plan"}</h2>
          <p className="text-sm text-zinc-400 mb-4">{active ? "Upgrade or downgrade your plan anytime." : "Pick a plan to unlock Wovo AI. 7-day free trial on all plans."}</p>
          {!active && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              🎁 7-day free trial — your card won't be charged until the trial ends.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map(plan => (
              <article key={plan.priceId} className={`rounded-xl border p-4 ${plan.badge ? "border-emerald-400/60 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                {plan.badge && <p className="mb-2 inline-block rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-black text-black">{plan.badge}</p>}
                <h3 className="font-bold text-white">{plan.name}</h3>
                <p className="text-xl font-black text-white">{plan.price}</p>
                <p className="text-xs text-zinc-400 mb-3">{plan.credits}</p>
                <ul className="space-y-1 text-xs text-zinc-300 mb-4">{plan.perks.map(p => <li key={p}>• {p}</li>)}</ul>
                <button disabled={busy} onClick={() => void checkout(plan.priceId)} className="w-full rounded-lg bg-white/10 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-60 transition">
                  {active ? "Switch to " + plan.name : "Start Free Trial →"}
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Account & Security</h2>
          <button onClick={() => { void supabase.auth.signOut(); router.push("/login"); }} className="mb-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition">Sign Out</button>
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-300 font-semibold">Delete Account</p>
            <p className="text-xs text-red-400 mt-1 mb-3">Type DELETE to confirm. This permanently removes your Wovo Media AI account and data.</p>
            <div className="flex gap-2">
              <input value={deletePrompt} onChange={e => setDeletePrompt(e.target.value)} placeholder="Type DELETE" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500"/>
              <button disabled={busy} onClick={() => void deleteAccount()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60 transition">Delete</button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </section>
      </div>
    </main>
  );
}
