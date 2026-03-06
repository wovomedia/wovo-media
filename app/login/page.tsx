"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/site-url";
import { persistSession, readSessionFromStorage } from "@/lib/supabase/session-client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { getAuthAccessState } from "@/lib/wovo-ai/access";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const siteUrl = getBaseUrl();

  useEffect(() => {
    const session = readSessionFromStorage();
    const authState = getAuthAccessState({ session });
    console.info("[login] Auth page guard", { route: "/login", isAuthenticated: authState.isAuthenticated });

    if (!authState.isAuthenticated || !session?.access_token) {
      return;
    }

    supabase.setAccessToken(session.access_token);
    void fetch("/api/wovo-ai/subscription", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          return;
        }

        const payload = (await response.json()) as UnifiedSubscriptionResponse;
        const nextAuthState = getAuthAccessState({ session, subscription: payload });
        const target = nextAuthState.hasAppAccess ? "/wovo-ai" : "/wovo-ai";
        console.info("[login] Authenticated user detected on auth page; redirecting", {
          target,
          hasAppAccess: nextAuthState.hasAppAccess,
          needsPlan: nextAuthState.needsPlan,
        });
        router.replace(target);
      })
      .catch((err: unknown) => {
        console.warn("[login] Failed to resolve subscription from auth page guard", err);
        router.replace("/wovo-ai");
      });
  }, [router]);


  const loginWithGoogle = async () => {
    // Also configure Supabase Auth URL Configuration:
    // Site URL: https://wovomedia.com
    // Redirect URLs: https://wovomedia.com/auth/callback, https://wovomedia.com/login
    const { data } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${siteUrl}/auth/callback` } });
    if (data?.url) window.location.href = data.url;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-zinc-950 p-5">
        <h1 className="text-2xl font-semibold">Log in to Wovo AI</h1>
        <p className="mt-1.5 text-sm text-white/65">Sign in using the same method you used to create your account.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-3 w-full rounded-xl border border-white/20 bg-black p-3" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mt-2 w-full rounded-xl border border-white/20 bg-black p-3" />
        <button
          onClick={async () => {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError || !data.session) return setError(mapSupabaseAuthError(signInError).message);
            persistSession(data.session);
            router.push("/wovo-ai");
          }}
          className="mt-3 w-full rounded-xl bg-emerald-400 p-3 font-semibold text-black"
        >
          Log in
        </button>
        <button onClick={() => void loginWithGoogle()} className="mt-2 w-full rounded-xl border border-white/25 p-3">Continue with Google</button>
        <p className="mt-2.5 text-sm text-white/70">Need an account? <Link href="/signup" className="text-emerald-300">Sign up</Link></p>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    </main>
  );
}
