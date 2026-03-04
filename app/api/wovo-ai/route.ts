import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getPlanConfig, getUpgradeSuggestion, isPaidStatus } from "@/lib/wovo-ai/plans";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

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

type CreditConsumeResponse = {
  consumed: boolean;
  credits_used_month: number;
  credits_limit_month: number;
};

function blockedResponse(message: string, currentPlan: "starter" | "pro" | "agency" | null) {
  return Response.json(
    {
      error: message,
      suggested_plan: getUpgradeSuggestion(currentPlan),
    },
    { status: 402 },
  );
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Missing OPENAI_API_KEY environment variable" }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const isAdmin = isAdminEmail(user.email);
    const subscription = isAdmin
      ? {
          status: "active",
          plan_key: "agency" as const,
          credits_used_month: 0,
          credits_limit_month: 999999,
          period_end: null,
          can_generate: true,
        }
      : await getSubscriptionStatus(user.id);
    const currentPlan = subscription.plan_key;

    if (!isAdmin && !isPaidStatus(subscription.status)) {
      return blockedResponse("An active subscription is required to generate posts.", currentPlan);
    }

    if (!isAdmin && subscription.credits_used_month >= subscription.credits_limit_month) {
      return blockedResponse("Monthly credits exhausted. Upgrade to continue generating.", currentPlan);
    }

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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      }),
    });

    if (!response.ok) {
      return Response.json({ error: "OpenAI request failed." }, { status: 502 });
    }

    const payload = (await response.json()) as { output_text?: string };
    const rawText = payload.output_text?.trim() ?? "";

    if (!rawText) {
      return Response.json({ error: "OpenAI returned an empty response." }, { status: 502 });
    }

    let parsed: PromptResult | null = null;

    try {
      parsed = JSON.parse(rawText) as PromptResult;
    } catch {
      parsed = {
        captions: { raw: rawText },
        generated_image_data: null,
      };
    }

    let consume: CreditConsumeResponse = {
      consumed: true,
      credits_used_month: subscription.credits_used_month,
      credits_limit_month: subscription.credits_limit_month,
    };

    try {
      const consumeRows = await supabaseServiceRoleRequest<CreditConsumeResponse[]>(
        "/rest/v1/rpc/consume_generation_credit",
        {
          method: "POST",
          body: JSON.stringify({ p_user_id: user.id }),
        },
      );

      const consumeResult = consumeRows?.[0];

      if (!consumeResult?.consumed && !isAdmin) {
        return blockedResponse("Monthly credits exhausted. Upgrade to continue generating.", currentPlan);
      }

      if (consumeResult) {
        consume = consumeResult;
      }
    } catch (consumeError) {
      if (!isAdmin) {
        throw consumeError;
      }
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
        credits_used_month: consume.credits_used_month,
        credits_limit_month: consume.credits_limit_month,
        current_plan_limit: subscription.plan_key ? getPlanConfig(subscription.plan_key).monthlyCredits : null,
      },
      { status: 200 },
    );
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
