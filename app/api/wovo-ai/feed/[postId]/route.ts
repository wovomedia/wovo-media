import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord } from "@/lib/wovo-ai/feed-utils";

type GenerationRow = {
  id: string;
  output: Record<string, unknown>;
};

export async function DELETE(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const { postId } = await context.params;
    const normalizedPostId = postId.trim();

    if (!normalizedPostId) {
      return NextResponse.json({ error: "postId is required." }, { status: 400 });
    }

    const rows = await supabaseServiceRoleRequest<GenerationRow[]>(
      `/rest/v1/generations?select=id,output&id=eq.${encodeURIComponent(normalizedPostId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
    );
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const output = asRecord(row.output);
    const extra = asRecord(output.extra);
    const distribution = asRecord(extra.distribution);

    await supabaseServiceRoleRequest(
      `/rest/v1/generations?id=eq.${encodeURIComponent(normalizedPostId)}&user_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          output: {
            ...output,
            extra: {
              ...extra,
              distribution: {
                ...distribution,
                shareToFeed: false,
                removedAt: new Date().toISOString(),
              },
            },
          },
        }),
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove post from feed." },
      { status: 500 },
    );
  }
}
