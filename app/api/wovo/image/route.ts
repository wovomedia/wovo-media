import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = (await request.json()) as Body;
    const prompt = body.prompt?.trim() ?? "";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) {
      return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
    }

    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate image." }, { status: 500 });
  }
}
