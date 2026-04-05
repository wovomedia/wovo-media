import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminProEmail } from "@/lib/wovo-ai/admin";

export function isAutoProEmail(email?: string | null): boolean { return isAdminProEmail(email); }

type Row = { plan: string | null; monthly_limit: number | null; subscription_current_period_start: string | null; subscription_current_period_end: string | null };

function addMonthIso(from: string): string { const d = new Date(from); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString(); }

export async function applyAutoProEntitlements(userId: string, email?: string | null): Promise<boolean> {
  if (!isAutoProEmail(email)) return false;
  const rows = await supabaseServiceRoleRequest<Row[]>(`/rest/v1/profiles?select=plan,monthly_limit,subscription_current_period_start,subscription_current_period_end&user_id=eq.${userId}&limit=1`);
  const p = rows?.[0] ?? null;
  const now = new Date().toISOString();
  if ((p?.plan ?? "none") === "pro" && (p?.monthly_limit ?? 0) === 300 && p?.subscription_current_period_start) return true;
  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ plan: "pro", monthly_limit: 300, subscription_current_period_start: p?.subscription_current_period_start ?? now, subscription_current_period_end: p?.subscription_current_period_end ?? addMonthIso(now), updated_at: now }),
  });
  return true;
}
