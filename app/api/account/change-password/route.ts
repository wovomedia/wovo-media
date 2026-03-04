import { NextResponse } from "next/server";
import { requireServerUser, updateAuthPassword } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { accessToken } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim();
    if (!password || password.length < 6) return NextResponse.json({ error: "Password too short" }, { status: 400 });
    await updateAuthPassword(accessToken, password);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
