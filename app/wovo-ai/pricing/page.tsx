"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readSessionFromStorage } from "@/lib/supabase/session-client";
import { supabase } from "@/lib/supabase/client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { getAuthAccessState } from "@/lib/wovo-ai/access";

const CARDS = [
  {
    key: "starter",
    title: "Starter",
    price: "$24.99/month",
    credits: "50 credits / month",
    priceId: "price_1T76wyFmIvQosWF9UoGSKAe2",
    features: ["50 AI credits/mo","Caption generator","AI image generation","Business network"],
  },
  {
    key: "growth",
    title: "Growth",
    price: "$49.99/month",
    credits: "150 credits / month",
    priceId: "price_1T76wSFmIvQosWF9u3GWCWBV",
    badge: "Most Popular",
    features: ["150 AI credits/mo","Caption + Image together","Saved chats","Network messaging"],
  },
  {
    key: "pro",
    title: "Pro",
    price: "$99/month",
    credits: "300 credits / month",
    priceId: "price_1T76vlFmIvQosWF9gmdPrCVT",
    features: ["300 AI credits/mo","Priority generation","Brand voice presets","Priority support"],
  },
] as const;

export default function WovoPricingPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UnifiedSubscriptionResponse | null>(null);
  const [error, setError] = useState("");

  const active = useMemo(() => subscription?.status === "active" || subscription?.status === "inactive" && false, [subscription]);

  useEffect(() => {
    const s = readSessionFromStorage();
    const authState = getAuthAccessState({ session: s });
    if (!authState.isAuthenticated || !s?.access_token) return void router.push("/login");
    supabase.setAccessToken(s.access_token);
    setToken(s.access_token);
    void fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${s.access_token}` } })
      .then(r => r.json())
      .then((data: UnifiedSubscriptionResponse) => {
        setSubscription(data);
        if (data.has_access) router.replace("/wovo-ai");
      });
  }, [router]);

  const choose = async (priceId: string) => {
    if (!token) return;
    const endpoint = active ? "/api/stripe/upgrade" : "/api/stripe/checkout";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ priceId, trial_period_days: 7 }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok) { setError(data.error ?? "Failed"); return; }
    if (data.url) window.location.href = data.url;
    else router.push("/wovo-ai");
  };

  return (
    <main className="min-h-screen bg-[#060807] px-4 py-16 text-white sm:px-6">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-4xl font-black text-white mb-2">Wovo Media AI Plans</h1>
        <p className="text-zinc-400 mb-4">Start your <span className="font-bold text-emerald-400">7-day free trial</span> — no charge until the trial ends.</p>
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 text-sm text-emerald-300">
          <span>🎁</span>
          <span>Pick any plan below — 7 days completely free, then your plan starts. Cancel anytime.</span>
        </div>
        <div className="grid gap-5 md:grid-cols-3 text-left">
          {CARDS.map(card => (
            <article key={card.key} className={`rounded-2xl border p-6 transition ${card.badge ? "border-emerald-400/80 bg-emerald-500/10" : "border-white/10 bg-zinc-950"}`}>
              {card.badge && <p className="mb-3 inline-block rounded-full bg-emerald-400 px-3 py-0.5 text-xs font-black text-black">{card.badge}</p>}
              <h2 className="text-xl font-black text-white">{card.title}</h2>
              <p className="text-3xl font-black text-white mt-1">{card.price}</p>
              <p className="text-xs font-bold text-emerald-400 mt-0.5 mb-1">✓ 7-day free trial</p>
              <p className="text-sm text-zinc-400 mb-4">{card.credits}</p>
              <ul className="space-y-1.5 mb-5">
                {card.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-emerald-400">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full rounded-xl py-3 font-black transition hover:-translate-y-0.5 ${card.badge ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-white/10 text-white hover:bg-white/20"}`}
                onClick={() => void choose(card.priceId).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"))}
              >
                Start Free Trial →
              </button>
            </article>
          ))}
        </div>
        {error && <p className="mt-5 text-red-400">{error}</p>}
        <p className="mt-6 text-xs text-zinc-600">Cancel before trial ends and pay nothing · No hidden fees · Secure checkout via Stripe</p>
      </div>
    </main>
  );
}
