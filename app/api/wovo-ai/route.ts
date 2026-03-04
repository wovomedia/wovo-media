import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { isPaidStatus } from "@/lib/wovo-ai/plans";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WovoAiRequestBody = {
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  goal?: string;
  topic?: string;
  include_image?: boolean;
  image_base64?: string;
};

type ConsumeCreditRow = {
  consumed: boolean;
  credits_used_month: number;
  credits_limit_month: number;
};

type SubscriptionCreditsRow = {
  credits_total: number | null;
  credits_remaining: number | null;
  weekly_used: number | null;
  weekly_limit: number | null;
};

type GeneratedPayload = {
  captions: {
    facebook: string;
    instagram: string;
    tiktok: string;
  };
  hashtags: string[];
  image_prompt: string;
};

function parseJsonFromContent(rawContent: string): GeneratedPayload {
  const parsed = JSON.parse(rawContent) as Partial<GeneratedPayload>;

  return {
    captions: {
      facebook: parsed.captions?.facebook?.trim() ?? "",
      instagram: parsed.captions?.instagram?.trim() ?? "",
      tiktok: parsed.captions?.tiktok?.trim() ?? "",
    },
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 10)
      : [],
    image_prompt: parsed.image_prompt?.trim() ?? "",
  };
}

async function generateCaptionsWithOpenAI(input: Required<Omit<WovoAiRequestBody, "image_base64">> & { image_base64?: string | undefined }) {
  const contentParts: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Generate social media copy for a local business. Return JSON with shape:
{
  "captions": {
    "facebook": "string",
    "instagram": "string",
    "tiktok": "string"
  },
  "hashtags": ["tag1", "tag2", "..."] ,
  "image_prompt": "string"
}

Rules:
- Facebook caption: engagement focused and encourages comments.
- Instagram caption: reach focused, includes emojis, clear CTA.
- TikTok caption: strong hook, short lines, clear CTA.
- Hashtags: exactly 10 relevant hashtags with mix of local + niche.
- Keep captions concise, local/authentic, and CTA-driven.
- image_prompt: square promo graphic prompt, clean professional, readable text, strong focal point.

Business context:
- Topic: ${input.topic}
- Business Name: ${input.business_name || "N/A"}
- Business Type: ${input.business_type || "N/A"}
- Location: ${input.location || "N/A"}
- Contact: ${input.contact || "N/A"}
- Goal: ${input.goal || "N/A"}
- User included reference image: ${input.include_image ? "yes" : "no"}`,
    },
  ];

  if (input.include_image && input.image_base64) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: input.image_base64.startsWith("data:") ? input.image_base64 : `data:image/png;base64,${input.image_base64}`,
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
        { role: "system", content: "You are a social media strategist. Output valid JSON only." },
        { role: "user", content: contentParts },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI caption generation failed: ${details || response.status}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI returned empty caption content.");
  }

  return parseJsonFromContent(content);
}

async function generateImage(imagePrompt: string): Promise<string | null> {
  if (!imagePrompt) return null;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = payload.data?.[0];

  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  return first?.url ?? null;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Missing OPENAI_API_KEY environment variable" }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const isAdmin = isAdminEmail(user.email);

    const body = (await request.json()) as WovoAiRequestBody;
    const topic = body.topic?.trim() ?? "";

    if (!topic) {
      return Response.json({ error: "Topic is required." }, { status: 400 });
    }

    if (!isAdmin) {
      const subscription = await getSubscriptionStatus(user.id);
      if (!isPaidStatus(subscription.status)) {
        return Response.json({ error: "An active subscription is required." }, { status: 402 });
      }
      if (!subscription.can_generate) {
        return Response.json({ error: "No generation credits available." }, { status: 402 });
      }

      const consumeRows = await supabaseServiceRoleRequest<ConsumeCreditRow[]>("/rest/v1/rpc/consume_generation_credit", {
        method: "POST",
        body: JSON.stringify({ p_user_id: user.id }),
      });

      if (!consumeRows?.[0]?.consumed) {
        return Response.json({ error: "Credit limit reached." }, { status: 402 });
      }
    }

    const generated = await generateCaptionsWithOpenAI({
      business_name: body.business_name?.trim() ?? "",
      business_type: body.business_type?.trim() ?? "",
      location: body.location?.trim() ?? "",
      contact: body.contact?.trim() ?? "",
      goal: body.goal?.trim() ?? "",
      topic,
      include_image: Boolean(body.include_image),
      image_base64: body.image_base64,
    });

    const generatedImage = await generateImage(generated.image_prompt);

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
          include_image: Boolean(body.include_image),
        },
        output: {
          ...generated,
          image: generatedImage,
        },
      }),
    });

    const creditRows = isAdmin
      ? null
      : await supabaseServiceRoleRequest<SubscriptionCreditsRow[]>(
          `/rest/v1/subscriptions?select=credits_total,credits_remaining,weekly_used,weekly_limit&user_id=eq.${user.id}&limit=1`,
        );

    const creditRow = creditRows?.[0];

    return Response.json({
      captions: generated.captions,
      hashtags: generated.hashtags,
      image_prompt: generated.image_prompt,
      image: generatedImage ? { url: generatedImage } : null,
      updated_credits: {
        remaining: isAdmin ? 999999 : creditRow?.credits_remaining ?? 0,
        total: isAdmin ? 999999 : creditRow?.credits_total ?? 0,
        weekly_used: isAdmin ? 0 : creditRow?.weekly_used ?? 0,
        weekly_limit: isAdmin ? 999999 : creditRow?.weekly_limit ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
