import "server-only";

import { getEnv } from "@/lib/env";
import type { PortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

type UsagePolicyState = {
  enabled: boolean;
  period_end: string;
  monthly_included_units: number;
};

/**
 * Keeps the canonical usage window aligned with WOVO's advertised seven-day
 * allowance. Credit-only workspaces receive no included units, but remain
 * enabled so purchased credits can be spent without a subscription.
 */
export async function ensureWorkspaceUsagePolicy(context: PortalContext, accountId: string) {
  const [existing, subscriptions] = await Promise.all([
    supabaseServiceRoleRequest<UsagePolicyState[]>(
      `/rest/v1/wovo_ai_usage_policies?select=period_end,enabled,monthly_included_units&account_id=eq.${encodeURIComponent(accountId)}&limit=1`,
    ).catch(() => []),
    supabaseServiceRoleRequest<Array<{ status: string }>>(
      `/rest/v1/wovo_portal_subscriptions?select=status&account_id=eq.${encodeURIComponent(accountId)}&status=in.(active,trialing)&limit=1`,
    ).catch(() => []),
  ]);
  const owner = context.mode === "staff" && context.staffRole === "owner";
  const subscribed = Boolean(subscriptions?.[0]);
  const includedUnits = owner ? 100000 : subscribed ? 100 : 0;
  if (
    existing?.[0]?.enabled
    && Date.parse(existing[0].period_end) > Date.now()
    && existing[0].monthly_included_units === includedUnits
  ) return;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await supabaseServiceRoleRequest("/rest/v1/wovo_ai_usage_policies?on_conflict=account_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      account_id: accountId,
      enabled: true,
      plan_key: owner ? "owner_test" : "core",
      daily_unit_limit: owner ? 100000 : 100,
      weekly_unit_limit: owner ? 100000 : 100,
      monthly_included_units: includedUnits,
      requests_per_minute: owner ? 10 : 2,
      monthly_provider_cost_cap_micros: owner ? 100000000 : 3000000,
      provider_ready: Boolean(getEnv("OPENAI_API_KEY") && (getEnv("FAL_KEY") || getEnv("FAL_API_KEY"))),
      moderation_ready: true,
      telemetry_ready: true,
      code_sandbox_ready: false,
      advanced_mode_selection: false,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_by: context.user.id,
      updated_at: now.toISOString(),
    }),
  });
}
