"use client";

import { useEffect, useMemo, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabaseClient, type SupabaseSession } from "@/lib/supabase/client";

type UserRecord = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_id?: string | null;
  price_id?: string | null;
  created_at?: string | null;
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

export default function WovoAiPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [authUser, setAuthUser] = useState<Record<string, unknown> | null>(null);
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
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
    const hydrateUser = async () => {
      if (!session?.access_token) return;

      try {
        const user = await supabaseClient.auth.getUser(session.access_token);
        setAuthUser(user);

        const emailAddress = typeof user?.email === "string" ? user.email : "";

        if (emailAddress) {
          const profile = (await supabaseClient
            .from("users")
            .selectByEmail(session.access_token, emailAddress)) as UserRecord | null;
          setUserRecord(profile);
        }
      } catch (err: unknown) {
        const mapped = mapSupabaseAuthError(err);
        setError(mapped.message);
        setDebugCode(mapped.debugCode ?? "");
      }
    };

    void hydrateUser();
  }, [session]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setAuthUser(null);
    setUserRecord(null);
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
          <div className="space-y-4">
            <div className="rounded-lg border border-white/15 p-4">
              <h2 className="mb-2 text-lg font-semibold">Authenticated User</h2>
              <pre className="overflow-x-auto text-xs text-white/80">
                {JSON.stringify(authUser, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg border border-white/15 p-4">
              <h2 className="mb-2 text-lg font-semibold">users table row</h2>
              <pre className="overflow-x-auto text-xs text-white/80">
                {JSON.stringify(userRecord, null, 2)}
              </pre>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm"
            >
              Sign out
            </button>
          </div>
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
