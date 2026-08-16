"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame, authInputClass, authPrimaryButtonClass } from "@/components/auth/auth-frame";
import { clearSession, readSessionFromStorage } from "@/lib/supabase/session-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!readSessionFromStorage()?.access_token) router.replace("/forgot-password");
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    const token = readSessionFromStorage()?.access_token;
    if (!token) return setError("Your recovery session expired. Request a new link.");
    setLoading(true);
    setError("");
    const response = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Password update failed.");
      return;
    }
    clearSession();
    router.replace("/login?next=/portal&notice=password_updated");
  }

  return (
    <AuthFrame
      eyebrow="Secure recovery"
      title="Choose a new password."
      description="Recovery links are time-limited. Use a unique password with at least 10 characters."
    >
      <form onSubmit={submit}>
        <label className="block text-sm font-semibold text-[#3f3b35]">
          New password
          <input required autoComplete="new-password" minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClass} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-[#3f3b35]">
          Confirm new password
          <input required autoComplete="new-password" minLength={10} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={authInputClass} />
        </label>
        <button disabled={loading} className={`${authPrimaryButtonClass} mt-5`}>{loading ? "Saving securely…" : "Save new password"}</button>
      </form>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-700/15 bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p> : null}
    </AuthFrame>
  );
}
