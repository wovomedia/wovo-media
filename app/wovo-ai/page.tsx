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
  email: string | null;
  full_name: string | null;
};

type BusinessSettingsRecord = {
  user_id: string;
  business_name: string | null;
  business_type: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  brand_tone: string | null;
  description: string | null;
};

type GenerationOutput = {
  facebook_caption: string;
  instagram_caption: string;
  tiktok_caption: string;
  hashtags: string[];
  image_prompt: string;
};

type GenerationRecord = {
  id: string;
  input: {
    promotionOffer?: string;
    postTopic?: string;
    platformEmphasis?: string;
  };
  output: GenerationOutput;
  created_at: string;
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

function toReadableError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;

  if (err && typeof err === "object") {
    const payload = err as { message?: string; error?: string; code?: string; error_code?: string };
    const base = payload.message ?? payload.error ?? "Unknown Supabase error";
    const code = payload.code ?? payload.error_code;
    return code ? `${base} (${code})` : base;
  }

  return "Unknown Supabase error";
}

function isRlsError(errorText: string) {
  const normalized = errorText.toLowerCase();
  return normalized.includes("permission denied") || normalized.includes("row-level security");
}

export default function WovoAiPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRecord | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("other");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [brandTone, setBrandTone] = useState("friendly");
  const [description, setDescription] = useState("");
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [promotionOffer, setPromotionOffer] = useState("");
  const [postTopic, setPostTopic] = useState("");
  const [platformEmphasis, setPlatformEmphasis] = useState("Balanced");
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generated, setGenerated] = useState<GenerationOutput | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [recentGenerations, setRecentGenerations] = useState<GenerationRecord[]>([]);

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [businessError, setBusinessError] = useState("");
  const [generatorError, setGeneratorError] = useState("");
  const [debugCode, setDebugCode] = useState("");

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/wovo-ai`;
  }, []);

  const authHeader = session?.access_token
    ? {
        Authorization: `Bearer ${session.access_token}`,
      }
    : undefined;

  useEffect(() => {
    const load = async () => {
      try {
        const url = new URL(window.location.href);
        const callbackError =
          url.searchParams.get("error") ??
          url.searchParams.get("error_description") ??
          url.searchParams.get("error_code");

        if (callbackError) {
          const mapped = mapSupabaseAuthError({
            code: url.searchParams.get("error_code") ?? undefined,
            message: url.searchParams.get("error_description") ?? callbackError,
          });
          setError(mapped.message);
          setDebugCode(mapped.debugCode ?? "");
        }

        const fromHash = parseSessionFromHash(window.location.hash);

        if (fromHash) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromHash));
          const preserved = window.location.search;
          window.history.replaceState({}, document.title, `/wovo-ai${preserved}`);
          setSession(fromHash);
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setSession(JSON.parse(stored) as SupabaseSession);
          }
        }
      } catch {
        const mapped = mapSupabaseAuthError({ message: "Unable to restore your session." });
        setError(mapped.message);
        setDebugCode(mapped.debugCode ?? "");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const loadRecentGenerations = async (token: string, userId: string) => {
    const rows = (await supabaseClient.from("generations").selectMany(token, {
      select: "id,input,output,created_at",
      user_id: `eq.${userId}`,
      order: "created_at.desc",
      limit: "10",
    })) as GenerationRecord[];

    setRecentGenerations(rows ?? []);
  };

  useEffect(() => {
    const hydrateUserData = async () => {
      if (!session?.access_token) return;
      setProfileError("");
      setBusinessError("");

      try {
        const user = (await supabaseClient.auth.getUser(session.access_token)) as SupabaseAuthUser;
        setAuthUser(user);

        let profileRow = (await supabaseClient
          .from("profiles")
          .selectOneByColumn(session.access_token, "id", user.id)) as ProfileRecord | null;

        if (!profileRow) {
          await supabaseClient.from("profiles").insert(session.access_token, {
            id: user.id,
            email: user.email ?? null,
            full_name: null,
          });

          profileRow = (await supabaseClient
            .from("profiles")
            .selectOneByColumn(session.access_token, "id", user.id)) as ProfileRecord | null;
        }

        setProfile(profileRow);
        setFullName(profileRow?.full_name ?? "");

        const settings = (await supabaseClient
          .from("business_settings")
          .selectOneByColumn(session.access_token, "user_id", user.id)) as BusinessSettingsRecord | null;

        setBusinessSettings(settings);
        setBusinessName(settings?.business_name ?? "");
        setBusinessType(settings?.business_type ?? "other");
        setCity(settings?.city ?? "");
        setPhone(settings?.phone ?? "");
        setWebsite(settings?.website ?? "");
        setBrandTone(settings?.brand_tone ?? "friendly");
        setDescription(settings?.description ?? "");

        await loadRecentGenerations(session.access_token, user.id);
      } catch (err: unknown) {
        const mapped = mapSupabaseAuthError(err);
        setError(mapped.message);
        setDebugCode(mapped.debugCode ?? "");
        const readable = toReadableError(err);

        if (isRlsError(readable)) {
          setProfileError("Profile access blocked by RLS. Confirm profile policies allow auth.uid() = id.");
          setBusinessError(
            "Business settings access blocked by RLS. Confirm policies allow auth.uid() = user_id.",
          );
        } else {
          setProfileError(readable);
        }
      }
    };

    void hydrateUserData();
  }, [session]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setAuthUser(null);
    setProfile(null);
    setBusinessSettings(null);
    setRecentGenerations([]);
    setGenerated(null);
    setGeneratedImage(null);
    setFullName("");
    setBusinessName("");
    setBusinessType("other");
    setCity("");
    setPhone("");
    setWebsite("");
    setBrandTone("friendly");
    setDescription("");
    setInfo("");
    setError("");
    setProfileError("");
    setBusinessError("");
    setGeneratorError("");
    setDebugCode("");

    window.history.replaceState({}, document.title, "/wovo-ai");
  };

  const handleGoogle = () => {
    setInfo("");
    setError("");
    setDebugCode("");

    try {
      const signInUrl = supabaseClient.auth.signInWithGoogle(redirectUrl);
      window.location.href = signInUrl;
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
      setDebugCode(mapped.debugCode ?? "");
    }
  };

  const handleSignUp = async () => {
    setInfo("");
    setError("");
    setDebugCode("");

    try {
      await supabaseClient.auth.signUpWithPassword(
        (document.getElementById("email") as HTMLInputElement).value,
        (document.getElementById("password") as HTMLInputElement).value,
      );
      setInfo("Check your email to confirm your account.");
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
      setDebugCode(mapped.debugCode ?? "");
    }
  };

  const submitSignIn = async () => {
    setInfo("");
    setError("");
    setDebugCode("");

    try {
      const nextSession = await supabaseClient.auth.signInWithPassword(
        (document.getElementById("email") as HTMLInputElement).value,
        (document.getElementById("password") as HTMLInputElement).value,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
      setDebugCode(mapped.debugCode ?? "");
    }
  };

  const handleForgotPassword = async () => {
    setInfo("");
    setError("");
    setDebugCode("");

    try {
      await supabaseClient.auth.sendPasswordReset((document.getElementById("email") as HTMLInputElement).value, redirectUrl);
      setInfo("Password reset email sent.");
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
      setDebugCode(mapped.debugCode ?? "");
    }
  };

  const handleSaveProfile = async () => {
    if (!session?.access_token || !authUser?.id) return;

    setInfo("");
    setError("");
    setDebugCode("");
    setProfileError("");
    setSavingProfile(true);

    try {
      await supabaseClient.from("profiles").updateByColumn(session.access_token, "id", authUser.id, {
        full_name: fullName || null,
      });

      const nextProfile = (await supabaseClient
        .from("profiles")
        .selectOneByColumn(session.access_token, "id", authUser.id)) as ProfileRecord | null;

      setProfile(nextProfile);
      setInfo("Profile saved.");
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
      setDebugCode(mapped.debugCode ?? "");
      const readable = toReadableError(err);
      setProfileError(isRlsError(readable) ? "Profile update blocked by RLS policies." : readable);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBusinessSettings = async () => {
    if (!session?.access_token || !authUser?.id) return;

    setInfo("");
    setBusinessError("");
    setSavingBusiness(true);

    try {
      await supabaseClient.from("business_settings").upsert(
        session.access_token,
        {
          user_id: authUser.id,
          business_name: businessName || null,
          business_type: businessType || null,
          city: city || null,
          phone: phone || null,
          website: website || null,
          brand_tone: brandTone || null,
          description: description || null,
          updated_at: new Date().toISOString(),
        },
        "user_id",
      );

      const nextSettings = (await supabaseClient
        .from("business_settings")
        .selectOneByColumn(session.access_token, "user_id", authUser.id)) as BusinessSettingsRecord | null;
      setBusinessSettings(nextSettings);
      setInfo("Business settings saved.");
    } catch (err: unknown) {
      const readable = toReadableError(err);
      setBusinessError(isRlsError(readable) ? "Business settings save blocked by RLS policies." : readable);
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session?.access_token) return;

    const confirmed = window.confirm("Delete your account permanently? This cannot be undone.");
    if (!confirmed) return;

    setInfo("");
    setError("");

    const response = await fetch("/api/wovo-ai/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to delete account.");
      return;
    }

    signOut();
    setInfo("Your account has been deleted.");
  };

  const handleGenerate = async () => {
    if (!session?.access_token) return;

    setGeneratorError("");
    setGenerated(null);
    setGeneratedImage(null);

    if (!businessSettings?.business_name) {
      setGeneratorError("Please complete and save Business Settings before generating content.");
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch("/api/wovo-ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          promotionOffer,
          postTopic,
          platformEmphasis,
        }),
      });

      const payload = (await response.json()) as GenerationOutput & { error?: string };

      if (!response.ok) {
        setGeneratorError(payload.error ?? "Unable to generate captions.");
        return;
      }

      setGenerated(payload);

      if (authUser?.id) {
        await loadRecentGenerations(session.access_token, authUser.id);
      }
    } catch {
      setGeneratorError("Unable to generate captions right now.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!generated?.image_prompt || !session?.access_token) return;
    setGeneratingImage(true);
    setGeneratorError("");

    try {
      const response = await fetch("/api/wovo-ai/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          imagePrompt: generated.image_prompt,
          businessName,
          businessType,
          city,
        }),
      });

      const payload = (await response.json()) as { imageBase64?: string; imageUrl?: string; error?: string };

      if (!response.ok) {
        setGeneratorError(payload.error ?? "Unable to generate image.");
        return;
      }

      setGeneratedImage(payload.imageBase64 ?? payload.imageUrl ?? null);
    } catch {
      setGeneratorError("Unable to generate image right now.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setInfo("Copied to clipboard.");
  };

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">Wovo AI</h1>
        <p className="text-white/70">Your AI dashboard for profile, business context, and post generation.</p>

        {loading ? <p>Loading session...</p> : null}

        {!loading && !session ? (
          <div className="space-y-4 rounded-lg border border-white/15 p-4">
            <button
              type="button"
              onClick={handleGoogle}
              className="inline-flex rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-black"
            >
              Sign in with Google
            </button>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSignUp();
              }}
              className="space-y-3 rounded-lg border border-white/15 p-4"
            >
              <h2 className="font-semibold">Email sign-up / sign-in</h2>
              <input id="email" type="email" placeholder="Email" className="w-full rounded border border-white/20 bg-black px-3 py-2" required />
              <input
                id="password"
                type="password"
                placeholder="Password"
                className="w-full rounded border border-white/20 bg-black px-3 py-2"
                required
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded border border-white/30 px-3 py-1 text-sm">Sign up</button>
                <button type="button" onClick={() => void submitSignIn()} className="rounded border border-white/30 px-3 py-1 text-sm">
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  className="rounded border border-white/30 px-3 py-1 text-sm"
                >
                  Forgot password
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {!loading && session ? (
          <div className="space-y-6">
            <section className="space-y-4 rounded-lg border border-white/15 p-4">
              <h2 className="text-lg font-semibold">Profile</h2>
              <p className="text-sm text-white/80">
                <span className="text-white/60">Email:</span> {authUser?.email ?? profile?.email ?? "Unknown"}
              </p>
              <label className="block text-sm">
                <span className="mb-1 block text-white/70">Full name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded border border-white/20 bg-black px-3 py-2"
                  placeholder="Full Name"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveProfile()}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={signOut} className="rounded-lg border border-white/20 px-4 py-2 text-sm">
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-200"
                >
                  Delete account
                </button>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-white/15 p-4">
              <h2 className="text-lg font-semibold">Business Settings (AI Context)</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className="rounded border border-white/20 bg-black px-3 py-2" />
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="rounded border border-white/20 bg-black px-3 py-2">
                  {['restaurant','HVAC','contractor','chiropractor','retail','other'].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="rounded border border-white/20 bg-black px-3 py-2" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded border border-white/20 bg-black px-3 py-2" />
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" className="rounded border border-white/20 bg-black px-3 py-2" />
                <select value={brandTone} onChange={(e) => setBrandTone(e.target.value)} className="rounded border border-white/20 bg-black px-3 py-2">
                  {['friendly','funny','bold','professional','local'].map((tone) => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                className="min-h-24 w-full rounded border border-white/20 bg-black px-3 py-2"
              />
              <button
                type="button"
                onClick={() => void handleSaveBusinessSettings()}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                disabled={savingBusiness}
              >
                {savingBusiness ? "Saving..." : "Save"}
              </button>
            </section>

            <section className="space-y-4 rounded-lg border border-white/15 p-4">
              <h2 className="text-lg font-semibold">AI Post Generator</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <input value={promotionOffer} onChange={(e) => setPromotionOffer(e.target.value)} placeholder="Promotion/Offer" className="rounded border border-white/20 bg-black px-3 py-2" />
                <input value={postTopic} onChange={(e) => setPostTopic(e.target.value)} placeholder="Post Topic" className="rounded border border-white/20 bg-black px-3 py-2" />
                <select value={platformEmphasis} onChange={(e) => setPlatformEmphasis(e.target.value)} className="rounded border border-white/20 bg-black px-3 py-2">
                  {['Balanced','Calls','DMs','Website clicks'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void handleGenerate()}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                disabled={generating}
              >
                {generating ? "Generating..." : "Generate"}
              </button>

              {generated ? (
                <div className="space-y-3">
                  {[
                    ["Facebook Caption", generated.facebook_caption],
                    ["Instagram Caption", generated.instagram_caption],
                    ["TikTok Caption", generated.tiktok_caption],
                  ].map(([title, value]) => (
                    <div key={title} className="rounded border border-white/15 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-medium">{title}</h3>
                        <button className="rounded border border-white/30 px-2 py-1 text-xs" onClick={() => void copyText(value)}>
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-white/80">{value}</p>
                    </div>
                  ))}

                  <div className="rounded border border-white/15 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-medium">Hashtags</h3>
                      <button
                        className="rounded border border-white/30 px-2 py-1 text-xs"
                        onClick={() => void copyText(generated.hashtags.join(" "))}
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-sm text-white/80">{generated.hashtags.join(" ")}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleGenerateImage()}
                      className="rounded border border-white/30 px-3 py-1 text-sm"
                      disabled={generatingImage}
                    >
                      {generatingImage ? "Generating Image..." : "Generate Image"}
                    </button>
                    <span className="text-xs text-white/60">Prompt: {generated.image_prompt}</span>
                  </div>

                  {generatedImage ? (
                    <div className="space-y-2">
                      <Image src={generatedImage} alt="Generated marketing creative" width={512} height={512} unoptimized className="max-w-md rounded border border-white/20" />
                      <a
                        href={generatedImage}
                        download="wovo-generated-image.png"
                        className="inline-flex rounded border border-white/30 px-3 py-1 text-sm"
                      >
                        Download
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {recentGenerations.length > 0 ? (
                <div className="space-y-2 rounded border border-white/15 p-3">
                  <h3 className="font-medium">Recent Generations</h3>
                  <ul className="space-y-2">
                    {recentGenerations.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/80">
                        <span>
                          {new Date(item.created_at).toLocaleString()} - {item.input?.postTopic || "Untitled"}
                        </span>
                        <button
                          className="rounded border border-white/30 px-2 py-1 text-xs"
                          onClick={() => setGenerated(item.output)}
                        >
                          Re-open
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {profileError ? <p className="text-sm text-red-300">Profile error: {profileError}</p> : null}
        {businessError ? <p className="text-sm text-red-300">Business settings error: {businessError}</p> : null}
        {generatorError ? <p className="text-sm text-red-300">Generator error: {generatorError}</p> : null}
        {info ? <p className="text-emerald-300">{info}</p> : null}
        {error ? (
          <p className="text-red-300">
            {error}
            {debugCode ? <span className="ml-2 text-xs text-red-200/80">({debugCode})</span> : null}
          </p>
        ) : null}
      </div>
    </main>
  );
}
