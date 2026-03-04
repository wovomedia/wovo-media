"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase, type Session } from "@/lib/supabase/client";

type SupabaseAuthUser = { id: string; email?: string };
type ProfileRecord = {
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  business_type: string | null;
  location: string | null;
  contact: string | null;
};

type CaptionsPayload = { facebook: string; instagram: string; tiktok: string; hashtags: string };
type SubscriptionSummary = {
  status: string | null;
  plan_key: "starter" | "pro" | "agency" | "admin" | null;
  credits_used_month: number;
  credits_limit_month: number;
  period_end: string | null;
  can_generate: boolean;
  warning?: string;
};

const STORAGE_KEY = "wovo-supabase-session";
const fieldClass =
  "w-full rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-400/40";

const PLAN_OPTIONS = [
  { key: "starter", label: "$24.99 Starter", desc: "9 posts per month", priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "", popular: false },
  { key: "pro", label: "$49.99 Pro", desc: "18 posts per month", priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "", popular: false },
  { key: "agency", label: "$99 Agency", desc: "42 posts per month", priceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID ?? "", popular: true },
] as const;

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

function ensureDataUrl(image: string) {
  return image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
}

function safeJsonParse<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function WovoAiPage() {
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");

  const [captions, setCaptions] = useState<CaptionsPayload | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const hasMissingPriceIds = useMemo(() => PLAN_OPTIONS.some((plan) => !plan.priceId), []);

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
    if (payload.warning) {
      setInfo(payload.warning);
    }
  }, []);

  const loadProfile = useCallback(async (token: string) => {
    const response = await fetch("/api/wovo-ai/profile", { headers: { Authorization: `Bearer ${token}` } });
    const payload = (await response.json()) as (ProfileRecord & { error?: string }) | null;
    if (!response.ok) throw new Error(payload && "error" in payload ? payload.error ?? "Unable to load profile." : "Unable to load profile.");
    if (!payload) return;

    setEmail(payload.email ?? "");
    setFullName(payload.full_name ?? "");
    setBusinessName(payload.business_name ?? "");
    setBusinessType(payload.business_type ?? "");
    setLocation(payload.location ?? "");
    setContact(payload.contact ?? "");
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

        await loadProfile(session.access_token);
        await loadSubscription(session.access_token);
      } catch (err: unknown) {
        setError(mapSupabaseAuthError(err).message);
      }
    };
    void hydrate();
  }, [loadProfile, loadSubscription, session]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    supabase.setAccessToken(null);
    setSession(null);
    setAuthUser(null);
    setSubscription(null);
    setCaptions(null);
    setGeneratedImage(null);
    setInfo("");
    setError("");
  };

  const handleGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      });

      if (error) throw error;
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

  const saveProfile = async () => {
    if (!session?.access_token) return;
    setSavingProfile(true);
    setInfo("");
    setError("");
    try {
      const response = await fetch("/api/wovo-ai/profile", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({ email, full_name: fullName, business_name: businessName, business_type: businessType, location, contact }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save profile.");
      setInfo("Profile saved. If email changed, check your inbox for confirmation.");
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const deleteAccount = async () => {
    if (!session?.access_token) return;
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;

    const response = await fetch("/api/wovo-ai/delete-account", {
      method: "POST",
      headers: withAuthHeaders(session.access_token),
    });

    const payload = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to delete account.");
      return;
    }

    signOut();
  };

  const startCheckout = async (priceId: string) => {
    if (!session?.access_token || !priceId) return;
    setSubmittingCheckout(priceId);
    setError("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({ priceId }),
      });
      const responseText = await response.text();
      const payload = safeJsonParse<{ url?: string; error?: string; message?: string }>(responseText) ?? {};
      if (!response.ok || !payload.url) {
        const fallbackText = payload.error ?? payload.message ?? responseText ?? "Unable to start checkout.";
        throw new Error(fallbackText);
      }
      window.location.assign(payload.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmittingCheckout(null);
    }
  };

  const openPortal = async () => {
    if (!session?.access_token) return;
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
        const fallbackText = payload.error ?? payload.message ?? responseText ?? "Unable to open billing portal.";
        throw new Error(fallbackText);
      }
      window.location.assign(payload.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Portal request failed.");
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleGenerate = async () => {
    if (!session?.access_token || !subscription?.can_generate) return;
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/wovo-ai", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({ business_name: businessName, business_type: businessType, location, contact, topic, goal }),
      });
      const payload = (await response.json()) as {
        captions?: Record<string, string>;
        generated_image_data?: string | null;
        data?: { captions?: Record<string, string>; generated_image_data?: string | null };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Failed to generate.");

      const sourceCaptions = payload.captions ?? payload.data?.captions ?? {};
      setCaptions({
        facebook: sourceCaptions.facebook_caption ?? sourceCaptions.facebook ?? "",
        instagram: sourceCaptions.instagram_caption ?? sourceCaptions.instagram ?? "",
        tiktok: sourceCaptions.tiktok_caption ?? sourceCaptions.tiktok ?? "",
        hashtags: sourceCaptions.hashtags ?? "",
      });
      const imageData = payload.generated_image_data ?? payload.data?.generated_image_data ?? null;
      if (imageData) setGeneratedImage(ensureDataUrl(imageData));
      await loadSubscription(session.access_token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate right now.");
    } finally {
      setGenerating(false);
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
              <button onClick={() => void handleSignIn()} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">Sign in</button>
              <button onClick={() => void handleSignUp()} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm">Sign up</button>
            </div>
            <button onClick={handleGoogle} className="mt-3 w-full rounded-xl border border-white/30 px-4 py-2.5 text-sm">Continue with Google</button>
          </section>
        )}

        {!loadingSession && session && (
          <>
            <header className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Wovo AI</h1>
                  <p className="text-sm text-white/70">{authUser?.email ?? "Signed in"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/" className="rounded-lg border border-white/20 px-3 py-2 text-xs">Home</Link>
                  <button onClick={signOut} className="rounded-lg border border-white/30 px-3 py-2 text-xs">Sign out</button>
                </div>
              </div>
            </header>

            {!subscription?.can_generate && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Choose a plan to continue</h2>
                {hasMissingPriceIds && <p className="mt-2 text-sm text-amber-300">Missing price IDs</p>}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {PLAN_OPTIONS.map((plan) => (
                    <article key={plan.key} className="relative rounded-xl border border-white/20 bg-black/40 p-4">
                      {plan.popular && <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-1 text-xs font-semibold text-black">Most popular</span>}
                      <h3 className="font-semibold">{plan.label}</h3>
                      <p className="mt-1 text-sm text-white/70">{plan.desc}</p>
                      <button
                        onClick={() => void startCheckout(plan.priceId)}
                        disabled={submittingCheckout === plan.priceId || hasMissingPriceIds || !plan.priceId}
                        className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-60"
                      >
                        {submittingCheckout === plan.priceId
                          ? "Starting checkout..."
                          : plan.key === "starter"
                            ? "Subscribe Starter"
                            : plan.key === "pro"
                              ? "Subscribe Pro"
                              : "Subscribe Agency"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <h2 className="text-xl font-semibold">Dashboard</h2>
              <p className="mt-2 text-sm text-white/80">Plan: {subscription?.plan_key ?? "none"}</p>
              <p className="text-sm text-white/80">Status: {subscription?.status ?? "inactive"}</p>
              <p className="text-sm text-white/80">Credits: {creditsText}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => void handleGenerate()} disabled={generating || !subscription?.can_generate} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
                  {generating ? "Generating..." : "Generate Post"}
                </button>
                <button onClick={() => void openPortal()} disabled={openingPortal} className="rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-60">{openingPortal ? "Opening..." : "Manage Billing"}</button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Profile + content input</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={fieldClass} />
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" className={fieldClass} />
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className={fieldClass} />
                <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business Type" className={fieldClass} />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className={fieldClass} />
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact" className={fieldClass} />
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" className={fieldClass} />
                <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={fieldClass} />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => void saveProfile()} disabled={savingProfile} className="rounded-lg border border-white/30 px-4 py-2 text-sm">
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
                <button onClick={() => void deleteAccount()} className="rounded-lg border border-red-400/60 px-4 py-2 text-sm text-red-200">Delete Account</button>
              </div>
            </section>

            {generatedImage && (
              <Image src={generatedImage} alt="Generated" width={1024} height={1024} unoptimized className="w-full rounded-lg border border-white/20" />
            )}

            {captions && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-5 text-sm">
                <p><strong>Facebook:</strong> {captions.facebook}</p>
                <p><strong>Instagram:</strong> {captions.instagram}</p>
                <p><strong>TikTok:</strong> {captions.tiktok}</p>
                <p><strong>Hashtags:</strong> {captions.hashtags}</p>
              </section>
            )}
          </>
        )}

        {info && <p className="text-sm text-emerald-300">{info}</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </main>
  );
}
