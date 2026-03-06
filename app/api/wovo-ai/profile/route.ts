import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest, updateAuthEmail } from "@/lib/supabase/server";

type ProfilePayload = {
  email?: string;
  full_name?: string;
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  topic?: string;
  goal?: string;
  avatar_url?: string;
};

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const rows = await supabaseServiceRoleRequest<ProfilePayload[]>(
      `/rest/v1/profiles?select=email,full_name,business_name,business_type,location,contact,topic,goal,avatar_url&user_id=eq.${user.id}&limit=1`,
    );

    return NextResponse.json(rows?.[0] ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, accessToken } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as ProfilePayload;

    const normalizedEmail = body.email?.trim().toLowerCase() ?? "";

    if (normalizedEmail && normalizedEmail !== (user.email ?? "").toLowerCase()) {
      await updateAuthEmail(accessToken, normalizedEmail);
    }

    await supabaseServiceRoleRequest("/rest/v1/profiles?on_conflict=user_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: user.id,
        email: normalizedEmail || user.email || null,
        full_name: body.full_name?.trim() || null,
        business_name: body.business_name?.trim() || null,
        business_type: body.business_type?.trim() || null,
        location: body.location?.trim() || null,
        contact: body.contact?.trim() || null,
        topic: body.topic?.trim() || null,
        goal: body.goal?.trim() || null,
        avatar_url: body.avatar_url?.trim() || null,
        updated_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
