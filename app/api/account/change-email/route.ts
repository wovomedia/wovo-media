import { NextResponse } from "next/server";
import { requireServerUser, updateAuthEmail } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { accessToken } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    await updateAuthEmail(accessToken, email);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
