import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

type ChatRow = {
  id: string;
  title: string;
  created_at: string;
};

function encodeChatId(chatId: string) {
  return encodeURIComponent(chatId);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const { chatId } = await params;
    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim() ?? "";

    if (!title || title.length > 60) {
      return NextResponse.json({ error: "Title must be between 1 and 60 characters." }, { status: 400 });
    }

    const rows = await supabaseServiceRoleRequest<ChatRow[]>(
      `/rest/v1/chats?id=eq.${encodeChatId(chatId)}&user_id=eq.${user.id}&select=id,title,created_at`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ title }),
      },
    );

    if (!rows?.[0]) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    return NextResponse.json({ chat: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to rename chat." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const { chatId } = await params;

    await supabaseServiceRoleRequest<null>(`/rest/v1/messages?chat_id=eq.${encodeChatId(chatId)}&user_id=eq.${user.id}`, {
      method: "DELETE",
    });

    await supabaseServiceRoleRequest<null>(`/rest/v1/chats?id=eq.${encodeChatId(chatId)}&user_id=eq.${user.id}`, {
      method: "DELETE",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete chat." }, { status: 500 });
  }
}
