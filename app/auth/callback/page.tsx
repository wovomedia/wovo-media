"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { persistSession } from "@/lib/supabase/session-client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const finishAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error_description") || params.get("error");
      const authCode = params.get("code");

      if (error) {
        console.error("[auth/callback] OAuth returned error", error);
        router.replace(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      if (authCode) {
        console.info("[auth/callback] Exchanging OAuth auth code for session");
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);

        if (exchangeError || !data.session) {
          console.error("[auth/callback] Failed to exchange auth code", exchangeError);
          router.replace("/login?error=google_auth_failed");
          return;
        }

        if (!mounted) return;
        persistSession(data.session);
        console.info("[auth/callback] Session established; redirecting to Wovo AI");
        router.replace("/wovo-ai");
        return;
      }

      const hash = window.location.hash;
      if (hash) {
        router.replace(`/wovo-ai${hash}`);
        return;
      }

      router.replace("/wovo-ai");
    };

    void finishAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <p className="text-sm text-white/70">Finishing sign in…</p>
    </main>
  );
}
