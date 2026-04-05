import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { listFollowProfiles } from "@/lib/wovo-ai/follows";
import { isUuid } from "@/lib/wovo-ai/feed-utils";

type ListType = "followers" | "following";

function normalizeListType(value: string | null): ListType {
  return value === "following" ? "following" : "followers";
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const url = new URL(request.url);
    const requestedUserId = (url.searchParams.get("userId") ?? "").trim();
    const targetUserId = isUuid(requestedUserId) ? requestedUserId : user.id;
    const type = normalizeListType(url.searchParams.get("type"));

    const profiles = await listFollowProfiles(targetUserId, type, user.id);
    return NextResponse.json({
      type,
      userId: targetUserId,
      profiles,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load follow list." },
      { status: 500 },
    );
  }
}

