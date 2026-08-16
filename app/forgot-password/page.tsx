"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthFrame, authInputClass, authPrimaryButtonClass } from "@/components/auth/auth-frame";
import { supabase } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/site-url";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      `${getBaseUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`
    );
    setLoading(false);
    setMessage("If that email belongs to an account, a secure reset link is on the way.");
  }

  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Reset your password."
      description="Enter your account email. The response stays the same whether or not the address is registered."
    >
      <form onSubmit={submit}>
        <label className="block text-sm font-semibold text-[#3f3b35]">
          Email address
          <input required autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" className={authInputClass} />
        </label>
        <button disabled={loading} className={`${authPrimaryButtonClass} mt-5`}>{loading ? "Sending securely…" : "Send recovery link"}</button>
      </form>
      {message ? <p role="status" className="mt-4 rounded-xl border border-[#f05a3a]/22 bg-[#f05a3a]/10 p-3 text-sm leading-6 text-[#8f301f]">{message}</p> : null}
      <div className="mt-5 text-center">
        <Link href="/login?next=/portal" className="inline-flex min-h-11 items-center text-sm font-bold text-[#d94326] underline-offset-4 hover:underline">Back to sign in</Link>
      </div>
    </AuthFrame>
  );
}
