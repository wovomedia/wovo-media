import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

type MessageRow = { id: string; role: "user" | "assistant"; content: string; created_at: string };
function enc(s: string) { return encodeURIComponent(s); }

export async function GET(request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const { chatId } = await params;
    const chatRows = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/chats?select=id&id=eq.${enc(chatId)}&user_id=eq.${user.id}&limit=1`);
    if (!chatRows?.[0]) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    const messages = await supabaseServiceRoleRequest<MessageRow[]>(`/rest/v1/messages?select=id,role,content,created_at&chat_id=eq.${enc(chatId)}&user_id=eq.${user.id}&order=created_at.asc`);
    return NextResponse.json({ messages: messages ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load messages." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const { chatId } = await params;
    const chatRows = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/chats?select=id&id=eq.${enc(chatId)}&user_id=eq.${user.id}&limit=1`);
    if (!chatRows?.[0]) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    const body = (await request.json()) as { role?: string; content?: string };
    const role = body.role === "assistant" ? "assistant" : "user";
    const content = body.content?.trim() ?? "";
    if (!content) return NextResponse.json({ error: "Message content is required." }, { status: 400 });
    const rows = await supabaseServiceRoleRequest<MessageRow[]>("/rest/v1/messages?select=id,role,content,created_at", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ chat_id: chatId, user_id: user.id, role, content }),
    });
    return NextResponse.json({ message: rows?.[0] ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save message." }, { status: 500 });
  }
}
