"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/site-url";
import { persistSession } from "@/lib/supabase/session-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const siteUrl = getBaseUrl();

  const loginWithGoogle = async () => {
    // Also configure Supabase Auth URL Configuration:
    // Site URL: https://wovomedia.com
    // Redirect URLs: https://wovomedia.com/auth/callback, https://wovomedia.com/login
    const { data } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${siteUrl}/auth/callback` } });
    if (data?.url) window.location.href = data.url;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold">Log in to Wovo AI</h1>
        <p className="mt-2 text-sm text-white/65">Sign in using the same method you used when creating your account.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-4 w-full rounded-xl border border-white/20 bg-black p-3" />
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
        <p className="mt-3 text-sm text-white/70">Need an account? <Link href="/signup" className="text-emerald-300">Sign up</Link></p>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    </main>
  );
}
