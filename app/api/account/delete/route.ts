import { NextResponse } from "next/server";
import { deleteAuthUserById, requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${user.id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    await supabaseServiceRoleRequest(`/rest/v1/subscriptions?user_id=eq.${user.id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    await deleteAuthUserById(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
