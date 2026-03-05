"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      router.replace(`/wovo-ai${hash}`);
      return;
    }

    router.replace("/wovo-ai");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <p className="text-sm text-white/70">Finishing sign in…</p>
    </main>
  );
}
