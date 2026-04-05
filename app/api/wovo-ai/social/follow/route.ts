import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { applyFollowAction } from "@/lib/wovo-ai/follows";

type FollowBody = {
  targetUserId?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as FollowBody;
    const targetUserId = body.targetUserId?.trim() ?? "";

    if (!targetUserId || !isUuid(targetUserId)) {
      return NextResponse.json({ error: "Valid targetUserId is required." }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
    }

    const stats = await applyFollowAction(user.id, targetUserId, true);
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to follow user." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as FollowBody;
    const targetUserId = body.targetUserId?.trim() ?? "";

    if (!targetUserId || !isUuid(targetUserId)) {
      return NextResponse.json({ error: "Valid targetUserId is required." }, { status: 400 });
    }

    const stats = await applyFollowAction(user.id, targetUserId, false);
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to unfollow user." },
      { status: 500 },
    );
  }
}
