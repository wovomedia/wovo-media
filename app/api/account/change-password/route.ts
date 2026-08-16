import { NextResponse } from "next/server";
import { requireServerUser, updateAuthPassword } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { accessToken } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim();
    if (!password || password.length < 10 || password.length > 128) {
      return NextResponse.json({ error: "Use a password between 10 and 128 characters." }, { status: 400 });
    }
    await updateAuthPassword(accessToken, password);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "The recovery session is invalid or expired. Request a new link." }, { status: 401 });
  }
}
