import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { getAuthAdminUserById, supabaseServiceRoleRequest, updateAuthUserById } from "@/lib/supabase/server";
import { appendAdminActionLog, appendAdminNotification } from "@/lib/admin/audit-log";

type CreditRow = {
  id: string;
  user_id: string;
  balance: number;
};

type ProfileCreditRow = {
  extra_credits: number | null;
};

type AdjustCreditsBody = {
  userId?: string;
  delta?: number;
  reason?: string;
};

function isMissingCreditsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("public.credits") ||
    ((message.includes("could not find the table") || message.includes("relation")) &&
      message.includes("credits"))
  );
}

function isMissingProfilesColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column profiles.") && message.includes("does not exist")) ||
    (message.includes("could not find the") &&
      message.includes("column") &&
      message.includes("profiles") &&
      message.includes("schema cache"))
  );
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser(request.headers.get("authorization"));
    const body = (await request.json()) as AdjustCreditsBody;

    if (!body.userId || typeof body.delta !== "number") {
      return NextResponse.json({ error: "userId and numeric delta are required." }, { status: 400 });
    }

    const profileRows = await supabaseServiceRoleRequest<ProfileCreditRow[]>(
      `/rest/v1/profiles?select=extra_credits&user_id=eq.${encodeURIComponent(body.userId)}&limit=1`
    ).catch((error) => {
      if (isMissingProfilesColumnError(error)) return [];
      throw error;
    });

    const currentProfileCredits = profileRows?.[0]?.extra_credits ?? 0;
    const nextProfileCredits = Math.max(currentProfileCredits + body.delta, 0);
    const profilePatchCandidates = [
      {
        extra_credits: nextProfileCredits,
        updated_at: new Date().toISOString(),
      },
      {
        extra_credits: nextProfileCredits,
      },
      {
        updated_at: new Date().toISOString(),
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
      const currentUserMetadata =
        typeof authTarget.user_metadata === "object" && authTarget.user_metadata !== null
          ? (authTarget.user_metadata as Record<string, unknown>)
          : {};
      const currentAppMetadata =
        typeof authTarget.app_metadata === "object" && authTarget.app_metadata !== null
          ? (authTarget.app_metadata as Record<string, unknown>)
          : {};
      await updateAuthUserById(authTarget.id, {
        user_metadata: {
          ...currentUserMetadata,
          forced_extra_credits: nextProfileCredits,
        },
        app_metadata: {
          ...currentAppMetadata,
          forced_extra_credits: nextProfileCredits,
        },
      }).catch(() => undefined);
    }

    let nextBalance = nextProfileCredits;
    try {
      const existing = await supabaseServiceRoleRequest<CreditRow[]>(
        `/rest/v1/credits?select=id,user_id,balance&user_id=eq.${encodeURIComponent(body.userId)}&limit=1`
      );
      const currentBalance = existing?.[0]?.balance ?? 0;
      nextBalance = Math.max(currentBalance + body.delta, 0);

      await supabaseServiceRoleRequest("/rest/v1/credits?on_conflict=user_id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: body.userId,
          balance: nextBalance,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (creditError) {
      if (!isMissingCreditsTableError(creditError)) {
        throw creditError;
      }
    }

    await appendAdminActionLog({
      adminUserId: adminUser.id,
      action: "adjust_credits",
      targetUserId: body.userId,
      metadata: {
        delta: body.delta,
        new_balance: nextBalance,
        profile_extra_credits: nextProfileCredits,
        reason: body.reason ?? "manual_adjustment",
      },
    });

    await appendAdminNotification({
      type: "credits_adjusted",
      payload: {
        target_user_id: body.userId,
        delta: body.delta,
        balance: nextBalance,
        profile_extra_credits: nextProfileCredits,
      },
    });

    return NextResponse.json({ ok: true, balance: nextBalance });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to adjust credits." },
      { status: 500 }
    );
  }
}
