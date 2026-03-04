"use client";

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
  business_name: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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

export default function WovoAiPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [profileEmail, setProfileEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [debugCode, setDebugCode] = useState("");

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/wovo-ai`;
  }, []);

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

  useEffect(() => {
    const hydrateUserAndProfile = async () => {
      if (!session?.access_token) return;

      setProfileError("");

      try {
        const user = (await supabaseClient.auth.getUser(session.access_token)) as SupabaseAuthUser;
        setAuthUser(user);

        const row = await supabaseClient.from("profiles").selectById(session.access_token, user.id);

        if (!row) {
          await supabaseClient.from("profiles").insert(session.access_token, {
            id: user.id,
            email: user.email ?? null,
          });
        }

        const nextProfile = (await supabaseClient
          .from("profiles")
          .selectById(session.access_token, user.id)) as ProfileRecord | null;

        setProfile(nextProfile);
        setProfileEmail(nextProfile?.email ?? user.email ?? "");
        setFullName(nextProfile?.full_name ?? "");
        setBusinessName(nextProfile?.business_name ?? "");
      } catch (err: unknown) {
        const mapped = mapSupabaseAuthError(err);
        setError(mapped.message);
        setDebugCode(mapped.debugCode ?? "");
        setProfileError(toReadableError(err));
      }
    };

    void hydrateUserAndProfile();
  }, [session]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setAuthUser(null);
    setProfile(null);
    setProfileEmail("");
    setFullName("");
    setBusinessName("");
    setProfileError("");
    setInfo("");
    setError("");
    setDebugCode("");

    const params = new URLSearchParams(window.location.search);
    const currentError = params.get("error");
    const currentErrorCode = params.get("error_code");

    const nextParams = new URLSearchParams();
    if (currentError) nextParams.set("error", currentError);
    if (currentErrorCode) nextParams.set("error_code", currentErrorCode);

    const nextQuery = nextParams.toString();
    window.history.replaceState({}, document.title, nextQuery ? `/wovo-ai?${nextQuery}` : "/wovo-ai");
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
      await supabaseClient.auth.signUpWithPassword(email, password);
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
      const nextSession = await supabaseClient.auth.signInWithPassword(email, password);
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
      await supabaseClient.auth.sendPasswordReset(email, redirectUrl);
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
      await supabaseClient.from("profiles").updateById(session.access_token, authUser.id, {
        full_name: fullName || null,
        business_name: businessName || null,
        email: profileEmail || null,
        updated_at: new Date().toISOString(),
      });

      const nextProfile = (await supabaseClient
        .from("profiles")
        .selectById(session.access_token, authUser.id)) as ProfileRecord | null;

      setProfile(nextProfile);
      setInfo("Profile saved.");
    } catch (err: unknown) {
      const mapped = mapSupabaseAuthError(err);
      setError(mapped.message);
      setDebugCode(mapped.debugCode ?? "");
      setProfileError(toReadableError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">Wovo AI</h1>
        <p className="text-white/70">Supabase-connected account preview.</p>

        {loading ? <p>Loading session...</p> : null}

        {!loading && !session ? (
          <div className="space-y-4">
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
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded border border-white/20 bg-black px-3 py-2"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded border border-white/20 bg-black px-3 py-2"
                required
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded border border-white/30 px-3 py-1 text-sm">
                  Sign up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void submitSignIn();
                  }}
                  className="rounded border border-white/30 px-3 py-1 text-sm"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleForgotPassword();
                  }}
                  className="rounded border border-white/30 px-3 py-1 text-sm"
                >
                  Forgot password
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {!loading && session ? (
          <div className="space-y-4 rounded-lg border border-white/15 p-4">
            <h2 className="text-lg font-semibold">Authenticated User</h2>
            <p className="text-sm text-white/80">
              <span className="text-white/60">Email:</span> {authUser?.email ?? "Unknown"}
            </p>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-white/70">Business Name</span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="w-full rounded border border-white/20 bg-black px-3 py-2"
                  placeholder="Business Name"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-white/70">Full Name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded border border-white/20 bg-black px-3 py-2"
                  placeholder="Full Name"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  void handleSaveProfile();
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm"
              >
                Sign out
              </button>
            </div>

            {profile ? (
              <p className="text-xs text-white/60">Profile row id: {profile.id}</p>
            ) : (
              <p className="text-xs text-white/60">Profile row not loaded.</p>
            )}
          </div>
        ) : null}

        {profileError ? (
          <p className="text-sm text-red-300">Profile query error: {profileError}</p>
        ) : null}
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
