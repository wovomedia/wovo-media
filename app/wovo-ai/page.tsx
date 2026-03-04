"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase, type Session } from "@/lib/supabase/client";

type SupabaseAuthUser = { id: string; email?: string };

type GeneratedResult = {
  captions: { facebook: string; instagram: string; tiktok: string };
  hashtags: string[];
  image_prompt: string;
  image?: { url?: string } | null;
};

type SubscriptionSummary = {
  status: string | null;
  plan_key: "starter" | "pro" | "agency" | null;
  credits_used_month: number;
  credits_limit_month: number;
  period_end: string | null;
  can_generate: boolean;
  weekly_limit: number;
  weekly_used: number;
  admin_access?: boolean;
  warning?: string;
};

type PlanOption = {
  key: "starter" | "pro" | "agency";
  label: string;
  desc: string;
  priceId?: string;
  popular: boolean;
};

const STORAGE_KEY = "wovo-supabase-session";
const fieldClass =
  "w-full rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-400/40";

function parseSessionFromHash(hash: string): Session | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  return {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") ?? undefined,
    expires_in: params.get("expires_in") ? Number(params.get("expires_in")) : undefined,
    token_type: params.get("token_type") ?? undefined,
  };
}

function safeJsonParse<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

export default function WovoAiPage() {
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [topic, setTopic] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [goal, setGoal] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [activeTab, setActiveTab] = useState<"facebook" | "instagram" | "tiktok">("facebook");

  const [submittingCheckout, setSubmittingCheckout] = useState<PlanOption["key"] | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const planOptions: PlanOption[] = useMemo(
    () => [
      { key: "starter", label: "$24.99 Starter", desc: "9 posts / month · 3/week", priceId: process.env.NEXT_PUBLIC_STARTER_PRICE_ID, popular: false },
      { key: "pro", label: "$49.99 Pro", desc: "18 posts / month · 6/week", priceId: process.env.NEXT_PUBLIC_PRO_PRICE_ID, popular: false },
      { key: "agency", label: "$99 Agency", desc: "42 posts / month · 14/week", priceId: process.env.NEXT_PUBLIC_AGENCY_PRICE_ID, popular: true },
    ],
    [],
  );

  const hasMissingPriceIds = useMemo(() => planOptions.some((plan) => typeof plan.priceId === "undefined"), [planOptions]);

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/wovo-ai`;
  }, []);

  const withAuthHeaders = (token: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const loadSubscription = useCallback(async (token: string) => {
    const response = await fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${token}` } });
    const payload = (await response.json()) as SubscriptionSummary & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to load subscription.");
    setSubscription(payload);
    if (payload.warning) setInfo(payload.warning);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const fromHash = parseSessionFromHash(window.location.hash);
        if (fromHash) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromHash));
          window.history.replaceState({}, document.title, "/wovo-ai");
          setSession(fromHash);
          return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setSession(JSON.parse(stored) as Session);
      } finally {
        setLoadingSession(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      if (!session?.access_token) return;
      try {
        supabase.setAccessToken(session.access_token);
        const { data: userData, error: userError } = await supabase.auth.getUser(session.access_token);
        if (userError || !userData.user) throw userError ?? new Error("Unable to load user.");

        const user = userData.user as SupabaseAuthUser;
        setAuthUser(user);
        setEmail(user.email ?? "");

        await loadSubscription(session.access_token);
      } catch (err: unknown) {
        setError(mapSupabaseAuthError(err).message);
      }
    };

    void hydrate();
  }, [loadSubscription, session]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    supabase.setAccessToken(null);
    setSession(null);
    setAuthUser(null);
    setSubscription(null);
    setResult(null);
    setInfo("");
    setError("");
  };

  const handleGoogle = async () => {
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl } });
      if (oauthError) throw oauthError;
      if (data.url) window.location.href = data.url;
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    }
  };

  const handleSignUp = async () => {
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      setInfo("Check your email to confirm your account.");
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    }
  };

  const handleSignIn = async () => {
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData.session) throw signInError ?? new Error("Unable to sign in.");

      localStorage.setItem(STORAGE_KEY, JSON.stringify(signInData.session));
      setSession(signInData.session);
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    }
  };

  const startCheckout = async (plan: PlanOption) => {
    if (!session?.access_token || !plan.priceId) return;
    setSubmittingCheckout(plan.key);
    setError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      const responseText = await response.text();
      const payload = safeJsonParse<{ url?: string; error?: string; message?: string }>(responseText) ?? {};

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? payload.message ?? responseText ?? "Unable to start checkout.");
      }

      window.location.href = payload.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmittingCheckout(null);
    }
  };

  const openPortal = async () => {
    if (!session?.access_token || subscription?.admin_access) return;
    setOpeningPortal(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
      });
      const responseText = await response.text();
      const payload = safeJsonParse<{ url?: string; error?: string; message?: string }>(responseText) ?? {};

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? payload.message ?? responseText ?? "Unable to open billing portal.");
      }

      window.location.href = payload.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Portal request failed.");
    } finally {
      setOpeningPortal(false);
    }
  };

  const creditsRemaining = Math.max((subscription?.credits_limit_month ?? 0) - (subscription?.credits_used_month ?? 0), 0);
  const isSubscriptionActive = subscription?.status === "active";
  const withinWeeklyLimit = (subscription?.weekly_limit ?? 0) <= 0 || (subscription?.weekly_used ?? 0) < (subscription?.weekly_limit ?? 0);
  const canGenerate = Boolean(isSubscriptionActive && creditsRemaining > 0 && withinWeeklyLimit && topic.trim().length > 0);

  const handleGenerate = async () => {
    if (!session?.access_token || !canGenerate) return;

    setGenerating(true);
    setInfo("");
    setError("");

    try {
      const response = await fetch("/api/wovo-ai", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({
          business_name: businessName.trim() || undefined,
          business_type: businessType.trim() || undefined,
          location: location.trim() || undefined,
          contact: contact.trim() || undefined,
          goal: goal.trim() || undefined,
          topic: topic.trim(),
          include_image: Boolean(imageDataUrl),
          image_base64: imageDataUrl,
        }),
      });

      const payload = (await response.json()) as {
        captions?: { facebook?: string; instagram?: string; tiktok?: string };
        hashtags?: string[];
        image_prompt?: string;
        image?: { url?: string } | null;
        updated_credits?: { remaining: number; total: number; weekly_used: number; weekly_limit: number };
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "Failed to generate content.");

      setResult({
        captions: {
          facebook: payload.captions?.facebook ?? "",
          instagram: payload.captions?.instagram ?? "",
          tiktok: payload.captions?.tiktok ?? "",
        },
        hashtags: payload.hashtags ?? [],
        image_prompt: payload.image_prompt ?? "",
        image: payload.image ?? null,
      });

      if (subscription && payload.updated_credits) {
        setSubscription({
          ...subscription,
          credits_limit_month: payload.updated_credits.total,
          credits_used_month: Math.max(payload.updated_credits.total - payload.updated_credits.remaining, 0),
          weekly_used: payload.updated_credits.weekly_used,
          weekly_limit: payload.updated_credits.weekly_limit,
          can_generate:
            subscription.status === "active" &&
            payload.updated_credits.remaining > 0 &&
            (payload.updated_credits.weekly_limit <= 0 || payload.updated_credits.weekly_used < payload.updated_credits.weekly_limit),
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate right now.");
      await loadSubscription(session.access_token);
    } finally {
      setGenerating(false);
    }
  };

  const handlePickImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      setImageName("");
      return;
    }

    try {
      const image = await toDataUrl(file);
      setImageDataUrl(image);
      setImageName(file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load image.");
    }
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setInfo(successMessage);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  };

  const deleteAccount = async () => {
    if (!session?.access_token) return;
    if (deleteConfirmText !== "DELETE") {
      setError("Type DELETE to confirm account removal.");
      return;
    }

    setDeletingAccount(true);
    setError("");

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to delete account.");

      signOut();
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to delete account.");
    } finally {
      setDeletingAccount(false);
      setShowDeleteModal(false);
      setDeleteConfirmText("");
    }
  };

  const creditsText = `${subscription?.credits_used_month ?? 0} / ${subscription?.credits_limit_month ?? 0}`;

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        {!loadingSession && !session && (
          <section className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/5 p-6">
            <h1 className="text-2xl font-bold">Sign in to Wovo AI</h1>
            <div className="mt-4 space-y-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={fieldClass} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={fieldClass} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button onClick={() => void handleSignIn()} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">
                Sign in
              </button>
              <button onClick={() => void handleSignUp()} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm">
                Sign up
              </button>
            </div>
            <button onClick={handleGoogle} className="mt-3 w-full rounded-xl border border-white/30 px-4 py-2.5 text-sm">
              Continue with Google
            </button>
          </section>
        )}

        {session && (
          <>
            <header className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Wovo AI</h1>
                  <p className="text-sm text-white/70">{authUser?.email ?? "Signed in"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/" className="rounded-lg border border-white/20 px-3 py-2 text-xs">
                    Home
                  </Link>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={generating || deletingAccount}
                    className="rounded-lg border border-red-500/70 px-3 py-2 text-xs text-red-200 disabled:opacity-60"
                  >
                    Delete account
                  </button>
                  <button onClick={signOut} disabled={generating || deletingAccount} className="rounded-lg border border-white/30 px-3 py-2 text-xs disabled:opacity-60">
                    Sign out
                  </button>
                </div>
              </div>
            </header>

            {!subscription?.can_generate && !subscription?.admin_access && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Choose a plan to continue</h2>
                {hasMissingPriceIds && (
                  <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">Missing price IDs (check Vercel env vars)</p>
                )}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {planOptions.map((plan) => {
                    const missingPrice = !plan.priceId;
                    const disabled = submittingCheckout === plan.key || missingPrice;
                    return (
                      <article key={plan.key} className="relative rounded-xl border border-white/20 bg-black/40 p-4">
                        {plan.popular && <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-1 text-xs font-semibold text-black">Most popular</span>}
                        <h3 className="font-semibold">{plan.label}</h3>
                        <p className="mt-1 text-sm text-white/70">{plan.desc}</p>
                        <button
                          onClick={() => void startCheckout(plan)}
                          disabled={disabled}
                          title={missingPrice ? "Missing price ID for this plan" : ""}
                          className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submittingCheckout === plan.key ? "Starting checkout..." : `Subscribe ${plan.key[0].toUpperCase()}${plan.key.slice(1)}`}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Dashboard</h2>
                {subscription?.admin_access && <span className="rounded-full border border-emerald-300/50 bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-200">Admin access</span>}
              </div>
              <p className="mt-2 text-sm text-white/80">Plan: {subscription?.plan_key ?? "none"}</p>
              <p className="text-sm text-white/80">Status: {subscription?.status ?? "inactive"}</p>
              <p className="text-sm text-white/80">Credits: {creditsText}</p>
              <p className="text-sm text-white/80">Remaining: {creditsRemaining}</p>
              <p className="text-sm text-white/80">
                Weekly usage: {subscription?.weekly_used ?? 0} / {subscription?.weekly_limit ?? 0}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => void openPortal()} disabled={openingPortal || Boolean(subscription?.admin_access) || generating} className="rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-60">
                  {openingPortal ? "Opening..." : "Manage Billing"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Generate</h2>
              <div className="mt-4 space-y-3">
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What are you posting about?"
                  required
                  rows={4}
                  className={fieldClass}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name (optional)" className={fieldClass} />
                  <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business type (optional)" className={fieldClass} />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className={fieldClass} />
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (optional)" className={fieldClass} />
                  <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (optional)" className={fieldClass} />
                </div>
                <div className="rounded-xl border border-white/20 bg-black/30 p-3">
                  <label className="text-sm text-white/80">Reference image (optional, 1 image)</label>
                  <input type="file" accept="image/*" onChange={(e) => void handlePickImage(e)} disabled={generating} className="mt-2 block w-full text-xs text-white/70" />
                  {imageName && <p className="mt-2 text-xs text-white/60">Selected: {imageName}</p>}
                </div>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={!canGenerate || generating}
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? "Generating..." : "Generate"}
                </button>
              </div>
            </section>

            {result && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <h2 className="text-lg font-semibold">Results</h2>
                <div className="mt-3 flex gap-2">
                  {(["facebook", "instagram", "tiktok"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-lg px-3 py-1.5 text-xs capitalize ${
                        activeTab === tab ? "bg-emerald-400 text-black" : "border border-white/25 text-white"
                      }`}
                    >
                      {tab === "facebook" ? "FB" : tab === "instagram" ? "IG" : "TikTok"}
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-white/20 bg-black/40 p-4 text-sm">
                  <p>{result.captions[activeTab]}</p>
                  <button
                    onClick={() => void copyText(result.captions[activeTab], `${activeTab} caption copied.`)}
                    className="mt-3 rounded-lg border border-white/30 px-3 py-1.5 text-xs"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-3 rounded-xl border border-white/20 bg-black/40 p-4 text-sm">
                  <p className="text-white/90">{result.hashtags.join(" ")}</p>
                  <button onClick={() => void copyText(result.hashtags.join(" "), "Hashtags copied.")} className="mt-3 rounded-lg border border-white/30 px-3 py-1.5 text-xs">
                    Copy hashtags
                  </button>
                </div>
                {result.image?.url && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/20">
                    <Image src={result.image.url} alt="Generated promo" width={1024} height={1024} unoptimized className="aspect-square w-full object-cover" />
                  </div>
                )}
                <p className="mt-3 text-xs text-white/70">Remaining credits: {creditsRemaining}</p>
              </section>
            )}
          </>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-5">
              <h3 className="text-lg font-semibold">Delete account</h3>
              <p className="mt-2 text-sm text-white/70">Type DELETE to confirm</p>
              <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="DELETE" className={`${fieldClass} mt-3`} />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowDeleteModal(false)} disabled={deletingAccount} className="rounded-lg border border-white/30 px-3 py-2 text-xs">
                  Cancel
                </button>
                <button
                  onClick={() => void deleteAccount()}
                  disabled={deletingAccount || generating}
                  className="rounded-lg border border-red-500/70 px-3 py-2 text-xs text-red-200 disabled:opacity-60"
                >
                  {deletingAccount ? "Deleting..." : "Delete account"}
                </button>
              </div>
            </div>
          </div>
        )}

        {info && <p className="text-sm text-emerald-300">{info}</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </main>
  );
}
