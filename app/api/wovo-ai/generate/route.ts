import { NextResponse } from "next/server";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getPlanConfig } from "@/lib/wovo-ai/plans";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export const runtime = "nodejs";

type GenerateBody = {
  message?: string;
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  goal?: string;
  reference_image?: string | null;
  history?: Array<{ role?: "user" | "assistant"; text?: string }>;
};

type ConsumeCreditResult = {
  consumed: boolean;
  credits_remaining: number;
  credits_total: number;
  weekly_used: number;
  weekly_limit: number;
};

type GeneratedPayload = {
  captions?: unknown;
  hashtags?: unknown;
  image_prompt?: unknown;
};

function adminSubscription(): UnifiedSubscriptionResponse {
  const plan = getPlanConfig("agency");
  return {
    status: "active",
    plan: "agency",
    remaining: {
      credits_total: plan.monthlyCredits,
      credits_remaining: plan.monthlyCredits,
      weekly_limit: plan.weeklyLimit,
      weekly_used: 0,
    },
    can_generate: true,
  };
}

function fallbackSubscription(message?: string): UnifiedSubscriptionResponse {
  return {
    status: "inactive",
    plan: "none",
    remaining: { credits_total: 0, credits_remaining: 0, weekly_limit: 0, weekly_used: 0 },
    can_generate: false,
    message,
  };
}

function toStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean).slice(0, max);
}

function normalizeHistory(history: GenerateBody["history"]): Array<{ role: "user" | "assistant"; text: string }> {
  if (!Array.isArray(history)) return [];

  return history
    .map((turn) => ({
      role: turn?.role === "assistant" ? "assistant" : "user",
      text: turn?.text?.trim() ?? "",
    }))
    .filter((turn) => Boolean(turn.text))
    .slice(-8);
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ...fallbackSubscription("Missing OPENAI_API_KEY on server."), captions: [], hashtags: [], image_prompt: "" }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const isAdmin = isAdminEmail(user.email);
    const body = (await request.json()) as GenerateBody;
    const message = body.message?.trim() ?? "";
    const history = normalizeHistory(body.history);

    if (!message) {
      return NextResponse.json({ ...fallbackSubscription("Message is required."), captions: [], hashtags: [], image_prompt: "" }, { status: 400 });
    }

    const subscription = isAdmin ? adminSubscription() : await getSubscriptionStatus(user.id);
    if (!isAdmin && !subscription.can_generate) {
      return NextResponse.json({ ...subscription, captions: [], hashtags: [], image_prompt: "", message: "Credits exhausted or weekly limit reached." }, { status: 403 });
    }

    const historyContext = history.length
      ? `\nConversation context:\n${history.map((turn, index) => `${index + 1}. ${turn.role.toUpperCase()}: ${turn.text}`).join("\n")}`
      : "";

    const prompt = `You are Wovo AI, an expert social media marketer.
Return strict JSON only with this shape:
{
  "captions": string[5],
  "hashtags": string[10],
  "image_prompt": string
}

User request: ${message}
${historyContext}
Business details:
- Name: ${body.business_name ?? "N/A"}
- Type: ${body.business_type ?? "N/A"}
- Location: ${body.location ?? "N/A"}
- Contact: ${body.contact ?? "N/A"}
- Goal: ${body.goal ?? "N/A"}

Rules:
- Provide exactly 5 caption options for social posts.
- Provide exactly 10 relevant hashtags.
- image_prompt should describe a square promo graphic concept with clear text overlay ideas.`;

    const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
    if (body.reference_image) {
      content.push({ type: "image_url", image_url: { url: body.reference_image } });
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

    const completion = (await openAiResponse.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("No generation content returned.");

    const parsed = JSON.parse(rawContent) as GeneratedPayload;
    const captions = toStringArray(parsed.captions, 5);
    const hashtags = toStringArray(parsed.hashtags, 10);
    const imagePrompt = typeof parsed.image_prompt === "string" ? parsed.image_prompt : "";

    let remaining = subscription.remaining;
    if (!isAdmin) {
      const consumeRows = await supabaseServiceRoleRequest<ConsumeCreditResult[]>("/rest/v1/rpc/consume_generation_credit", {
        method: "POST",
        body: JSON.stringify({ p_user_id: user.id }),
      });
      const consumeResult = consumeRows?.[0];
      if (!consumeResult?.consumed) {
        return NextResponse.json({ ...subscription, captions: [], hashtags: [], image_prompt: "", message: "Credits exhausted or weekly limit reached." }, { status: 403 });
      }
      remaining = {
        credits_remaining: consumeResult.credits_remaining,
        credits_total: consumeResult.credits_total,
        weekly_used: consumeResult.weekly_used,
        weekly_limit: consumeResult.weekly_limit,
      };
    }

    const weeklyAllowed = remaining.weekly_limit <= 0 || remaining.weekly_used < remaining.weekly_limit;
    return NextResponse.json({
      ...subscription,
      remaining,
      can_generate: isAdmin ? true : remaining.credits_remaining > 0 && weeklyAllowed,
      captions,
      hashtags,
      image_prompt: imagePrompt,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ ...fallbackSubscription("Unauthorized"), captions: [], hashtags: [], image_prompt: "" }, { status: 401 });
    }

    return NextResponse.json({ ...fallbackSubscription(error instanceof Error ? error.message : "Unexpected error."), captions: [], hashtags: [], image_prompt: "" }, { status: 500 });
  }
}
