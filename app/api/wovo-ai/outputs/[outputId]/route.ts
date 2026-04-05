import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isUuid } from "@/lib/wovo-ai/feed-utils";
import { deleteFallbackOutputForUser, isMissingGenerationsTableError } from "@/lib/wovo-ai/output-fallback-store";

type OutputRow = {
  id: string;
};

export async function DELETE(request: Request, context: { params: Promise<{ outputId: string }> }) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const { outputId } = await context.params;
    const normalizedOutputId = outputId.trim();

    if (!normalizedOutputId || !isUuid(normalizedOutputId)) {
      return NextResponse.json({ error: "Valid outputId is required." }, { status: 400 });
    }

    try {
      const existingRows = await supabaseServiceRoleRequest<OutputRow[]>(
        `/rest/v1/generations?select=id&id=eq.${encodeURIComponent(normalizedOutputId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
      );

      if (!existingRows?.[0]) {
        return NextResponse.json({ error: "Output not found." }, { status: 404 });
      }

      await supabaseServiceRoleRequest(
        `/rest/v1/generations?id=eq.${encodeURIComponent(normalizedOutputId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );
    } catch (error) {
      if (!isMissingGenerationsTableError(error)) throw error;
      const deleted = await deleteFallbackOutputForUser({
        userId: user.id,
        outputId: normalizedOutputId,
      });
      if (!deleted) {
        return NextResponse.json({ error: "Output not found." }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete output." },
      { status: 500 },
    );
  }
}
