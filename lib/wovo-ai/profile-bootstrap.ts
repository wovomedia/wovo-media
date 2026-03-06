import type { AuthUser } from "@/lib/supabase/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export async function ensureProfileForUser(user: AuthUser): Promise<void> {
  const fullName = user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim() || null;
  const avatarUrl = user.user_metadata?.avatar_url?.trim() || user.user_metadata?.picture?.trim() || null;

  await supabaseServiceRoleRequest("/rest/v1/profiles?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      avatar_url: avatarUrl,
      plan: "none",
      monthly_limit: 0,
      monthly_used: 0,
      extra_credits: 0,
      updated_at: new Date().toISOString(),
    }),
  });
}
