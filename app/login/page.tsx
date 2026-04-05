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
  const [loading, setLoading] = useState(false);

  const loginWithGoogle = async () => {
    const { data } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${getBaseUrl()}/auth/callback` } });
    if (data?.url) window.location.href = data.url;
  };

  const loginWithEmail = async () => {
    setLoading(true); setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err || !data.session) { setError(mapSupabaseAuthError(err).message); return; }
    persistSession(data.session);
    router.push("/wovo-ai");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060807] p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6">
        <div className="mb-6 text-center">
          <div className="text-2xl font-black text-emerald-400 mb-1">Wovo Media AI</div>
          <h1 className="text-xl font-bold text-white">Sign in to your account</h1>
          <p className="mt-1 text-sm text-zinc-400">Use the same method you signed up with</p>
        </div>
        <button onClick={() => void loginWithGoogle()} className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition mb-4">Continue with Google</button>
        <div className="relative mb-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div><div className="relative flex justify-center"><span className="bg-zinc-950 px-3 text-xs text-zinc-500">or email</span></div></div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="mb-3 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => e.key === "Enter" && void loginWithEmail()} className="mb-4 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50" />
        <button onClick={() => void loginWithEmail()} disabled={loading} className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-bold text-black hover:bg-emerald-300 disabled:opacity-50 transition">{loading ? "Signing in..." : "Sign In"}</button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-4 text-center text-sm text-zinc-500">Don't have an account? <Link href="/signup" className="text-emerald-400 font-semibold">Sign up — 7 days free</Link></p>
        <p className="mt-2 text-center text-xs text-zinc-600"><a href="/" className="hover:text-zinc-400">← Back to wovomedia.com</a></p>
      </div>
    </main>
  );
}
