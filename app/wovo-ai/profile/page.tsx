"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { readSessionFromStorage } from "@/lib/supabase/session-client";

type SubscriptionPayload = {
  active?: boolean;
  hasPlan?: boolean;
  remaining_credits?: number;
  remainingCredits?: number;
  plan?: string;
  planName?: string;
  tier?: string;
};

const PLANS = [
  { name: "Starter", priceLabel: "$24.99/mo", credits: "25 credits/mo", priceId: "price_1T76wyFmIvQosWF9UoGSKAe2", perks: ["25 AI credits every month", "Core Wovo AI tools", "Fast setup"] },
  { name: "Growth", priceLabel: "$49.99/mo", credits: "50 credits/mo", priceId: "price_1T76wSFmIvQosWF9u3GWCWBV", perks: ["50 AI credits every month", "More output for active teams", "Better monthly value"] },
  { name: "Pro", priceLabel: "$99/mo", credits: "100 credits/mo", priceId: "price_1T76vlFmIvQosWF9gmdPrCVT", badge: "Most Popular", perks: ["100 AI credits every month", "Most Benefits + best value", "Priority tier for serious creators"] },
] as const;

export default function WovoAiProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState("");
  const [error, setError] = useState("");

  const active = Boolean(subscription?.active ?? subscription?.hasPlan);
  const creditsLeft = subscription?.remaining_credits ?? subscription?.remainingCredits ?? 0;
  const planName = useMemo(() => (subscription?.planName ?? subscription?.plan ?? subscription?.tier)?.trim() || "No plan", [subscription]);

  useEffect(() => {
    const session = readSessionFromStorage();
    if (!session?.access_token) {
      router.push("/login");
      return;
    }

    setToken(session.access_token);

    void (async () => {
      try {
        const res = await fetch("/api/wovo-ai/subscription", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const data = (await res.json()) as SubscriptionPayload;
        setSubscription(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load subscription.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const checkout = async (priceId: string) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Unable to start checkout.");
      window.location.href = data.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout.");
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Unable to open billing portal.");
      window.location.href = data.url;
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Unable to open billing portal.");
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const deleteAccount = async () => {
    if (deletePrompt !== "DELETE") {
      setError("Please type DELETE to confirm account deletion.");
      return;
    }
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unable to delete account.");
      await supabase.auth.signOut();
      router.push("/signup");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete account.");
      setBusy(false);
    }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">Loading profile…</main>;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-3xl font-semibold">Wovo AI Profile</h1>
          <div className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">Credits left: <span className="font-semibold text-white">{creditsLeft}</span></p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">Current plan: <span className="font-semibold text-white">{planName}</span></p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          {!active ? (
            <>
              <h2 className="text-xl font-semibold">Choose a plan</h2>
              <p className="mt-1 text-sm text-zinc-400">Your account is subscription-locked. Pick a plan to access Wovo AI.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {PLANS.map((plan) => (
                  <article key={plan.priceId} className={`rounded-xl border p-4 ${plan.name === "Pro" ? "border-violet-400 bg-violet-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                    {plan.badge ? <p className="mb-2 inline-block rounded-full bg-violet-500 px-2 py-0.5 text-xs font-semibold">{plan.badge}</p> : null}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="text-zinc-300">{plan.priceLabel}</p>
                    <p className="text-sm text-zinc-400">{plan.credits}</p>
                    <ul className="mt-3 space-y-1 text-sm text-zinc-300">{plan.perks.map((perk) => <li key={perk}>• {perk}</li>)}</ul>
                    <button disabled={busy} onClick={() => void checkout(plan.priceId)} className="mt-4 w-full rounded-lg bg-white/90 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-60">Select {plan.name}</button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">Your subscription is active</h2>
              <p className="mt-1 text-sm text-zinc-400">Manage billing, cancel in the Stripe billing portal, or change plans anytime.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button disabled={busy} onClick={() => void openPortal()} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-60">Manage Billing</button>
                <button disabled={busy} onClick={() => void openPortal()} className="rounded-lg border border-red-500/70 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60">Cancel subscription (in billing portal)</button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {PLANS.map((plan) => (
                  <article key={`upgrade-${plan.priceId}`} className={`rounded-xl border p-4 ${plan.name === "Pro" ? "border-violet-400 bg-violet-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                    {plan.badge ? <p className="mb-2 inline-block rounded-full bg-violet-500 px-2 py-0.5 text-xs font-semibold">{plan.badge}</p> : null}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="text-zinc-300">{plan.priceLabel}</p>
                    <p className="text-sm text-zinc-400">{plan.credits}</p>
                    <ul className="mt-3 space-y-1 text-sm text-zinc-300">{plan.perks.map((perk) => <li key={perk}>• {perk}</li>)}</ul>
                    <button disabled={busy} onClick={() => void checkout(plan.priceId)} className="mt-4 w-full rounded-lg bg-white/90 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-60">Upgrade / Change to {plan.name}</button>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-semibold">Account & Security</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => void signOut()} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">Sign out</button>
          </div>
          <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
            <p className="text-sm text-red-200">Delete account permanently</p>
            <p className="mt-1 text-xs text-red-300">Type DELETE to confirm. This removes your Wovo AI data and account access.</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input value={deletePrompt} onChange={(event) => setDeletePrompt(event.target.value)} placeholder="Type DELETE" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none ring-violet-400/80 focus:ring" />
              <button disabled={busy} onClick={() => void deleteAccount()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">Delete account</button>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
