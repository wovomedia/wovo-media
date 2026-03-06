import { NextResponse } from "next/server";
import { isGoogleAuthUser, requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/wovo-ai/profile-bootstrap";

type OnboardingBody = { full_name?: string; username?: string; age?: number; gender?: "boy" | "girl" | "other" };

type OnboardingProfileRow = {
  full_name: string | null;
  username: string | null;
  age: number | null;
  gender: string | null;
  email: string | null;
};

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    console.info("[onboarding] Session verified", { userId: user.id });
    await ensureProfileForUser(user);

    const rows = await supabaseServiceRoleRequest<OnboardingProfileRow[]>(
      `/rest/v1/profiles?select=full_name,username,age,gender,email&user_id=eq.${user.id}&limit=1`,
    );
    const profile = rows?.[0] ?? null;
    const isGoogleUser = isGoogleAuthUser(user);

    if (isGoogleUser) {
      const refreshedRows = await supabaseServiceRoleRequest<OnboardingProfileRow[]>(
        `/rest/v1/profiles?select=full_name,username,age,gender,email&user_id=eq.${user.id}&limit=1`,
      );
      console.info("[onboarding] Google user allowed to skip manual onboarding", { userId: user.id });
      return NextResponse.json({ profile: refreshedRows?.[0] ?? profile, complete: true, is_google_user: true });
    }

    const complete = Boolean(profile?.full_name && profile?.username && profile?.age && profile?.gender);
    return NextResponse.json({ profile, complete, is_google_user: false });
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
