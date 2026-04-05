"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/site-url";
import { clearPendingOnboarding, storePendingOnboarding } from "@/lib/wovo-ai/onboarding-client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signupWithGoogle = async () => {
    const { data } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${getBaseUrl()}/auth/callback` } });
    if (data?.url) window.location.href = data.url;
  };

  const onSignup = async () => {
    if (!fullName.trim() || !email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    storePendingOnboarding({ full_name: fullName.trim(), username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g,""), age: 18, gender: "other" });
    const { error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getBaseUrl()}/auth/callback` } });
    setLoading(false);
    if (err) { clearPendingOnboarding(); setError(err.message); return; }
    router.push("/wovo-ai");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060807] p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6">
        <div className="mb-6 text-center">
          <div className="text-2xl font-black text-emerald-400 mb-1">Wovo Media AI</div>
          <h1 className="text-xl font-bold text-white">Create your account</h1>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            🎁 7-day free trial — no charge until it ends
          </div>
        </div>
        <button onClick={() => void signupWithGoogle()} className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition mb-4">Continue with Google</button>
        <div className="relative mb-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"/></div><div className="relative flex justify-center"><span className="bg-zinc-950 px-3 text-xs text-zinc-500">or email</span></div></div>
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" className="mb-3 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50"/>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" className="mb-3 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50"/>
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 6 chars)" type="password" className="mb-4 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50"/>
        <button onClick={() => void onSignup()} disabled={loading} className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-bold text-black hover:bg-emerald-300 disabled:opacity-50 transition">{loading ? "Creating account..." : "Start 7-Day Free Trial →"}</button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-3 text-center text-xs text-zinc-600">By signing up you agree to our terms. Cancel any time during trial.</p>
        <p className="mt-3 text-center text-sm text-zinc-500">Already have an account? <Link href="/login" className="text-emerald-400 font-semibold">Sign in</Link></p>
        <p className="mt-2 text-center text-xs text-zinc-600"><a href="/" className="hover:text-zinc-400">← Back to wovomedia.com</a></p>
      </div>
    </main>
  );
}
