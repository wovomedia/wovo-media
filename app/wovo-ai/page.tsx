"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase, type Session } from "@/lib/supabase/client";

type SupabaseAuthUser = { id: string; email?: string };
type ProfileRecord = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  business_type: string | null;
  location: string | null;
  contact: string | null;
};

type CaptionsPayload = { facebook: string; instagram: string; tiktok: string; hashtags: string };
type SubscriptionSummary = {
  subscribed: boolean;
  currentPlan: string | null;
  creditsRemaining: number;
  weeklyLimit: number;
  postsUsedThisWeek: number;
};

const STORAGE_KEY = "wovo-supabase-session";
const fieldClass =
  "w-full rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-400/40";

const PLAN_OPTIONS = [
  { key: "starter", label: "$24.99 Starter", desc: "9 posts per month", priceId: process.env.NEXT_PUBLIC_STARTER_PRICE_ID ?? "" },
  { key: "pro", label: "$49.99 Pro", desc: "18 posts per month", priceId: process.env.NEXT_PUBLIC_PRO_PRICE_ID ?? "" },
  { key: "agency", label: "$99 Agency", desc: "42 posts per month", priceId: process.env.NEXT_PUBLIC_AGENCY_PRICE_ID ?? "" },
];

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

export default function WovoAiPage() {
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/wovo-ai`;
  }, []);

  const withAuthHeaders = (token: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const loadSubscription = async (token: string) => {
    const response = await fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${token}` } });
    const payload = (await response.json()) as SubscriptionSummary & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to load subscription.");
    setSubscription(payload);
  };

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

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, business_name, business_type, location, contact")
          .eq("id", user.id)
          .maybeSingle<ProfileRecord>();

        if (profileError) throw profileError;

        if (profile) {
          setBusinessName(profile.business_name ?? "");
          setBusinessType(profile.business_type ?? "");
          setLocation(profile.location ?? "");
          setContact(profile.contact ?? "");
        }

        await loadSubscription(session.access_token);
      } catch (err: unknown) {
        setError(mapSupabaseAuthError(err).message);
      }
    };
    void hydrate();
  }, [session]);

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
    if (!session?.access_token || !authUser?.id) return;
    setSavingProfile(true);
    try {
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: authUser.id,
        business_name: businessName || null,
        business_type: businessType || null,
        location: location || null,
        contact: contact || null,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;
      setInfo("Profile saved.");
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const startCheckout = async (priceId: string) => {
    if (!session?.access_token || !priceId) return;
    setSubmittingCheckout(priceId);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({ priceId }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to start checkout.");
      window.location.href = payload.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmittingCheckout(null);
    }
  };

  const openPortal = async () => {
    if (!session?.access_token) return;
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to open billing portal.");
      window.location.href = payload.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Portal request failed.");
    }
  };

  const handleGenerate = async () => {
    if (!session?.access_token) return;
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
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => void handleSignIn()} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">Sign in</button>
              <button onClick={() => void handleSignUp()} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm">Sign up</button>
            </div>
            <button onClick={handleGoogle} className="mt-3 w-full rounded-xl border border-white/30 px-4 py-2.5 text-sm">Continue with Google</button>
          </section>
        )}

        {!loadingSession && session && (
          <>
            <header className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Wovo AI</h1>
                  <p className="text-sm text-white/70">{authUser?.email ?? "Signed in"}</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/" className="rounded-lg border border-white/20 px-3 py-2 text-xs">Home</Link>
                  <button onClick={signOut} className="rounded-lg border border-white/30 px-3 py-2 text-xs">Sign out</button>
                </div>
              </div>
            </header>

            {!subscription?.subscribed && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Choose a plan to continue</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {PLAN_OPTIONS.map((plan) => (
                    <article key={plan.key} className="rounded-xl border border-white/20 bg-black/40 p-4">
                      <h3 className="font-semibold">{plan.label}</h3>
                      <p className="mt-1 text-sm text-white/70">{plan.desc}</p>
                      <button
                        onClick={() => void startCheckout(plan.priceId)}
                        disabled={submittingCheckout === plan.priceId || !plan.priceId}
                        className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-60"
                      >
                        {plan.key === "starter" ? "Subscribe Starter" : plan.key === "pro" ? "Subscribe Pro" : "Subscribe Agency"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {subscription?.subscribed && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Dashboard</h2>
                <p className="mt-2 text-sm text-white/80">Current plan: {subscription.currentPlan}</p>
                <p className="text-sm text-white/80">Credits remaining: {subscription.creditsRemaining}</p>
                <p className="text-sm text-white/80">Posts used this week: {subscription.postsUsedThisWeek}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => void handleGenerate()} disabled={generating} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black">
                    {generating ? "Generating..." : "Generate Post"}
                  </button>
                  <button onClick={() => void openPortal()} className="rounded-lg border border-white/30 px-4 py-2 text-sm">Manage Subscription</button>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Profile + content input</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className={fieldClass} />
                <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business Type" className={fieldClass} />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className={fieldClass} />
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact" className={fieldClass} />
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" className={fieldClass} />
                <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={fieldClass} />
              </div>
              <button onClick={() => void saveProfile()} disabled={savingProfile} className="mt-4 rounded-lg border border-white/30 px-4 py-2 text-sm">
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </section>

            {generatedImage && (
              <Image src={generatedImage} alt="Generated" width={1024} height={1024} unoptimized className="rounded-lg border border-white/20" />
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
