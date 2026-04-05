import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isUuid } from "@/lib/wovo-ai/feed-utils";
import { isMissingDmTablesError, setFallbackMessagingBlockState } from "@/lib/wovo-ai/dm-fallback";

type BlockBody = {
  targetUserId?: string;
};

async function setTableBlockState(
  currentUserId: string,
  targetUserId: string,
  shouldBlock: boolean,
) {
  if (shouldBlock) {
    await supabaseServiceRoleRequest("/rest/v1/dm_blocks?on_conflict=blocker_user_id,blocked_user_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        blocker_user_id: currentUserId,
        blocked_user_id: targetUserId,
      }),
    });
  } else {
    await supabaseServiceRoleRequest(
      `/rest/v1/dm_blocks?blocker_user_id=eq.${encodeURIComponent(currentUserId)}&blocked_user_id=eq.${encodeURIComponent(targetUserId)}`,
      { method: "DELETE" },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as BlockBody;
    const targetUserId = (body.targetUserId ?? "").trim();

    if (!targetUserId || !isUuid(targetUserId)) {
      return NextResponse.json({ error: "Valid targetUserId is required." }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot block yourself." }, { status: 400 });
    }

    try {
      await setTableBlockState(user.id, targetUserId, true);
    } catch (error) {
      if (!isMissingDmTablesError(error)) throw error;
      await setFallbackMessagingBlockState(user.id, targetUserId, true);
    }

    return NextResponse.json({ success: true, blocked: true });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to block user." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as BlockBody;
    const targetUserId = (body.targetUserId ?? "").trim();

    if (!targetUserId || !isUuid(targetUserId)) {
      return NextResponse.json({ error: "Valid targetUserId is required." }, { status: 400 });
    }

    try {
      await setTableBlockState(user.id, targetUserId, false);
    } catch (error) {
      if (!isMissingDmTablesError(error)) throw error;
      await setFallbackMessagingBlockState(user.id, targetUserId, false);
    }

    return NextResponse.json({ success: true, blocked: false });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to unblock user." },
      { status: 500 },
    );
  }
}

