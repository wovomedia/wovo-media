import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asString, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import {
  addFallbackComment,
  deleteFallbackCommentById,
  isMissingPostCommentsTableError,
  listFallbackComments,
} from "@/lib/wovo-ai/engagement-fallback";

type CommentBody = {
  postId?: string;
  content?: string;
  commentId?: string;
};

type GenerationRow = {
  id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
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

async function loadCommentsFromTable(postId: string) {
  const comments = await supabaseServiceRoleRequest<CommentRow[]>(
    `/rest/v1/post_comments?select=id,post_id,user_id,content,created_at,updated_at&post_id=eq.${encodeURIComponent(postId)}&order=created_at.desc&limit=50`
  );

  const userIds = Array.from(new Set((comments ?? []).map((comment) => comment.user_id)));
  let profileMap = new Map<
    string,
    {
      user_id: string;
      username: string | null;
      full_name: string | null;
    }
  >();

  if (userIds.length > 0) {
    const encodedUserIn = encodeURIComponent(`(${userIds.join(",")})`);
    const profiles = await supabaseServiceRoleRequest<
      Array<{
        user_id: string;
        username: string | null;
        full_name: string | null;
      }>
    >(`/rest/v1/profiles?select=user_id,username,full_name&user_id=in.${encodedUserIn}`);
    profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  }

  return (comments ?? []).map((comment) => {
    const profile = profileMap.get(comment.user_id);
    const username = asString(profile?.username).trim();
    const displayName = asString(profile?.full_name).trim();
    return {
      id: comment.id,
      postId: comment.post_id,
      userId: comment.user_id,
      content: comment.content,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      author: {
        username: username || `brand_${comment.user_id.slice(0, 8)}`,
        displayName: displayName || username || "Wovo Creator",
        avatarUrl: null,
      },
    };
  });
}

async function loadComments(postId: string) {
  try {
    return await loadCommentsFromTable(postId);
  } catch (error) {
    if (!isMissingPostCommentsTableError(error)) throw error;
    return await listFallbackComments(postId);
  }
}

export async function GET(request: Request) {
  try {
    await requireServerUser(request.headers.get("authorization"));
    const url = new URL(request.url);
    const postId = url.searchParams.get("postId")?.trim() ?? "";

    if (!postId || !isUuid(postId)) {
      return NextResponse.json({ error: "Valid postId is required." }, { status: 400 });
    }

    await validateFeedPost(postId);
    const comments = await loadComments(postId);
    return NextResponse.json({ comments });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load comments." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as CommentBody;
    const postId = body.postId?.trim() ?? "";
    const content = body.content?.trim() ?? "";

    if (!postId || !isUuid(postId)) {
      return NextResponse.json({ error: "Valid postId is required." }, { status: 400 });
    }
    if (!content || content.length > 500) {
      return NextResponse.json({ error: "Comment must be between 1 and 500 characters." }, { status: 400 });
    }

    await validateFeedPost(postId);

    try {
      await supabaseServiceRoleRequest("/rest/v1/post_comments", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          post_id: postId,
          user_id: user.id,
          content,
        }),
      });
    } catch (error) {
      if (!isMissingPostCommentsTableError(error)) throw error;
      const comments = await addFallbackComment(user.id, postId, content);
      return NextResponse.json({ success: true, comments });
    }

    const comments = await loadComments(postId);
    return NextResponse.json({ success: true, comments });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to post comment." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as CommentBody;
    const commentId = body.commentId?.trim() ?? "";

    if (!commentId || !isUuid(commentId)) {
      return NextResponse.json({ error: "Valid commentId is required." }, { status: 400 });
    }

    try {
      const existingRows = await supabaseServiceRoleRequest<Array<{ post_id: string }>>(
        `/rest/v1/post_comments?select=post_id&id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
      );
      const postId = existingRows?.[0]?.post_id;
      if (!postId) {
        return NextResponse.json({ error: "Comment not found." }, { status: 404 });
      }

      await supabaseServiceRoleRequest(
        `/rest/v1/post_comments?id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );

      const comments = await loadComments(postId);
      return NextResponse.json({ success: true, comments });
    } catch (error) {
      if (!isMissingPostCommentsTableError(error)) throw error;
      try {
        const removed = await deleteFallbackCommentById(user.id, commentId);
        return NextResponse.json({ success: true, comments: removed.comments });
      } catch (fallbackError) {
        if (fallbackError instanceof Error && fallbackError.message.toLowerCase().includes("comment not found")) {
          return NextResponse.json({ error: "Comment not found." }, { status: 404 });
        }
        throw fallbackError;
      }
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete comment." },
      { status: 500 },
    );
  }
}
