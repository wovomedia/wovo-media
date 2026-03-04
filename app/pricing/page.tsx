"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, type Session } from "@/lib/supabase/client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

const STORAGE_KEY = "wovo-supabase-session";

const CARDS = [
  { key: "starter", title: "Starter", price: "$24.99/month", credits: "25 credits / month" },
  { key: "pro", title: "Pro", price: "$49.99/month", credits: "50 credits / month" },
  { key: "business", title: "Business", price: "$99/month", credits: "100 credits / month" },
] as const;

function parseStoredSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Session;
}

export default function PricingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [subscription, setSubscription] = useState<UnifiedSubscriptionResponse | null>(null);
  const [error, setError] = useState("");

  const hasSubscription = useMemo(() => subscription?.status === "active", [subscription?.status]);

  useEffect(() => {
    const nextSession = parseStoredSession();
    if (!nextSession) return;
    setSession(nextSession);
    supabase.setAccessToken(nextSession.access_token);

    void (async () => {
      const response = await fetch("/api/wovo-ai/subscription", {
        headers: { Authorization: `Bearer ${nextSession.access_token}` },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as UnifiedSubscriptionResponse;
      setSubscription(payload);
    })();
  }, []);

  const startPlanFlow = async (plan: "starter" | "pro" | "business") => {
    if (!session?.access_token) {
      setError("Sign in first from the Wovo AI page.");
      return;
    }
    const endpoint = hasSubscription ? "/api/stripe/upgrade" : "/api/stripe/create-checkout";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan }),
    });

    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to continue.");

    if (hasSubscription) {
      window.location.href = "/wovo-ai";
      return;
    }

    if (!payload.url) throw new Error("Stripe URL missing.");
    window.location.href = payload.url;
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-center text-4xl font-bold">Wovo AI Pricing</h1>
        <p className="mb-10 text-center text-slate-300">Choose a plan and scale your content workflow.</p>

        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map((card) => {
            return (
              <article key={card.key} className="rounded-2xl border border-white/15 bg-slate-900/60 p-6 shadow-xl">
                <h2 className="text-2xl font-semibold">{card.title}</h2>
                <p className="mt-4 text-3xl font-bold">{card.price}</p>
                <p className="mt-2 text-slate-300">{card.credits}</p>
                <button
                  className="mt-8 w-full rounded-xl bg-white px-4 py-2 font-semibold text-slate-900"
                  onClick={() => void startPlanFlow(card.key).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed."))}
                >
                  {hasSubscription ? "Upgrade" : "Choose plan"}
                </button>
              </article>
            );
          })}
        </div>

        {error && <p className="mt-6 text-center text-red-300">{error}</p>}
      </div>
    </main>
  );
}
