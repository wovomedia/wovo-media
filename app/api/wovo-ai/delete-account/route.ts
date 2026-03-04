import { NextResponse } from "next/server";
import { deleteAuthUserById, requireServerUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    await deleteAuthUserById(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
