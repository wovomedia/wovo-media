"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { persistSession } from "@/lib/supabase/session-client";

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    const finish = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error_description") || params.get("error");
      const authCode = params.get("code");
      if (error) { router.replace(`/login?error=${encodeURIComponent(error)}`); return; }
      if (authCode) {
        const { data, error: ex } = await supabase.auth.exchangeCodeForSession(authCode);
        if (ex || !data.session) { router.replace("/login?error=google_auth_failed"); return; }
        if (!mounted) return;
        persistSession(data.session);
        router.replace("/wovo-ai");
        return;
      }
      const hash = window.location.hash;
      if (hash) { router.replace(`/wovo-ai${hash}`); return; }
      router.replace("/wovo-ai");
    };
    void finish();
    return () => { mounted = false; };
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="text-3xl font-black text-emerald-400 mb-3">Wovo AI</div>
        <p className="text-zinc-400 text-sm">Finishing sign in…</p>
      </div>
    </main>
  );
}
