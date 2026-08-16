"use client";

import { useState } from "react";
import { authSecondaryButtonClass } from "@/components/auth/auth-frame";
import { supabase } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/site-url";

type GoogleButtonProps = {
  /** Where to land after a successful sign in. Must be an app-relative path. */
  next?: string;
  label?: string;
  onError?: (message: string) => void;
};

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function GoogleButton({ next = "/portal", label = "Continue with Google", onError }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);

  async function startGoogleSignIn() {
    setLoading(true);
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/portal";
    const redirectTo = `${getBaseUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error || !data.url) {
      setLoading(false);
      onError?.("Could not reach Google sign-in. Try again, or use your email and password.");
      return;
    }

    // Full navigation, not a router push — we are handing off to Google's domain.
    window.location.assign(data.url);
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void startGoogleSignIn()}
      className={authSecondaryButtonClass}
    >
      {loading ? null : <GoogleMark />}
      {loading ? "Opening Google…" : label}
    </button>
  );
}
