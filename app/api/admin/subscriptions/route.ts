import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import {
  getAuthAdminUserById,
  supabaseServiceRoleRequest,
  updateAuthUserById,
} from "@/lib/supabase/server";
import { appendAdminActionLog, appendAdminNotification } from "@/lib/admin/audit-log";
import { getPlanConfig } from "@/lib/wovo-ai/plans";

type UpdateSubscriptionBody = {
  userId?: string;
  status?: string;
  plan?: string;
  planId?: string | null;
};

function isMissingSubscriptionsColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("column") &&
    message.includes("subscriptions") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function isMissingSubscriptionsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("public.subscriptions") ||
    ((message.includes("relation") || message.includes("could not find the table")) &&
      message.includes("subscriptions"))
  );
}

function isMissingProfilesColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column profiles.") && message.includes("does not exist")) ||
    (message.includes("could not find the") && message.includes("column") && message.includes("profiles") && message.includes("schema cache"))
  );
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser(request.headers.get("authorization"));
    const body = (await request.json()) as UpdateSubscriptionBody;

    if (!body.userId || !body.status) {
      return NextResponse.json({ error: "userId and status are required." }, { status: 400 });
    }
    const normalizedStatus = body.status.trim().toLowerCase();
    const normalizedPlan = normalizedStatus === "active" && (body.plan === "starter" || body.plan === "pro")
      ? body.plan
      : "none";
    const monthlyLimit = normalizedPlan === "none" ? 0 : getPlanConfig(normalizedPlan).monthlyCredits;

    const subscriptionWriteCandidates: Array<Record<string, unknown>> = [
      {
        user_id: body.userId,
        status: normalizedStatus,
        plan: normalizedPlan,
        plan_id: body.planId ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: body.userId,
        status: normalizedStatus,
        plan: normalizedPlan,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: body.userId,
        status: normalizedStatus,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: body.userId,
        status: normalizedStatus,
      },
    ];

    let subscriptionWriteSucceeded = false;
    let lastSubscriptionError: unknown = null;
    for (const candidate of subscriptionWriteCandidates) {
      try {
        await supabaseServiceRoleRequest("/rest/v1/subscriptions?on_conflict=user_id", {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(candidate),
        });
        subscriptionWriteSucceeded = true;
        break;
      } catch (subscriptionError) {
        lastSubscriptionError = subscriptionError;
        if (isMissingSubscriptionsTableError(subscriptionError)) {
          subscriptionWriteSucceeded = true;
          break;
        }
        if (isMissingSubscriptionsColumnError(subscriptionError)) continue;
        throw subscriptionError;
      }
    }
    if (!subscriptionWriteSucceeded && lastSubscriptionError) {
      throw lastSubscriptionError;
    }

    const profilePatchCandidates = [
      {
        plan: normalizedPlan,
        monthly_limit: monthlyLimit,
        updated_at: new Date().toISOString(),
      },
      {
        plan: normalizedPlan,
        updated_at: new Date().toISOString(),
      },
      {
        updated_at: new Date().toISOString(),
      },
      {
        plan: normalizedPlan,
      },
    ];
    for (const candidate of profilePatchCandidates) {
      try {
        await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(body.userId)}`, {
          method: "PATCH",
          headers: {
            Prefer: "return=minimal",
          },
          body: JSON.stringify(candidate),
        });
        break;
      } catch (profilePatchError) {
        if (isMissingProfilesColumnError(profilePatchError)) continue;
        throw profilePatchError;
      }
    }

    const authTarget = await getAuthAdminUserById(body.userId).catch(() => null);
    if (authTarget?.id) {
      const currentAppMetadata = (authTarget.app_metadata ?? {}) as Record<string, unknown>;
      await updateAuthUserById(authTarget.id, {
        app_metadata: {
          ...currentAppMetadata,
          forced_plan: normalizedPlan,
          forced_subscription_status: normalizedStatus,
          forced_monthly_limit: monthlyLimit,
        },
      }).catch(() => undefined);
    }

    await appendAdminActionLog({
      adminUserId: adminUser.id,
      action: "update_subscription",
      targetUserId: body.userId,
      metadata: {
        status: normalizedStatus,
        plan: normalizedPlan,
        plan_id: body.planId ?? null,
      },
    });

    await appendAdminNotification({
      type: "subscription_updated",
      payload: {
        target_user_id: body.userId,
        status: normalizedStatus,
        plan: normalizedPlan,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update subscription." },
      { status: 500 }
    );
  }
}
