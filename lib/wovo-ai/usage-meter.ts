import "server-only";

import { randomUUID } from "node:crypto";
import { assertPortalAccountAccess, type PortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import {
  estimateWovoAiCost,
  getWovoAiRuntimeState,
  type WovoAiFeature,
  type WovoAiMode,
} from "@/lib/wovo-ai/model-metering";

type UsageReservation = {
  id: string;
  account_id: string;
  status: "reserved" | "completed" | "failed" | "released";
  estimated_units: number;
  estimated_provider_cost_micros: number;
};

export async function reserveWovoAiUsage(input: {
  context: PortalContext;
  accountId: string;
  feature: WovoAiFeature;
  mode: WovoAiMode;
  inputCharacters: number;
  confirmed: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ reservation: UsageReservation; estimate: ReturnType<typeof estimateWovoAiCost> }> {
  await assertPortalAccountAccess(input.context, input.accountId);
  const runtime = getWovoAiRuntimeState();
  if (input.feature === "code" ? !runtime.codeReady : !runtime.aiReady) {
    throw new Error(`${input.feature === "code" ? "WOVO Code" : "WOVO AI"} is not enabled.`);
  }
  const estimate = estimateWovoAiCost(input);
  if (estimate.requiresConfirmation && !input.confirmed) {
    throw new Error(`Confirm this ${estimate.units}-unit request before continuing.`);
  }
  const idempotencyKey = input.idempotencyKey?.trim() || `ai-${randomUUID()}`;
  const rows = await supabaseServiceRoleRequest<UsageReservation[]>("/rest/v1/rpc/wovo_ai_reserve_usage", {
    method: "POST",
    body: JSON.stringify({
      p_account_id: input.accountId,
      p_actor_user_id: input.context.user.id,
      p_feature: input.feature,
      p_mode: input.mode,
      p_estimated_units: estimate.units,
      p_estimated_provider_cost_micros: estimate.estimatedProviderCostMicros,
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        ...input.metadata,
        confirmed: input.confirmed,
        defaultClientModeLabel: input.mode,
      },
    }),
  });
  const reservation = rows?.[0];
  if (!reservation) throw new Error("Unable to reserve AI usage.");
  return { reservation, estimate };
}
export async function finalizeWovoAiUsage(input: {
  reservationId: string;
  actualUnits: number;
  actualProviderCostMicros: number;
  providerRequestId?: string;
}): Promise<UsageReservation> {
  const rows = await supabaseServiceRoleRequest<UsageReservation[]>("/rest/v1/rpc/wovo_ai_finalize_usage", {
    method: "POST",
    body: JSON.stringify({
      p_request_id: input.reservationId,
      p_actual_units: input.actualUnits,
      p_actual_provider_cost_micros: input.actualProviderCostMicros,
      p_provider_request_id: input.providerRequestId ?? null,
    }),
  });
  if (!rows?.[0]) throw new Error("Unable to finalize AI usage.");
  return rows[0];
}

export async function releaseWovoAiUsage(reservationId: string, errorCode = "provider_failed"): Promise<UsageReservation> {
  const rows = await supabaseServiceRoleRequest<UsageReservation[]>("/rest/v1/rpc/wovo_ai_release_usage", {
    method: "POST",
    body: JSON.stringify({ p_request_id: reservationId, p_error_code: errorCode }),
  });
  if (!rows?.[0]) throw new Error("Unable to release AI usage.");
  return rows[0];
}
