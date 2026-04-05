"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clearSession, readSessionFromStorage } from "@/lib/supabase/session-client";
import { sanitizeInternalNextPath } from "@/lib/wovo-ai/policy";

type PlanCode = "starter" | "pro";

function readPlan(raw: string | null): PlanCode | null {
  if (raw === "starter" || raw === "pro") return raw;
  return null;
}

function labelForPlan(plan: PlanCode | null): string {
  if (plan === "starter") return "Wovo AI Starter";
  if (plan === "pro") return "Wovo AI Pro";
  return "Wovo AI";
}

function WovoAiCheckoutGatePageInner() {
  const searchParams = useSearchParams();
  const plan = useMemo(() => readPlan(searchParams.get("plan")), [searchParams]);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing checkout...");
  const [error, setError] = useState("");
  const [startingCheckout, setStartingCheckout] = useState(false);

  const nextPath = useMemo(
    () => sanitizeInternalNextPath(`/wovo-ai/checkout?plan=${plan ?? "starter"}`, "/wovo-ai/pricing"),
    [plan],
  );
  const signupHref = `/signup?next=${encodeURIComponent(nextPath)}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    const session = readSessionFromStorage();
    setToken(session?.access_token ?? null);
  }, []);

  useEffect(() => {
    if (!plan) {
      setError("Invalid plan selected. Please choose Starter or Pro from pricing.");
      setStatus("");
      return;
    }

    if (!token) {
      setStatus("Create an account to continue checkout.");
      return;
    }

    let cancelled = false;

    const startCheckout = async () => {
      try {
        setStartingCheckout(true);
        setError("");
        setStatus(`Starting ${labelForPlan(plan)} checkout...`);

        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };

        if (!response.ok || !payload.url) {
          if (response.status === 401) {
            clearSession();
            setToken(null);
            throw new Error("Please create an account or log in before purchase.");
          }
          throw new Error(payload.error ?? "Unable to start checkout.");
        }

        if (!cancelled) {
          window.location.href = payload.url;
        }
      } catch (checkoutError) {
        if (cancelled) return;
        setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout.");
        setStatus("Checkout could not start right now.");
      } finally {
        if (!cancelled) setStartingCheckout(false);
      }
    };

    void startCheckout();

    return () => {
      cancelled = true;
    };
  }, [plan, token]);

  if (!plan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d1014] p-6 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#171b21] p-6">
          <h1 className="text-2xl font-semibold">Choose a valid plan</h1>
          <p className="mt-2 text-sm text-slate-300">
            We could not find this plan. Please choose Starter or Pro from pricing.
          </p>
          <div className="mt-5">
            <Link
              href="/wovo-ai/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#00E991] px-4 text-sm font-semibold text-[#0d1014] hover:bg-[#00cf81]"
            >
              View Wovo AI Pricing
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d1014] p-6 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#171b21] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Account required</p>
          <h1 className="mt-2 text-2xl font-semibold">Create an account before purchasing {labelForPlan(plan)}</h1>
          <p className="mt-2 text-sm text-slate-300">
            To protect billing and keep credits tied to your workspace, Wovo AI purchases require an account first.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={signupHref}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#00E991] px-4 text-sm font-semibold text-[#0d1014] hover:bg-[#00cf81]"
            >
              Create Account
            </Link>
            <Link
              href={loginHref}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white hover:border-emerald-300/40 hover:text-emerald-200"
            >
              Log In
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">{status}</p>
          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d1014] p-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#171b21] p-6">
        <h1 className="text-2xl font-semibold">Starting checkout</h1>
        <p className="mt-2 text-sm text-slate-300">{status}</p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full bg-[#00E991] ${startingCheckout ? "w-3/4 animate-pulse" : "w-1/3"}`} />
        </div>
        {error ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-rose-300">{error}</p>
            <Link
              href="/wovo-ai/profile"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 px-3 text-sm font-semibold text-white hover:border-emerald-300/40 hover:text-emerald-200"
            >
              Open Profile Billing
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function WovoAiCheckoutGatePage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#0d1014] p-6 text-gray-300">Loading checkout...</main>}>
      <WovoAiCheckoutGatePageInner />
    </Suspense>
  );
}
