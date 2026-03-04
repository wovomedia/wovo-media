import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const status = await getSubscriptionStatus(user.id);

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
