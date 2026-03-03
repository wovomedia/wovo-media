"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string>("");

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
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setSession(JSON.parse(stored) as SupabaseSession);
          }
        }
      } catch {
        setError("Unable to restore your session.");
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

        const email = typeof user?.email === "string" ? user.email : "";

        if (email) {
          const profile = (await supabaseClient
            .from("users")
            .selectByEmail(session.access_token, email)) as UserRecord | null;
          setUserRecord(profile);
        }
      } catch {
        setError("Unable to load user data from Supabase.");
      }
    };

    void hydrateUser();
  }, [session]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setAuthUser(null);
    setUserRecord(null);
    setError("");
  };

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">Wovo AI</h1>
        <p className="text-white/70">Supabase-connected account preview.</p>

        {loading ? <p>Loading session...</p> : null}

        {!loading && !session ? (
          <a
            href={supabaseClient.auth.signInWithGoogle(redirectUrl)}
            className="inline-flex rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-black"
          >
            Sign in with Google
          </a>
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

        {error ? <p className="text-red-300">{error}</p> : null}
      </div>
    </main>
  );
}
