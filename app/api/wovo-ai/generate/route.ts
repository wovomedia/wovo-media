import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export const runtime = "nodejs";

type GenerateBody = {
  message?: string;
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  goal?: string;
  image_base64?: string | null;
};

type ConsumeCreditResult = {
  consumed: boolean;
  credits_remaining: number;
  credits_total: number;
  weekly_used: number;
  weekly_limit: number;
};

type GeneratedPayload = {
  facebook_caption: string;
  instagram_caption: string;
  tiktok_caption: string;
  hashtags: string[];
  image_prompt: string;
};

function coerceHashtags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 10);
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY on server." }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const isAdmin = isAdminEmail(user.email);
    const body = (await request.json()) as GenerateBody;
    const message = body.message?.trim() ?? "";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    let credits: ConsumeCreditResult = {
      consumed: false,
      credits_remaining: 999999,
      credits_total: 999999,
      weekly_used: 0,
      weekly_limit: 999999,
    };

    if (!isAdmin) {
      const subscription = await getSubscriptionStatus(user.id);
      if (subscription.status !== "active") {
        return NextResponse.json({ error: "An active subscription is required." }, { status: 402 });
      }
      if (!subscription.can_generate) {
        return NextResponse.json({ error: "Credits exhausted or weekly limit reached." }, { status: 402 });
      }

      const consumeRows = await supabaseServiceRoleRequest<ConsumeCreditResult[]>("/rest/v1/rpc/consume_generation_credit", {
        method: "POST",
        body: JSON.stringify({ p_user_id: user.id }),
      });
      const consumeResult = consumeRows?.[0];
      if (!consumeResult?.consumed) {
        return NextResponse.json({ error: "Credits exhausted or weekly limit reached." }, { status: 402 });
      }
      credits = consumeResult;
    }

    const prompt = `You are Wovo AI, an expert social media marketer.
Return strict JSON only with this shape:
{
  "facebook_caption": string,
  "instagram_caption": string,
  "tiktok_caption": string,
  "hashtags": string[10],
  "image_prompt": string
}

User request: ${message}
Business details:
- Name: ${body.business_name ?? "N/A"}
- Type: ${body.business_type ?? "N/A"}
- Location: ${body.location ?? "N/A"}
- Contact: ${body.contact ?? "N/A"}
- Goal: ${body.goal ?? "N/A"}

Rules:
- Facebook caption optimized for engagement/comments.
- Instagram caption optimized for reach, includes emojis and CTA.
- TikTok caption optimized for hooks/virality.
- Provide exactly 10 relevant hashtags.
- image_prompt should describe a square promo graphic concept with clear text overlay ideas.`;

    const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
    if (body.image_base64) {
      content.push({
        type: "image_url",
        image_url: {
          url: body.image_base64,
        },
      });
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
          { role: "user", content },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const details = await openAiResponse.text();
      throw new Error(details || "OpenAI request failed.");
    }

    const completion = (await openAiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("No generation content returned.");
    }

    const parsed = JSON.parse(rawContent) as GeneratedPayload;

    let imageUrl: string | null = null;
    if (parsed.image_prompt) {
      const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: parsed.image_prompt,
          size: "1024x1024",
        }),
      });

      if (imageResponse.ok) {
        const imagePayload = (await imageResponse.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
        const image = imagePayload.data?.[0];
        if (image?.b64_json) imageUrl = `data:image/png;base64,${image.b64_json}`;
        if (!imageUrl && image?.url) imageUrl = image.url;
      }
    }

    return NextResponse.json({
      captions: {
        facebook: parsed.facebook_caption,
        instagram: parsed.instagram_caption,
        tiktok: parsed.tiktok_caption,
      },
      hashtags: coerceHashtags(parsed.hashtags),
      image: imageUrl ? { url: imageUrl } : null,
      remaining: {
        credits_remaining: credits.credits_remaining,
        credits_total: credits.credits_total,
        weekly_used: credits.weekly_used,
        weekly_limit: credits.weekly_limit,
      },
      admin_mode: isAdmin,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
