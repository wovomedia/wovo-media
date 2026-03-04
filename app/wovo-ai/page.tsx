"use client";

import Image from "next/image";
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
      const nextCaptions: CaptionsPayload = {
        facebook: sourceCaptions.facebook_caption ?? sourceCaptions.facebook ?? "",
        instagram: sourceCaptions.instagram_caption ?? sourceCaptions.instagram ?? "",
        tiktok: sourceCaptions.tiktok_caption ?? sourceCaptions.tiktok ?? "",
        hashtags: sourceCaptions.hashtags ?? "",
      };

      setCaptions(nextCaptions);

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
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {loadingSession ? <p className="text-white/70">Loading session...</p> : null}

        {!loadingSession && !session ? (
          <section className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
            <div className="w-full rounded-2xl border border-white/15 bg-white/5 p-6">
              <h1 className="text-2xl font-bold">Wovo AI</h1>
              <p className="mt-2 text-sm text-white/70">Sign in to access your AI dashboard.</p>

              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  className="w-full rounded-lg border border-white/20 bg-black px-3 py-2"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="w-full rounded-lg border border-white/20 bg-black px-3 py-2"
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => void handleSignIn()} className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-black">
                  Sign in
                </button>
                <button type="button" onClick={() => void handleSignUp()} className="rounded-lg border border-white/30 px-4 py-2">
                  Sign up
                </button>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className="mt-3 w-full rounded-lg border border-white/30 px-4 py-2"
              >
                Continue with Google
              </button>
            </div>
          </section>
        ) : null}

        {!loadingSession && session ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
              <div>
                <h1 className="text-2xl font-bold">Wovo AI</h1>
                <p className="text-sm text-white/70">{authUser?.email ?? "Signed in"}</p>
              </div>
              <button type="button" onClick={signOut} className="rounded-lg border border-white/30 px-4 py-2 text-sm">
                Sign out
              </button>
            </header>

            <section className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Profile</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={savingProfile}
                    className="rounded-lg border border-white/30 px-4 py-2 text-sm"
                  >
                    {savingProfile ? "Saving..." : "Save profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-200"
                  >
                    Delete account
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (phone or website)" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business Type" className="rounded-lg border border-white/20 bg-black px-3 py-2 sm:col-span-2 lg:col-span-1" />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-6">
                <h2 className="text-lg font-semibold">Input</h2>
                <div className="mt-4 grid gap-3">
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                  <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business Type" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (phone or website)" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                  <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                  <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className="rounded-lg border border-white/20 bg-black px-3 py-2" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                    className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-black disabled:opacity-60"
                  >
                    {generating ? "Generating..." : "Generate"}
                  </button>
                  <button type="button" onClick={clearGeneration} className="rounded-lg border border-white/30 px-4 py-2">
                    Clear
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-6">
                <h2 className="text-lg font-semibold">Results Preview</h2>
                {generating ? <p className="mt-4 text-white/70">Generating captions and creative...</p> : null}

                {captions ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg border border-white/15 p-3">
                      <h3 className="font-semibold">Facebook Caption</h3>
                      <p className="mt-1 text-sm text-white/80">{captions.facebook || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-white/15 p-3">
                      <h3 className="font-semibold">Instagram Caption</h3>
                      <p className="mt-1 text-sm text-white/80">{captions.instagram || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-white/15 p-3">
                      <h3 className="font-semibold">TikTok Caption</h3>
                      <p className="mt-1 text-sm text-white/80">{captions.tiktok || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-white/15 p-3">
                      <h3 className="font-semibold">Hashtags</h3>
                      <p className="mt-1 text-sm text-white/80">{captions.hashtags || "-"}</p>
                    </div>

                    <button type="button" onClick={() => void copyCaptions()} className="rounded-lg border border-white/30 px-3 py-2 text-sm">
                      Copy captions
                    </button>
                  </div>
                ) : null}

                {generatedImage ? (
                  <div className="mt-4 space-y-3">
                    <h3 className="font-semibold">Image</h3>
                    <Image
                      src={generatedImage}
                      alt="Generated Wovo creative"
                      width={1024}
                      height={1024}
                      unoptimized
                      className="h-auto w-full rounded-lg border border-white/20"
                    />
                    <a href={generatedImage} download="wovo-ai-image.png" className="inline-flex rounded-lg border border-white/30 px-3 py-2 text-sm">
                      Download image
                    </a>
                  </div>
                ) : null}
              </div>
            </section>

            {showDeleteModal ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-5">
                  <h3 className="text-lg font-semibold">Delete account?</h3>
                  <p className="mt-2 text-sm text-white/70">This permanently removes your account and profile data.</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setShowDeleteModal(false)} className="rounded-lg border border-white/30 px-4 py-2 text-sm">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void deleteAccount()} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-200">
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
