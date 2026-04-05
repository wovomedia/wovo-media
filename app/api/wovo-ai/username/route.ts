import { NextResponse } from "next/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const usernameRaw = url.searchParams.get("username");
    const username = normalizeUsername(usernameRaw);

    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const rows = await supabaseServiceRoleRequest<Array<{ user_id: string }>>(
      `/rest/v1/profiles?select=user_id&username=eq.${encodeURIComponent(username)}&limit=1`,
    );

    return NextResponse.json({
      username,
      available: (rows?.length ?? 0) === 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check username availability." },
      { status: 500 },
    );
  }
}
