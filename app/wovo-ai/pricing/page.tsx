"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readSessionFromStorage } from "@/lib/supabase/session-client";
import { supabase } from "@/lib/supabase/client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { getAuthAccessState } from "@/lib/wovo-ai/access";

const CARDS = [
  { key: "starter", title: "Starter", price: "$24.99/month", credits: "50 credits / month" },
  { key: "pro", title: "Growth", price: "$49.99/month", credits: "150 credits / month" },
  { key: "business", title: "Pro", price: "$99/month", credits: "300 credits / month" },
] as const;

export default function WovoPricingPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UnifiedSubscriptionResponse | null>(null);
  const [error, setError] = useState("");

  const active = useMemo(() => subscription?.status === "active", [subscription?.status]);

  useEffect(() => {
    const s = readSessionFromStorage();
    const authState = getAuthAccessState({ session: s });
    console.info("[wovo-pricing] Route auth state", { route: "/wovo-ai/pricing", isAuthenticated: authState.isAuthenticated });
    if (!authState.isAuthenticated || !s?.access_token) return router.push("/login");
    supabase.setAccessToken(s.access_token);
    setToken(s.access_token);
    void fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${s.access_token}` } })
      .then((r) => r.json())
      .then((data) => {
        const payload = data as UnifiedSubscriptionResponse;
        setSubscription(payload);
        if (payload.has_access) {
          router.replace("/wovo-ai");
        }
      });
  }, [router]);

  const choose = async (plan: "starter" | "pro" | "business") => {
    if (!token) return;
    const endpoint = active ? "/api/stripe/upgrade" : "/api/stripe/checkout-subscription";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed");
    if (data.url) window.location.href = data.url;
    else router.push("/wovo-ai");
  };

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-black py-16 text-white">
      <h1 className="px-4 text-center text-4xl font-bold sm:px-6">Wovo AI Pricing</h1>
      <p className="mb-10 px-4 text-center text-white/70 sm:px-6">Custom Wovo upgrade flow (no forced portal redirect).</p>
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
        {CARDS.map((card) => (
          <article key={card.key} className="w-full min-w-0 max-w-full rounded-2xl border border-emerald-400/30 bg-zinc-950 p-6">
            <h2 className="text-2xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-3xl font-bold text-emerald-300">{card.price}</p>
            <p className="mt-1 break-words text-white/75">{card.credits}</p>
            <button className="mt-8 w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-black" onClick={() => void choose(card.key).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"))}>
              {active ? "Upgrade now" : "Start plan"}
            </button>
          </article>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-white/55">
        Canceling your subscription pauses all unused credits. Your credits will become available again once your subscription is reactivated.
      </p>
      {error && <p className="mt-5 text-center text-red-300">{error}</p>}
    </main>
  );
}
