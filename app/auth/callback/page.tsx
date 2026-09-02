"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { parseSessionFromHash, persistSession } from "@/lib/supabase/session-client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function finish() {
      const params = new URLSearchParams(window.location.search);
      const candidate = params.get("next");
      const next = candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/portal";
      const error = params.get("error_description") || params.get("error");
      const authCode = params.get("code");
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(error)}`);
        return;
      }
      if (authCode) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
        if (exchangeError || !data.session) {
          router.replace("/login?error=google_auth_failed");
          return;
        }
        if (!mounted) return;
        persistSession(data.session);
        router.replace(next);
        return;
      }
      if (window.location.hash) {
        const session = parseSessionFromHash(window.location.hash);
        if (!session) {
          router.replace("/login?error=verification_failed");
          return;
        }
        persistSession(session);
        router.replace(next);
        return;
      }
      router.replace("/login?error=oauth_session_missing");
    }
    void finish();
    return () => { mounted = false; };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0c] p-5 text-[#f7f4ee]">
      <div className="w-full max-w-sm rounded-[28px] border border-white/12 bg-[#151516] p-8 text-center shadow-[0_30px_80px_rgba(25,23,20,.13)]">
        <div className="mx-auto flex w-fit items-center gap-2">
          <span className="text-2xl font-black tracking-[-0.075em]">WOVO</span>
          <span className="rounded-full border border-white/20 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/45">Media</span>
        </div>
        <div className="mx-auto mt-7 h-1.5 w-36 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full w-1/2 animate-[loading_1.4s_ease-in-out_infinite] rounded-full bg-[#f05a3a]" />
        </div>
        <h1 className="mt-6 text-3xl font-medium tracking-[-0.035em]">Finishing sign in.</h1>
        <p className="mt-3 text-sm leading-6 text-white/45">Securing your session and opening the right workspace…</p>
      </div>
    </main>
  );
}
