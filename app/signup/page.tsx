"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { clearPendingOnboarding, storePendingOnboarding } from "@/lib/wovo-ai/onboarding-client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState(18);
  const [gender, setGender] = useState<"boy" | "girl" | "other">("other");
  const [error, setError] = useState("");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin).replace(/\/$/, "");

  const onSignup = async () => {
    setError("");
    const onboarding = { full_name: fullName.trim(), username: username.trim(), age, gender };
    storePendingOnboarding(onboarding);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      clearPendingOnboarding();
      setError(error.message);
    } else {
      router.push("/wovo-ai");
    }
  };

  const signupWithGoogle = async () => {
    // Also configure Supabase Auth URL Configuration:
    // Site URL: https://wovomedia.com
    // Redirect URLs: https://wovomedia.com/auth/callback, https://wovomedia.com/login
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (data?.url) window.location.href = data.url;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-400/30 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold">Create your Wovo AI account</h1>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="rounded-xl border border-white/20 bg-black p-3" />
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="rounded-xl border border-white/20 bg-black p-3" />
          <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} placeholder="Age" className="rounded-xl border border-white/20 bg-black p-3" />
          <select value={gender} onChange={(e) => setGender(e.target.value as "boy" | "girl" | "other")} className="rounded-xl border border-white/20 bg-black p-3">
            <option value="boy">Boy</option><option value="girl">Girl</option><option value="other">Other</option>
          </select>
        </div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-2 w-full rounded-xl border border-white/20 bg-black p-3" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mt-2 w-full rounded-xl border border-white/20 bg-black p-3" />
        <button
          onClick={() => void onSignup()}
          className="mt-3 w-full rounded-xl bg-emerald-400 p-3 font-semibold text-black"
        >
          Create account
        </button>
        <button
          onClick={() => void signupWithGoogle()}
          className="mt-2 w-full rounded-xl border border-white/25 p-3"
        >
          Continue with Google
        </button>
        <p className="mt-3 text-sm text-white/70">Already have an account? <Link href="/login" className="text-emerald-300">Sign in</Link></p>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    </main>
  );
}
