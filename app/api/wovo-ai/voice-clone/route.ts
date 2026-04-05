import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireServerUser } from "@/lib/supabase/server";
import { resolveUserEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

type VoiceCloneRequest = {
  transcript?: string;
  audioBase64?: string;
  consent?: boolean;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const subscription = await getSubscriptionStatus(user.id, resolveUserEmail(user));
    const effectivePlan = (subscription.effective_plan ?? subscription.plan ?? "none").toString().toLowerCase();
    const hasProFeatureAccess =
      subscription.admin_access === true ||
      subscription.user_role === "admin" ||
      effectivePlan === "pro" ||
      effectivePlan === "business";

    if (!hasProFeatureAccess) {
      return NextResponse.json(
        { error: "AI Spokesperson voice features require Pro. Upgrade to Pro to unlock this module." },
        { status: 402 },
      );
    }

    const body = (await request.json()) as VoiceCloneRequest;
    if (!body.consent) {
      return NextResponse.json({ error: "User consent is required before voice processing." }, { status: 400 });
    }

    if (!body.transcript?.trim() || !body.audioBase64?.trim()) {
      return NextResponse.json({ error: "Transcript and audioBase64 are required." }, { status: 400 });
    }

    const cloneApiUrl = getEnv("VOICE_CLONE_API_URL");
    if (!cloneApiUrl) {
      return NextResponse.json(
        {
          error: "Voice clone API is not configured.",
          status: "not_configured",
          note: "Set VOICE_CLONE_API_URL (and VOICE_CLONE_API_KEY if needed) to enable this module.",
        },
        { status: 501 }
      );
    }

    const apiHeaders = new Headers({ "Content-Type": "application/json" });
    const cloneApiKey = getEnv("VOICE_CLONE_API_KEY");
    if (cloneApiKey) {
      apiHeaders.set("Authorization", `Bearer ${cloneApiKey}`);
    }

    const cloneResponse = await fetch(cloneApiUrl, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        transcript: body.transcript.trim(),
        audio_base64: body.audioBase64.trim(),
        consent: true,
      }),
      cache: "no-store",
    });

    const payload = await cloneResponse.json().catch(() => ({}));
    if (!cloneResponse.ok) {
      return NextResponse.json(
        {
          error: (payload as { error?: string }).error ?? "Voice clone API request failed.",
        },
        { status: cloneResponse.status }
      );
    }

    return NextResponse.json({
      status: "ok",
      result: payload,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice clone request failed." },
      { status: 500 }
    );
  }
}
