import { NextResponse } from "next/server";
import { requireServerUser, supabaseRestRequest } from "@/lib/supabase/server";

type GenerateBody = {
  promotionOffer?: string;
  postTopic?: string;
  platformEmphasis?: "Balanced" | "Calls" | "DMs" | "Website clicks";
};

type BusinessSettings = {
  user_id: string;
  business_name: string | null;
  business_type: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  brand_tone: string | null;
  description: string | null;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY on server." }, { status: 500 });
    }

    const { user, accessToken } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as GenerateBody;

    const settingsRows = await supabaseRestRequest<BusinessSettings[]>(
      `/rest/v1/business_settings?select=*&user_id=eq.${user.id}&limit=1`,
      accessToken,
    );

    const settings = settingsRows?.[0];

    if (!settings) {
      return NextResponse.json(
        { error: "Please complete your business settings first before generating posts." },
        { status: 400 },
      );
    }

    const prompt = `You are a social media marketing writer for local businesses.
Return JSON only with this exact shape:
{
  "facebook_caption": string,
  "instagram_caption": string,
  "tiktok_caption": string,
  "hashtags": string[10],
  "image_prompt": string
}

Business settings:
- Business name: ${settings.business_name ?? ""}
- Business type: ${settings.business_type ?? ""}
- City: ${settings.city ?? ""}
- Phone: ${settings.phone ?? ""}
- Website: ${settings.website ?? ""}
- Brand tone: ${settings.brand_tone ?? "professional"}
- Description: ${settings.description ?? ""}

Campaign input:
- Promotion/Offer: ${body.promotionOffer ?? ""}
- Post topic: ${body.postTopic ?? ""}
- Platform emphasis: ${body.platformEmphasis ?? "Balanced"}

Requirements:
- Captions must be short, punchy, CTA-focused, and tone-matched.
- If phone and/or website are present, include them naturally in CTA lines.
- Make hashtags relevant and without duplicates.
- image_prompt should describe a modern marketing graphic concept with readable overlay text ideas and brand-aligned vibe.`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      return NextResponse.json({ error: "OpenAI request failed." }, { status: 502 });
    }

    const completion = (await openAiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No generation content returned." }, { status: 502 });
    }

    const parsed = JSON.parse(content) as {
      facebook_caption: string;
      instagram_caption: string;
      tiktok_caption: string;
      hashtags: string[];
      image_prompt: string;
    };

    await supabaseRestRequest(
      "/rest/v1/generations",
      accessToken,
      {
        method: "POST",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          input: {
            promotionOffer: body.promotionOffer ?? "",
            postTopic: body.postTopic ?? "",
            platformEmphasis: body.platformEmphasis ?? "Balanced",
          },
          output: parsed,
        }),
      },
    );

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
