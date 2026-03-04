import { NextResponse } from "next/server";
import { POST as generateFromUnifiedRoute } from "@/app/api/wovo-ai/route";

export const runtime = "nodejs";

type GenerateBody = {
  message?: string;
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  goal?: string;
  reference_image?: string | null;
};

type UnifiedRoutePayload = {
  captions?: { facebook?: string; instagram?: string; tiktok?: string };
  hashtags?: string[];
  image_prompt?: string;
  image?: { url?: string } | null;
  updated_credits?: {
    remaining?: number;
    total?: number;
    weekly_used?: number;
    weekly_limit?: number;
  };
  error?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateBody;
  const topic = body.message?.trim() ?? "";

  const proxyBody = {
    topic,
    business_name: body.business_name,
    business_type: body.business_type,
    location: body.location,
    contact: body.contact,
    goal: body.goal,
    include_image: Boolean(body.reference_image),
    image_base64: body.reference_image ?? undefined,
  };

  const forwardedRequest = new Request(request.url.replace("/generate", ""), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(proxyBody),
  });

  const unifiedResponse = await generateFromUnifiedRoute(forwardedRequest);
  const payload = (await unifiedResponse.json()) as UnifiedRoutePayload;

  if (!unifiedResponse.ok) {
    return NextResponse.json({
      status: "inactive",
      plan: "none",
      remaining: { credits_total: 0, credits_remaining: 0, weekly_limit: 0, weekly_used: 0 },
      can_generate: false,
      message: payload.error ?? "Generation failed.",
      captions: [],
      hashtags: [],
      image_prompt: "",
      image: payload.image ?? null,
    }, { status: unifiedResponse.status });
  }

  const captions = [payload.captions?.facebook, payload.captions?.instagram, payload.captions?.tiktok]
    .map((caption) => caption?.trim() ?? "")
    .filter(Boolean);

  return NextResponse.json({
    status: "active",
    plan: "agency",
    remaining: {
      credits_total: payload.updated_credits?.total ?? 0,
      credits_remaining: payload.updated_credits?.remaining ?? 0,
      weekly_limit: payload.updated_credits?.weekly_limit ?? 0,
      weekly_used: payload.updated_credits?.weekly_used ?? 0,
    },
    can_generate: true,
    captions,
    hashtags: payload.hashtags ?? [],
    image_prompt: payload.image_prompt ?? "",
    image: payload.image ?? null,
  });
}
