import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireServerUser } from "@/lib/supabase/server";
import { getWovoAiRuntimeState } from "@/lib/wovo-ai/model-metering";

const OPENAI_API_KEY = getEnv("OPENAI_API_KEY");

type GenerateImageBody = {
  imagePrompt?: string;
  businessName?: string;
  businessType?: string;
  city?: string;
};

export async function POST(request: Request) {
  try {
    if (!getWovoAiRuntimeState().aiReady) {
      return NextResponse.json({ error: "WOVO AI visual generation is not enabled until provider safeguards and metering are verified." }, { status: 503 });
    }
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY on server." }, { status: 500 });
    }

    await requireServerUser(request.headers.get("authorization"));

    const body = (await request.json()) as GenerateImageBody;

    if (!body.imagePrompt) {
      return NextResponse.json({ error: "imagePrompt is required." }, { status: 400 });
    }

    const finalPrompt = `Create a social media marketing image.
Business: ${body.businessName ?? ""}
Type: ${body.businessType ?? ""}
City: ${body.city ?? ""}
Prompt: ${body.imagePrompt}`;

    const openAiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: finalPrompt,
        size: "1024x1024",
      }),
    });

    if (!openAiResponse.ok) {
      return NextResponse.json({ error: "OpenAI image request failed." }, { status: 502 });
    }

    const payload = (await openAiResponse.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const item = payload.data?.[0];

    if (item?.b64_json) {
      return NextResponse.json({ imageBase64: `data:image/png;base64,${item.b64_json}` });
    }

    if (item?.url) {
      return NextResponse.json({ imageUrl: item.url });
    }

    return NextResponse.json({ error: "No image returned." }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
