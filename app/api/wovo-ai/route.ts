import OpenAI from "openai";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isActiveSubscription } from "@/lib/wovo-ai/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WovoAiRequestBody = {
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  topic?: string;
  goal?: string;
};

type PromptResult = {
  captions?: Record<string, string>;
  generated_image_data?: unknown;
  [key: string]: unknown;
};

type UserSubscriptionRow = {
  plan: string | null;
  credits_remaining: number | null;
  weekly_limit: number | null;
  subscription_status: string | null;
};

type GenerationRow = { id: string };

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Missing OPENAI_API_KEY environment variable" }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));

    const userRows = await supabaseServiceRoleRequest<UserSubscriptionRow[]>(
      `/rest/v1/users?select=plan,credits_remaining,weekly_limit,subscription_status&id=eq.${user.id}&limit=1`,
    );

    const subscription = userRows?.[0] ?? null;

    if (!subscription?.plan || !isActiveSubscription(subscription.subscription_status)) {
      return Response.json({ error: "Upgrade plan to generate more posts" }, { status: 402 });
    }

    const creditsRemaining = subscription.credits_remaining ?? 0;
    const weeklyLimit = subscription.weekly_limit ?? 0;

    if (creditsRemaining <= 0) {
      return Response.json({ error: "Upgrade plan to generate more posts" }, { status: 402 });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const usageRows = await supabaseServiceRoleRequest<GenerationRow[]>(
      `/rest/v1/generations?select=id&user_id=eq.${user.id}&created_at=gte.${encodeURIComponent(since)}`,
    );

    const postsUsedThisWeek = usageRows?.length ?? 0;
    if (postsUsedThisWeek >= weeklyLimit) {
      return Response.json({ error: "Weekly generation limit reached" }, { status: 429 });
    }

    await supabaseServiceRoleRequest(`/rest/v1/users?id=eq.${user.id}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        credits_remaining: creditsRemaining - 1,
      }),
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = (await request.json()) as WovoAiRequestBody;

    const business_name = body.business_name?.trim() ?? "";
    const business_type = body.business_type?.trim() ?? "";
    const location = body.location?.trim() ?? "";
    const contact = body.contact?.trim() ?? "";
    const topic = body.topic?.trim() ?? "";
    const goal = body.goal?.trim() ?? "";

    if (!business_name || !business_type || !location || !contact || !topic || !goal) {
      return Response.json(
        {
          error:
            "Missing required fields. Please provide business_name, business_type, location, contact, topic, and goal.",
        },
        { status: 400 },
      );
    }

    const response = await openai.responses.create({
      prompt: {
        id: "pmpt_69a7a0735c8c81908946ba48efcdc15106882ac1cfb894a6",
        variables: {
          business_name,
          business_type,
          location,
          contact,
          topic,
          goal,
        },
      },
    });

    const rawText = response.output_text?.trim() ?? "";

    if (!rawText) {
      return Response.json({ error: "OpenAI returned an empty response." }, { status: 502 });
    }

    let parsed: PromptResult | null = null;

    try {
      parsed = JSON.parse(rawText) as PromptResult;
    } catch {
      return Response.json(
        {
          captions: { raw: rawText },
          generated_image_data: null,
          raw_response: response,
        },
        { status: 200 },
      );
    }

    await supabaseServiceRoleRequest("/rest/v1/generations", {
      method: "POST",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: user.id,
        input: {
          business_name,
          business_type,
          location,
          contact,
          topic,
          goal,
        },
        output: parsed,
      }),
    });

    return Response.json(
      {
        captions: parsed.captions ?? null,
        generated_image_data: parsed.generated_image_data ?? null,
        data: parsed,
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
