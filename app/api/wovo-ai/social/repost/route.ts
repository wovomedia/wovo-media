import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import {
  applyFallbackRepostAction,
  getFallbackRepostState,
  isMissingPostRepostsTableError,
} from "@/lib/wovo-ai/engagement-fallback";

type RepostBody = {
  postId?: string;
};

type GenerationRow = {
  id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function validateFeedPost(postId: string) {
  const rows = await supabaseServiceRoleRequest<GenerationRow[]>(
    `/rest/v1/generations?select=id,input,output&id=eq.${encodeURIComponent(postId)}&limit=1`
  );
  const post = rows?.[0];
  if (!post || !isEligibleFeedPost(post)) {
    throw new Error("Post is not available in the Wovo feed.");
  }
}

async function getRepostState(postId: string, viewerId: string) {
  try {
    const [allReposts, viewerReposts] = await Promise.all([
      supabaseServiceRoleRequest<Array<{ user_id: string }>>(
        `/rest/v1/post_reposts?select=user_id&post_id=eq.${encodeURIComponent(postId)}`
      ),
      supabaseServiceRoleRequest<Array<{ user_id: string }>>(
        `/rest/v1/post_reposts?select=user_id&post_id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(viewerId)}&limit=1`
      ),
    ]);

    return {
      repostsCount: allReposts?.length ?? 0,
      repostedByViewer: Boolean(viewerReposts?.length),
    };
  } catch (error) {
    if (!isMissingPostRepostsTableError(error)) throw error;
    return await getFallbackRepostState(postId, viewerId);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as RepostBody;
    const postId = body.postId?.trim() ?? "";

    if (!postId || !isUuid(postId)) {
      return NextResponse.json({ error: "Valid postId is required." }, { status: 400 });
    }

    await validateFeedPost(postId);

    try {
      await supabaseServiceRoleRequest("/rest/v1/post_reposts?on_conflict=post_id,user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          post_id: postId,
          user_id: user.id,
        }),
      });
    } catch (error) {
      if (!isMissingPostRepostsTableError(error)) throw error;
      const state = await applyFallbackRepostAction(user.id, postId, true);
      return NextResponse.json({ success: true, ...state });
    }

    const state = await getRepostState(postId, user.id);
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to repost." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as RepostBody;
    const postId = body.postId?.trim() ?? "";

    if (!postId || !isUuid(postId)) {
      return NextResponse.json({ error: "Valid postId is required." }, { status: 400 });
    }

    try {
      await supabaseServiceRoleRequest(
        `/rest/v1/post_reposts?post_id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );
    } catch (error) {
      if (!isMissingPostRepostsTableError(error)) throw error;
      const state = await applyFallbackRepostAction(user.id, postId, false);
      return NextResponse.json({ success: true, ...state });
    }

    const state = await getRepostState(postId, user.id);
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove repost." },
      { status: 500 },
    );
  }
}
