import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import { appendAdminNotification, resolveAdminRecipientIds, appendAdminActionLog } from "@/lib/admin/audit-log";

type ReportBody = {
  postId?: string;
  reason?: string;
};

type GenerationRow = {
  id: string;
  user_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as ReportBody;
    const postId = body.postId?.trim() ?? "";
    const reason = (body.reason ?? "").trim().slice(0, 400);

    if (!postId || !isUuid(postId)) {
      return NextResponse.json({ error: "Valid postId is required." }, { status: 400 });
    }

    const rows = await supabaseServiceRoleRequest<GenerationRow[]>(
      `/rest/v1/generations?select=id,user_id,input,output,created_at&id=eq.${encodeURIComponent(postId)}&limit=1`
    );
    const post = rows?.[0];
    if (!post || !isEligibleFeedPost(post)) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const output = asRecord(post.output);
    const extra = asRecord(output.extra);

    const adminRecipientIds = await resolveAdminRecipientIds();
    await appendAdminNotification({
      type: "feed_post_flagged",
      payload: {
        post_id: post.id,
        post_owner_user_id: post.user_id,
        reported_by_user_id: user.id,
        reported_by_email: user.email ?? null,
        reason: reason || null,
        generated_at: post.created_at,
        module: typeof asRecord(post.input).module === "string" ? asRecord(post.input).module : null,
        brand_name: typeof extra.brandName === "string" ? extra.brandName : null,
      },
      notifyAdminUserIds: adminRecipientIds,
    });

    if (adminRecipientIds[0]) {
      await appendAdminActionLog({
        adminUserId: adminRecipientIds[0],
        action: "flag_feed_post",
        targetUserId: post.user_id,
        metadata: {
          post_id: post.id,
          reported_by_user_id: user.id,
          reported_by_email: user.email ?? null,
          reason: reason || null,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to report post." },
      { status: 500 },
    );
  }
}

