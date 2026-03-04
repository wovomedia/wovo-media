import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

type OnboardingBody = { full_name?: string; username?: string; age?: number; gender?: "boy" | "girl" | "other" };

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const rows = await supabaseServiceRoleRequest<Array<{ full_name: string | null; username: string | null; age: number | null; gender: string | null }>>(
      `/rest/v1/profiles?select=full_name,username,age,gender&user_id=eq.${user.id}&limit=1`,
    );
    const profile = rows?.[0] ?? null;
    const complete = Boolean(profile?.full_name && profile?.username && profile?.age && profile?.gender);
    return NextResponse.json({ profile, complete });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load onboarding." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as OnboardingBody;
    const full_name = body.full_name?.trim();
    const username = body.username?.trim().toLowerCase();
    const age = Number(body.age);
    const gender = body.gender;

    if (!full_name || !username || !Number.isFinite(age) || age < 13 || !["boy", "girl", "other"].includes(gender ?? "")) {
      return NextResponse.json({ error: "Provide valid full_name, username, age (13+), and gender." }, { status: 400 });
    }

    await supabaseServiceRoleRequest("/rest/v1/profiles?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, full_name, username, age, gender, updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save onboarding." }, { status: 500 });
  }
}
