import "server-only";

import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import type { SocialConnectionRecord, SocialConnectionStatus, SocialProvider } from "@/lib/publishing/types";

export type SocialOAuthState = {
  id: string;
  state_hash: string;
  workspace_id: string | null;
  owner_scope: boolean;
  user_id: string;
  provider: SocialProvider;
  redirect_uri: string;
  expires_at: string;
  used_at: string | null;
};

export async function createSocialOAuthState(input: Omit<SocialOAuthState, "id" | "used_at">) {
  await supabaseServiceRoleRequest("/rest/v1/wovo_social_oauth_states", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(input),
  });
}

export async function consumeSocialOAuthState(stateHash: string, provider: SocialProvider) {
  const row = await supabaseServiceRoleRequest<SocialOAuthState>(
    "/rest/v1/rpc/wovo_social_consume_oauth_state",
    { method: "POST", body: JSON.stringify({ p_state_hash: stateHash, p_provider: provider }) },
  );
  if (!row) throw new Error("OAUTH_STATE_INVALID_OR_EXPIRED");
  return row;
}

export async function loadSocialConnection(id: string) {
  const rows = await supabaseServiceRoleRequest<SocialConnectionRecord[]>(
    `/rest/v1/wovo_social_connections?select=*&id=eq.${encodeURIComponent(id)}&disconnected_at=is.null&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function listSocialConnections(options: { workspaceId?: string; ownerScope?: boolean }) {
  const filter = options.ownerScope
    ? "owner_scope=eq.true&workspace_id=is.null"
    : `owner_scope=eq.false&workspace_id=eq.${encodeURIComponent(options.workspaceId ?? "")}`;
  return await supabaseServiceRoleRequest<SocialConnectionRecord[]>(
    `/rest/v1/wovo_social_connections?select=*&${filter}&disconnected_at=is.null&order=provider.asc,provider_account_name.asc&limit=200`,
  ) ?? [];
}

export async function upsertSocialConnection(input: Omit<SocialConnectionRecord, "id"> & { created_by: string }) {
  const rows = await supabaseServiceRoleRequest<SocialConnectionRecord[]>(
    "/rest/v1/wovo_social_connections?on_conflict=workspace_id,owner_scope,provider,provider_account_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
    },
  );
  if (!rows?.[0]) throw new Error("SOCIAL_CONNECTION_SAVE_FAILED");
  return rows[0];
}

export async function updateSocialConnection(
  id: string,
  patch: Partial<SocialConnectionRecord> & { status?: SocialConnectionStatus },
) {
  const rows = await supabaseServiceRoleRequest<SocialConnectionRecord[]>(
    `/rest/v1/wovo_social_connections?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  );
  if (!rows?.[0]) throw new Error("SOCIAL_CONNECTION_UPDATE_FAILED");
  return rows[0];
}
