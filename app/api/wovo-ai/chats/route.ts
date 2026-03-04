import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

type ChatRow = {
  id: string;
  title: string;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const chats = await supabaseServiceRoleRequest<ChatRow[]>(
      `/rest/v1/chats?select=id,title,created_at&user_id=eq.${user.id}&order=created_at.desc`,
    );

    return NextResponse.json({ chats: chats ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load chats." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as { title?: string };
    const rawTitle = body.title?.trim() || "New Chat";

    const rows = await supabaseServiceRoleRequest<ChatRow[]>("/rest/v1/chats?select=id,title,created_at", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: user.id, title: rawTitle.slice(0, 120) }),
    });

    return NextResponse.json({ chat: rows?.[0] ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create chat." }, { status: 500 });
  }
}
