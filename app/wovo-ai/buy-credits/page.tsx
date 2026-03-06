"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { readSessionFromStorage } from "@/lib/supabase/session-client";
import { CREDIT_PACKS } from "@/lib/wovo-ai/plans";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

export default function BuyCreditsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [processingPriceId, setProcessingPriceId] = useState<string | null>(null);

  const success = searchParams.get("success") === "1";

  const loadCredits = async (accessToken: string) => {
    const response = await fetch("/api/wovo-ai/subscription", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json()) as UnifiedSubscriptionResponse;
    const remaining = payload.remaining.credits_remaining;
    setCreditsRemaining(remaining);
  };

  useEffect(() => {
    const session = readSessionFromStorage();
    if (!session?.access_token) {
      setLoading(false);
      router.push("/login");
      return;
    }

    setToken(session.access_token);
    void loadCredits(session.access_token).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!token || !success) return;
    void loadCredits(token);
  }, [success, token]);

  const successMessage = useMemo(() => {
    if (!success) return null;
    return "Credits added successfully.";
  }, [success]);

  const startCheckout = async (priceId: string) => {
    if (!token) return;
    setProcessingPriceId(priceId);

    try {
      const response = await fetch("/api/stripe/create-credit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      });
      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start checkout.");
      }

      if (payload.url) {
        window.location.href = payload.url;
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to start checkout.");
      setProcessingPriceId(null);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#060807] text-white">Loading credits...</div>;
  }

  return (
    <main className="min-h-screen bg-[#060807] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Buy Credits</h1>
            <p className="mt-2 text-sm text-zinc-400">Choose a credit pack to keep generating content.</p>
            <p className="mt-3 text-sm text-zinc-300">Current credits: <span className="font-semibold text-white">{creditsRemaining}</span></p>
          </div>
          <Link href="/wovo-ai" className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10">Back to Wovo AI</Link>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <article
              key={pack.priceId}
              className={`rounded-xl border p-4 transition hover:-translate-y-0.5 hover:border-emerald-400/50 hover:bg-white/[0.04] ${pack.label === "Medium Pack" ? "border-emerald-400/80 bg-emerald-500/10" : "border-white/10 bg-black/30"}`}
            >
              {pack.label === "Medium Pack" && (
                <p className="mb-2 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-black">Most Popular</p>
              )}
              <h2 className="text-lg font-semibold">{pack.label}</h2>
              <p className="mt-1 text-zinc-200">${pack.price.toFixed(2)}</p>
              <p className="mt-1 text-sm text-zinc-400">+{pack.credits} credits</p>
              <button
                type="button"
                onClick={() => void startCheckout(pack.priceId)}
                disabled={processingPriceId === pack.priceId}
                className="mt-4 w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {processingPriceId === pack.priceId ? "Redirecting..." : "Buy Credits"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
