import { NextResponse } from "next/server";
import { authRequestAllowed } from "@/lib/auth/request-limit";
import { getEnv } from "@/lib/env";

export async function POST(request: Request) {
  if (!authRequestAllowed(request, "recovery")) {
    return NextResponse.json({ success: true });
  }
  const body = await request.json().catch(() => ({})) as { email?: string; redirectTo?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const redirectTo = body.redirectTo ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: true });
  const configuredOrigin = getEnv("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  const allowedOrigin = configuredOrigin || new URL(request.url).origin;
  let safeRedirect = "";
  try {
    const parsed = new URL(redirectTo);
    if (parsed.origin === new URL(allowedOrigin).origin) safeRedirect = parsed.toString();
  } catch {
    safeRedirect = "";
  }
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (url && key) {
    await fetch(`${url}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ email, redirect_to: safeRedirect || undefined }),
      cache: "no-store",
    }).catch(() => null);
  }
  return NextResponse.json({ success: true });
}
