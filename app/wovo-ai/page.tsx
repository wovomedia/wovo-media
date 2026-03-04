"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabaseClient, type SupabaseSession } from "@/lib/supabase/client";

type SupabaseAuthUser = {
  id: string;
  email?: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  business_type: string | null;
  location: string | null;
  contact: string | null;
};

type CaptionsPayload = {
  facebook: string;
  instagram: string;
  tiktok: string;
  hashtags: string;
};

const STORAGE_KEY = "wovo-supabase-session";
const fieldClass =
  "w-full rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-400/40";

function parseSessionFromHash(hash: string): SupabaseSession | null {
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
  if (image.startsWith("data:")) return image;
  return `data:image/png;base64,${image}`;
}

function CaptionBlock({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/15 bg-black/30 p-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{value || "-"}</p>
    </article>
  );
}

export default function WovoAiPage() {
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/wovo-ai`;
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
        if (stored) {
          setSession(JSON.parse(stored) as SupabaseSession);
        }
      } finally {
        setLoadingSession(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const hydrateProfile = async () => {
      if (!session?.access_token) return;

      try {
        const user = (await supabaseClient.auth.getUser(session.access_token)) as SupabaseAuthUser;
        setAuthUser(user);

        const profile = (await supabaseClient
          .from("profiles")
          .selectOneByColumn(session.access_token, "id", user.id)) as ProfileRecord | null;

        if (!profile) {
          await supabaseClient.from("profiles").upsert(
            session.access_token,
            {
              id: user.id,
              full_name: null,
              business_name: null,
              business_type: null,
              location: null,
              contact: null,
              updated_at: new Date().toISOString(),
            },
            "id",
          );
        }

        const nextProfile = (await supabaseClient
          .from("profiles")
          .selectOneByColumn(session.access_token, "id", user.id)) as ProfileRecord | null;

        setFullName(nextProfile?.full_name ?? "");
        setBusinessName(nextProfile?.business_name ?? "");
        setBusinessType(nextProfile?.business_type ?? "");
        setLocation(nextProfile?.location ?? "");
        setContact(nextProfile?.contact ?? "");
      } catch (err: unknown) {
        const mapped = mapSupabaseAuthError(err);
        setError(mapped.message);
      }
    };

    void hydrateProfile();
  }, [session]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setAuthUser(null);
    setCaptions(null);
    setGeneratedImage(null);
    setInfo("");
    setError("");
  };

  const handleGoogle = () => {
    setInfo("");
    setError("");

    try {
      const signInUrl = supabaseClient.auth.signInWithGoogle(redirectUrl);
      window.location.href = signInUrl;
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
    }
  };

  const handleSignUp = async () => {
    setInfo("");
    setError("");

    try {
      await supabaseClient.auth.signUpWithPassword(email, password);
      setInfo("Check your email to confirm your account.");
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
    }
  };

  const handleSignIn = async () => {
    setInfo("");
    setError("");

    try {
      const nextSession = await supabaseClient.auth.signInWithPassword(email, password);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
    }
  };

  const saveProfile = async () => {
    if (!session?.access_token || !authUser?.id) return;

    setSavingProfile(true);
    setInfo("");
    setError("");

    try {
      await supabaseClient.from("profiles").upsert(
        session.access_token,
        {
          id: authUser.id,
          full_name: fullName || null,
          business_name: businessName || null,
          business_type: businessType || null,
          location: location || null,
          contact: contact || null,
          updated_at: new Date().toISOString(),
        },
        "id",
      );
      setInfo("Profile saved.");
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGenerate = async () => {
    if (!session?.access_token) return;

    setGenerating(true);
    setCaptions(null);
    setGeneratedImage(null);
    setInfo("");
    setError("");

    try {
      const response = await fetch("/api/wovo-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_name: businessName,
          business_type: businessType,
          location,
          contact,
          topic,
          goal,
        }),
      });

      const payload = (await response.json()) as {
        captions?: Record<string, string>;
        generated_image_data?: string | null;
        data?: { captions?: Record<string, string>; generated_image_data?: string | null };
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to generate.");
        return;
      }

      const sourceCaptions = payload.captions ?? payload.data?.captions ?? {};
      setCaptions({
        facebook: sourceCaptions.facebook_caption ?? sourceCaptions.facebook ?? "",
        instagram: sourceCaptions.instagram_caption ?? sourceCaptions.instagram ?? "",
        tiktok: sourceCaptions.tiktok_caption ?? sourceCaptions.tiktok ?? "",
        hashtags: sourceCaptions.hashtags ?? "",
      });

      const imageData = payload.generated_image_data ?? payload.data?.generated_image_data ?? null;
      if (imageData) {
        setGeneratedImage(ensureDataUrl(imageData));
      }
    } catch {
      setError("Unable to generate right now.");
    } finally {
      setGenerating(false);
    }
  };

  const clearGeneration = () => {
    setTopic("");
    setGoal("");
    setCaptions(null);
    setGeneratedImage(null);
    setInfo("");
    setError("");
  };

  const copyCaptions = async () => {
    if (!captions) return;

    const allCaptions = [
      `Facebook Caption:\n${captions.facebook}`,
      `Instagram Caption:\n${captions.instagram}`,
      `TikTok Caption:\n${captions.tiktok}`,
      `Hashtags:\n${captions.hashtags}`,
    ].join("\n\n");

    await navigator.clipboard.writeText(allCaptions);
    setInfo("Captions copied.");
  };

  const deleteAccount = async () => {
    if (!session?.access_token) return;

    const response = await fetch("/api/wovo-ai/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to delete account.");
      return;
    }

    signOut();
    setShowDeleteModal(false);
    setInfo("Your account was deleted.");
  };

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {!loadingSession && !session ? (
          <section className="mx-auto flex min-h-[78vh] max-w-md items-center justify-center">
            <div className="w-full rounded-2xl border border-white/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">Wovo AI Dashboard</p>
              <h1 className="mt-2 text-2xl font-bold">Sign in to continue</h1>
              <p className="mt-2 text-sm text-white/70">Generate platform-ready captions and creative concepts in seconds.</p>

              <div className="mt-5 space-y-3">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className={fieldClass} />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className={fieldClass} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => void handleSignIn()} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-300">
                  Sign in
                </button>
                <button type="button" onClick={() => void handleSignUp()} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10">
                  Sign up
                </button>
              </div>

              <button type="button" onClick={handleGoogle} className="mt-3 w-full rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10">
                Continue with Google
              </button>
            </div>
          </section>
        ) : null}

        {loadingSession ? <p className="text-sm text-white/60">Loading session...</p> : null}

        {!loadingSession && session ? (
          <>
            <header className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Wovo AI</h1>
                  <p className="text-sm text-white/70">{authUser?.email ?? "Signed in"}</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10">Home</Link>
                  <button type="button" onClick={signOut} className="rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold transition hover:bg-white/10">
                    Sign out
                  </button>
                </div>
              </div>
            </header>

            <section className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">Profile</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => void saveProfile()} disabled={savingProfile} className="rounded-lg border border-white/30 px-4 py-2 text-sm transition hover:bg-white/10 disabled:opacity-60">
                    {savingProfile ? "Saving..." : "Save profile"}
                  </button>
                  <button type="button" onClick={() => setShowDeleteModal(true)} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/10">
                    Delete account
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className={fieldClass} />
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" className={fieldClass} />
                <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business Type" className={fieldClass} />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className={fieldClass} />
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (phone or website)" className={`${fieldClass} sm:col-span-2 lg:col-span-1`} />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-6">
                <h2 className="text-lg font-semibold">Create content</h2>
                <p className="mt-1 text-sm text-white/65">Use your saved profile context and add a topic + goal to generate platform captions.</p>

                <div className="mt-4 grid gap-3">
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className={fieldClass} />
                  <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business Type" className={fieldClass} />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className={fieldClass} />
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (phone or website)" className={fieldClass} />
                  <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" className={fieldClass} />
                  <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={fieldClass} />
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => void handleGenerate()} disabled={generating} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:opacity-60">
                    {generating ? "Generating..." : "Generate"}
                  </button>
                  <button type="button" onClick={clearGeneration} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10">
                    Clear
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Results preview</h2>
                  {captions ? (
                    <button type="button" onClick={() => void copyCaptions()} className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10">
                      Copy captions
                    </button>
                  ) : null}
                </div>

                {generating ? <p className="mt-4 text-sm text-white/70">Generating captions and image data...</p> : null}

                {captions ? (
                  <div className="mt-4 space-y-3">
                    <CaptionBlock title="Facebook Caption" value={captions.facebook} />
                    <CaptionBlock title="Instagram Caption" value={captions.instagram} />
                    <CaptionBlock title="TikTok Caption" value={captions.tiktok} />
                    <CaptionBlock title="Hashtags" value={captions.hashtags} />
                  </div>
                ) : !generating ? (
                  <p className="mt-4 rounded-xl border border-dashed border-white/20 p-4 text-sm text-white/60">
                    Your generated captions and image preview will appear here.
                  </p>
                ) : null}

                {generatedImage ? (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-sm font-semibold">Generated image</h3>
                    <Image
                      src={generatedImage}
                      alt="Generated Wovo creative"
                      width={1024}
                      height={1024}
                      unoptimized
                      className="h-auto w-full rounded-lg border border-white/20"
                    />
                    <a href={generatedImage} download="wovo-ai-image.png" className="inline-flex rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold transition hover:bg-white/10">
                      Download image
                    </a>
                  </div>
                ) : null}
              </div>
            </section>

            {showDeleteModal ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
                <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-5">
                  <h3 className="text-lg font-semibold">Delete account?</h3>
                  <p className="mt-2 text-sm text-white/70">This permanently removes your account and profile data.</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setShowDeleteModal(false)} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold transition hover:bg-white/10">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void deleteAccount()} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10">
                      Yes, delete
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {info ? <p className="text-sm text-emerald-300">{info}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </main>
  );
}
