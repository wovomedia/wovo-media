"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame, authInputClass, authPrimaryButtonClass } from "@/components/auth/auth-frame";
import { getBaseUrl } from "@/lib/site-url";
import { clearPendingOnboarding, storePendingOnboarding } from "@/lib/wovo-ai/onboarding-client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function nextPath() {
    const candidate = new URLSearchParams(window.location.search).get("next");
    return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/portal";
  }

  async function onSignup(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !email || password.length < 10) {
      setError("Enter your name, email, and a password of at least 10 characters.");
      return;
    }
    setLoading(true);
    setError("");
    storePendingOnboarding({
      full_name: fullName.trim(),
      username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
      age: 18,
      gender: "other",
    });
    const next = nextPath();
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        options: { email_redirect_to: `${getBaseUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
      }),
    });
    const result = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) {
      clearPendingOnboarding();
      setError(result.error ?? "Unable to create account.");
      return;
    }
    router.push(`/login?next=${encodeURIComponent(next)}&notice=check_email`);
  }

  return (
    <AuthFrame
      eyebrow="Create your workspace"
      title="Start with a verified account."
      description="Account creation is free. Preview your workspace, then choose monthly, 3-month, 6-month, or yearly billing—or buy one-time credits."
    >
      <div className="mb-6" aria-label="Account setup progress">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-white/40"><span className="text-[#ff8c70]">1 · Account</span><span>2 · Verify email</span><span>3 · Start creating</span></div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/3 rounded-full bg-[#f05a3a]" /></div>
      </div>
      <form onSubmit={(event) => void onSignup(event)}>
        <label className="block text-sm font-semibold text-white/80">
          Full name
          <input required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={authInputClass} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-white/80">
          Email address
          <input required autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" className={authInputClass} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-white/80">
          Password
          <input required autoComplete="new-password" minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClass} />
          <span className="mt-2 block text-xs font-normal text-white/40">Use at least 10 characters and a password you do not reuse elsewhere.</span>
        </label>
        <button disabled={loading} className={`${authPrimaryButtonClass} mt-5`}>{loading ? "Creating account…" : "Create account"}</button>
      </form>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm leading-6 text-red-200">{error}</p> : null}
      <p className="mt-4 text-xs leading-5 text-white/40">After email verification, a short setup collects your business context and asset-rights confirmation. Your workspace then opens with 10 free credits — no card required.</p>
      <p className="mt-5 text-center text-sm text-white/45">
        Already have an account?{" "}
        <Link href="/login?next=/portal" className="inline-flex min-h-11 items-center font-bold text-[#ff8c70] underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
