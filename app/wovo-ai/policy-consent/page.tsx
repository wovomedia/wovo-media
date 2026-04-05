"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { brand } from "@/data/site-content";
import { supabase } from "@/lib/supabase/client";
import { clearSession, persistSession, readSessionFromStorage } from "@/lib/supabase/session-client";
import {
  fetchPolicyConsentStatus,
  hasAcceptedCurrentPolicy,
} from "@/lib/wovo-ai/policy-client";
import { sanitizeInternalNextPath, WOVO_POLICY_VERSION } from "@/lib/wovo-ai/policy";

type PolicyConsentPayload = {
  error?: string;
  accepted?: boolean;
};

function WovoPolicyConsentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nextPath = useMemo(
    () => sanitizeInternalNextPath(searchParams.get("next"), "/wovo-ai"),
    [searchParams],
  );

  const refreshStoredSession = useCallback(async () => {
    const storedSession = readSessionFromStorage();
    const refreshToken = storedSession?.refresh_token?.trim() ?? "";
    if (!refreshToken) return null;

    const { data, error: refreshError } = await supabase.auth.refreshSession(refreshToken);
    if (refreshError || !data.session?.access_token) {
      return null;
    }

    persistSession(data.session);
    supabase.setAccessToken(data.session.access_token);
    setToken(data.session.access_token);
    return data.session.access_token;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const storedSession = readSessionFromStorage();
      if (!storedSession?.access_token) {
        router.replace("/login");
        return;
      }

      let accessToken = storedSession.access_token;
      supabase.setAccessToken(accessToken);
      setToken(accessToken);

      try {
        let status = await fetchPolicyConsentStatus(accessToken);
        if (!status) {
          const refreshedToken = await refreshStoredSession();
          if (!refreshedToken) {
            clearSession();
            router.replace("/login");
            return;
          }
          accessToken = refreshedToken;
          status = await fetchPolicyConsentStatus(accessToken);
        }

        if (!cancelled && hasAcceptedCurrentPolicy(status)) {
          router.replace(nextPath);
          return;
        }
      } catch {
        // Continue and allow manual acceptance.
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    void bootstrap().catch(() => {
      if (!cancelled) {
        clearSession();
        router.replace("/login");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [nextPath, refreshStoredSession, router]);

  const acceptPolicy = async () => {
    if (!accepted) {
      setError("Please check the agreement box to continue.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const submitConsent = async (accessToken: string) => {
        const response = await fetch("/api/account/policy-consent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ accepted: true }),
        });

        const payload = (await response.json().catch(() => ({}))) as PolicyConsentPayload;
        return { response, payload };
      };

      let activeToken = token?.trim() ?? readSessionFromStorage()?.access_token?.trim() ?? "";
      if (!activeToken) {
        const refreshedToken = await refreshStoredSession();
        if (!refreshedToken) {
          clearSession();
          router.replace("/login");
          return;
        }
        activeToken = refreshedToken;
      }

      let { response, payload } = await submitConsent(activeToken);
      if (response.status === 401) {
        const refreshedToken = await refreshStoredSession();
        if (!refreshedToken) {
          clearSession();
          router.replace("/login");
          return;
        }
        ({ response, payload } = await submitConsent(refreshedToken));
      }

      if (!response.ok || payload.accepted !== true) {
        throw new Error(payload.error ?? "Unable to record policy acceptance.");
      }

      router.replace(nextPath);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept policy.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d1014] p-6 text-gray-200">
        Loading policy agreement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d1014] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#171b21] p-6 shadow-[0_18px_46px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="mb-6 inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <Image src={brand.logoIcon} alt="Wovo icon" width={38} height={38} className="wm-logo-glow h-9 w-9" />
          <Image src={brand.logoWordmark} alt="Wovo Media" width={164} height={46} className="wm-wordmark h-8 w-auto" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Required Before Access</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Accept Wovo AI Privacy & Content Agreement</h1>
        <p className="mt-3 text-sm text-gray-300">
          Policy version: <span className="font-semibold text-emerald-200">{WOVO_POLICY_VERSION}</span>
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-gray-200">
          <p>
            To continue, you must accept Wovo Media LLC&apos;s privacy and content terms. This applies to email sign-up and Google sign-up accounts.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Wovo Media LLC owns videos uploaded to or generated on the Wovo platform.</li>
            <li>Wovo grants you permission to use those videos for your business and income generation.</li>
            <li>You confirm you have permission to upload faces, voices, brands, and media you submit.</li>
            <li>You agree to follow applicable laws and avoid unlawful, deceptive, or non-consensual content.</li>
          </ul>
          <p>
            Read the full policies:{" "}
            <Link href="/privacy-policy" className="font-semibold text-emerald-300 underline hover:text-emerald-200">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms-of-use" className="font-semibold text-emerald-300 underline hover:text-emerald-200">
              Terms of Use
            </Link>
            .
          </p>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-400"
          />
          <span>
            I agree to the Privacy Policy, Terms of Use, and the Wovo AI ownership and commercial usage terms above.
          </span>
        </label>

        <button
          type="button"
          onClick={() => void acceptPolicy()}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-[#00E991] p-3 font-semibold text-[#0d1014] transition hover:bg-[#00cf81] disabled:opacity-60"
        >
          {busy ? "Saving agreement..." : "Accept and continue"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>
    </main>
  );
}

export default function WovoPolicyConsentPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0d1014] p-6 text-gray-200">
          Loading policy agreement...
        </main>
      }
    >
      <WovoPolicyConsentPageInner />
    </Suspense>
  );
}
