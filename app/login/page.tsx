"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame, authInputClass, authPrimaryButtonClass } from "@/components/auth/auth-frame";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase } from "@/lib/supabase/client";
import { persistSession } from "@/lib/supabase/session-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const errorValue = params.get("error");
      if (errorValue === "verification_failed") setError("That verification link is invalid or expired. Request a new verification email from the sign-up page.");
      if (errorValue === "oauth_session_missing") setError("That sign-in link came back without a session. Start again from this page.");
      if (errorValue === "google_auth_failed") setError("Google sign-in did not complete. Try again, or use your email and password.");
      const noticeValue = params.get("notice");
      if (noticeValue === "check_email") setNotice("Check your inbox and verify your email before signing in. Verification links expire and can only be used once.");
      if (noticeValue === "password_updated") setNotice("Your password was updated. Sign in with the new password.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function nextPath() {
    const candidate = new URLSearchParams(window.location.search).get("next");
    return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/portal";
  }

  async function loginWithEmail(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (authError || !data.session) {
      setError(mapSupabaseAuthError(authError).message);
      return;
    }
    persistSession(data.session);
    router.push(nextPath());
  }

  return (
    <AuthFrame
      eyebrow="Welcome back"
      title="Sign in to your workspace."
      description="Use the same method you chose when you created your account."
    >
      <form onSubmit={(event) => void loginWithEmail(event)}>
        <label className="block text-sm font-semibold text-[#3f3b35]">
          Email address
          <input
            required
            autoComplete="email"
            inputMode="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@business.com"
            className={authInputClass}
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-[#3f3b35]">
          Password
          <input
            required
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={authInputClass}
          />
        </label>
        <div className="mt-3 flex justify-end">
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-bold text-[#d94326] underline-offset-4 hover:underline">Forgot password?</Link>
        </div>
        <button disabled={loading} className={`${authPrimaryButtonClass} mt-2`}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      {notice ? <p role="status" className="mt-4 rounded-xl border border-[#f05a3a]/22 bg-[#f05a3a]/10 p-3 text-sm leading-6 text-[#8f301f]">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-700/15 bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p> : null}
      <p className="mt-6 text-center text-sm text-[#756e64]">
        New to WOVO?{" "}
        <Link href="/signup?next=/portal" className="inline-flex min-h-11 items-center font-bold text-[#d94326] underline-offset-4 hover:underline">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
