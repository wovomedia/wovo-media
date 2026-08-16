import { NextResponse } from "next/server";
import { authRequestAllowed } from "@/lib/auth/request-limit";
import { getEnv } from "@/lib/env";

export async function POST(request: Request) {
  if (!authRequestAllowed(request, "signup")) {
    return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string; options?: { email_redirect_to?: string } };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) {
    return NextResponse.json({ error: "Use a valid email and a password of at least 10 characters." }, { status: 400 });
  }
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const configuredOrigin = getEnv("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  const allowedOrigin = configuredOrigin || new URL(request.url).origin;
  let redirectTo: string | undefined;
  try {
    const candidate = new URL(body.options?.email_redirect_to ?? "");
    if (candidate.origin === new URL(allowedOrigin).origin) redirectTo = candidate.toString();
  } catch {
    redirectTo = undefined;
  }
  // GoTrue accepts the post-confirmation destination as the `redirect_to`
  // query parameter. Passing the supabase-js `options.emailRedirectTo` shape
  // directly in the JSON body is ignored by the Auth REST endpoint and falls
  // back to the project's site URL, which strands a verified customer on the
  // homepage instead of completing the portal handoff.
  const signupUrl = new URL(`${url}/auth/v1/signup`);
  if (redirectTo) signupUrl.searchParams.set("redirect_to", redirectTo);
  const response = await fetch(signupUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Unable to create account. Check your details or sign in if you already registered." }, { status: response.status === 429 ? 429 : 400 });
  }
  const payload = await response.json() as Record<string, unknown>;
  return NextResponse.json({ user: payload.user ?? null, verification_required: true });
}
