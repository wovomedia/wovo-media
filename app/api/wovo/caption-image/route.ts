import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
};

const CAPTION_SYSTEM_PROMPT =
  "You are Wovo AI. Create social media captions for small businesses that are engaging, clear, promotional, and ready to post.";

const IMAGE_PROMPT_INSTRUCTION =
  "Create a detailed image generation prompt that matches this social media caption. Make it visually appealing, promotional, and suitable for a business marketing post.";

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

    const captionResponse = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        { role: "system", content: CAPTION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });
    const caption = captionResponse.output_text?.trim();

    if (!caption) {
      return NextResponse.json({ error: "Caption generation failed." }, { status: 502 });
    }

    const imagePromptResponse = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        { role: "system", content: IMAGE_PROMPT_INSTRUCTION },
        { role: "user", content: caption },
      ],
    });
    const imagePrompt = imagePromptResponse.output_text?.trim();

    if (!imagePrompt) {
      return NextResponse.json({ error: "Image prompt generation failed." }, { status: 502 });
    }

    const imageResult = await client.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1024x1024",
    });

    const imageBase64 = imageResult.data?.[0]?.b64_json;
    if (!imageBase64) {
      return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
    }

    return NextResponse.json({
      caption,
      imagePrompt,
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate caption and image." }, { status: 500 });
  }
}
