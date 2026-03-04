import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { isPaidStatus } from "@/lib/wovo-ai/plans";
import { getSubscriptionStatus, type RemainingCredits } from "@/lib/wovo-ai/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WovoAiRequestBody = {
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  goal?: string;
  topic?: string;
  reference_image?: string;
};

type ConsumeCreditResult = {
  consumed: boolean;
  credits_remaining: number;
  credits_total: number;
  weekly_used: number;
  weekly_limit: number;
};

type GeneratedPayload = {
  captions?: string[];
  image_prompt?: string;
  hashtags?: string[];
};

function normalizeGeneratedPayload(rawContent: string): { captions: string[]; image_prompt: string; hashtags: string[] } {
  const parsed = JSON.parse(rawContent) as GeneratedPayload;
  const captions = Array.isArray(parsed.captions)
    ? parsed.captions.map((caption) => String(caption).trim()).filter(Boolean).slice(0, 5)
    : [];

  return {
    captions,
    image_prompt: String(parsed.image_prompt ?? "").trim(),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 15)
      : [],
  };
}

async function generateWithOpenAI(input: Required<Omit<WovoAiRequestBody, "reference_image">> & { reference_image?: string }) {
  const contentParts: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `You are Wovo AI, an expert social media copywriter.
Return valid JSON only with this shape:
{
  "captions": ["caption1", "caption2", "caption3", "caption4", "caption5"],
  "hashtags": ["#..."],
  "image_prompt": "..."
}

Rules:
- Provide exactly 5 caption options.
- Captions should be a short/medium/long mix.
- Keep business details grounded and include clear CTAs.
- Provide up to 12 relevant hashtags.
- image_prompt should be one polished square promo concept suitable for image generation.

Business context:
- Topic: ${input.topic}
- Business Name: ${input.business_name || "N/A"}
- Business Type: ${input.business_type || "N/A"}
- Location: ${input.location || "N/A"}
- Contact: ${input.contact || "N/A"}
- Goal: ${input.goal || "N/A"}`,
    },
  ];

  if (input.reference_image) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: input.reference_image,
      },
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You output valid JSON only." },
        { role: "user", content: contentParts },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "OpenAI request failed.");
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const rawContent = payload.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("No generation content returned.");
  }

  return normalizeGeneratedPayload(rawContent);
}

async function generateImage(prompt: string): Promise<string | null> {
  if (!prompt) return null;

  const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    }),
  });

  if (!imageResponse.ok) return null;

  const imagePayload = (await imageResponse.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const image = imagePayload.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  return image?.url ?? null;
}

function toRemaining(credits: ConsumeCreditResult | RemainingCredits): RemainingCredits {
  return {
    credits_total: credits.credits_total,
    credits_remaining: credits.credits_remaining,
    weekly_limit: credits.weekly_limit,
    weekly_used: credits.weekly_used,
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY environment variable" }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const isAdmin = isAdminEmail(user.email);

    const body = (await request.json()) as WovoAiRequestBody;
    const topic = body.topic?.trim() ?? "";

    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    const subscription = isAdmin
      ? {
          status: "active",
          plan: "agency",
          can_generate: true,
          period_end: null,
          remaining: { credits_total: 999999, credits_remaining: 999999, weekly_limit: 999999, weekly_used: 0 },
        }
      : await getSubscriptionStatus(user.id);

    if (!isAdmin && !isPaidStatus(subscription.status)) {
      return NextResponse.json(
        {
          error: "An active subscription is required.",
          status: subscription.status,
          plan: subscription.plan,
          remaining: subscription.remaining,
          can_generate: false,
          message: "Upgrade to generate content.",
        },
        { status: 402 },
      );
    }

    if (!isAdmin && (subscription.remaining.credits_remaining <= 0 || subscription.remaining.weekly_used >= subscription.remaining.weekly_limit)) {
      const limitMessage =
        subscription.remaining.credits_remaining <= 0
          ? "You’re out of credits this month. Upgrade or wait for reset."
          : "Weekly limit reached. Try again after reset or upgrade.";
      return NextResponse.json(
        {
          error: limitMessage,
          status: subscription.status,
          plan: subscription.plan,
          remaining: subscription.remaining,
          can_generate: false,
          message: "Upgrade your plan for more generations.",
        },
        { status: 402 },
      );
    }

    const generated = await generateWithOpenAI({
      business_name: body.business_name?.trim() ?? "",
      business_type: body.business_type?.trim() ?? "",
      location: body.location?.trim() ?? "",
      contact: body.contact?.trim() ?? "",
      goal: body.goal?.trim() ?? "",
      topic,
      reference_image: body.reference_image,
    });

    const generatedImage = await generateImage(generated.image_prompt);

    let remaining = subscription.remaining;
    if (!isAdmin) {
      const consumeRows = await supabaseServiceRoleRequest<ConsumeCreditResult[]>("/rest/v1/rpc/consume_generation_credit", {
        method: "POST",
        body: JSON.stringify({ p_user_id: user.id }),
      });
      const consumeResult = consumeRows?.[0];
      if (!consumeResult?.consumed) {
        return NextResponse.json(
          {
            error: "Unable to consume credits. Please try again.",
            status: subscription.status,
            plan: subscription.plan,
            remaining: subscription.remaining,
            can_generate: false,
          },
          { status: 409 },
        );
      }
      remaining = toRemaining(consumeResult);
    }

    await supabaseServiceRoleRequest("/rest/v1/generations", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: user.id,
        input: {
          business_name: body.business_name?.trim() ?? "",
          business_type: body.business_type?.trim() ?? "",
          location: body.location?.trim() ?? "",
          contact: body.contact?.trim() ?? "",
          goal: body.goal?.trim() ?? "",
          topic,
          has_reference_image: Boolean(body.reference_image),
        },
        output: {
          captions: generated.captions,
          hashtags: generated.hashtags,
          image_prompt: generated.image_prompt,
          image: generatedImage,
        },
      }),
    });

    return NextResponse.json({
      status: subscription.status,
      plan: subscription.plan,
      remaining,
      can_generate: isAdmin || (remaining.credits_remaining > 0 && remaining.weekly_used < remaining.weekly_limit),
      captions: generated.captions,
      hashtags: generated.hashtags,
      image_prompt: generated.image_prompt,
      image: generatedImage ? { url: generatedImage } : null,
      admin_mode: isAdmin,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
