import { getAuthAdminUserById, listAuthAdminUsers, supabaseServiceRoleRequest } from "@/lib/supabase/server";

export type AdminTargetUser = {
  id: string;
  email: string | null;
};

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

async function findByUserId(userId: string): Promise<AdminTargetUser | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return null;

  const authUser = await getAuthAdminUserById(normalizedUserId).catch(() => null);
  if (authUser?.id) {
    return {
      id: authUser.id,
      email: normalizeEmail(authUser.email) || null,
    };
  }

  const userRows = await supabaseServiceRoleRequest<Array<{ id: string; email: string | null }>>(
    `/rest/v1/users?select=id,email&id=eq.${encodeURIComponent(normalizedUserId)}&limit=1`,
  ).catch(() => null);
  if (userRows?.[0]?.id) {
    return {
      id: userRows[0].id,
      email: normalizeEmail(userRows[0].email) || null,
    };
  }

  const profileRows = await supabaseServiceRoleRequest<Array<{ user_id: string; email: string | null }>>(
    `/rest/v1/profiles?select=user_id,email&user_id=eq.${encodeURIComponent(normalizedUserId)}&limit=1`,
  ).catch(() => null);
  if (profileRows?.[0]?.user_id) {
    return {
      id: profileRows[0].user_id,
      email: normalizeEmail(profileRows[0].email) || null,
    };
  }

  return null;
}

async function findByEmail(email: string): Promise<AdminTargetUser | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const authUsers = await listAuthAdminUsers({ page: 1, perPage: 500 }).catch(() => []);
  const authMatch = authUsers.find((user) => normalizeEmail(user.email) === normalizedEmail);
  if (authMatch?.id) {
    return {
      id: authMatch.id,
      email: normalizeEmail(authMatch.email) || normalizedEmail,
    };
  }

  const userRows = await supabaseServiceRoleRequest<Array<{ id: string; email: string | null }>>(
    `/rest/v1/users?select=id,email&email=ilike.${encodeURIComponent(normalizedEmail)}&limit=1`,
  ).catch(() => null);
  if (userRows?.[0]?.id) {
    return {
      id: userRows[0].id,
      email: normalizeEmail(userRows[0].email) || normalizedEmail,
    };
  }

  const profileRows = await supabaseServiceRoleRequest<Array<{ user_id: string; email: string | null }>>(
    `/rest/v1/profiles?select=user_id,email&email=ilike.${encodeURIComponent(normalizedEmail)}&limit=1`,
  ).catch(() => null);
  if (profileRows?.[0]?.user_id) {
    return {
      id: profileRows[0].user_id,
      email: normalizeEmail(profileRows[0].email) || normalizedEmail,
    };
  }

  return null;
}

export async function resolveAdminTargetUser(input: { userId?: string | null; email?: string | null }): Promise<AdminTargetUser | null> {
  if (input.userId?.trim()) {
    return await findByUserId(input.userId);
  }
  if (input.email?.trim()) {
    return await findByEmail(input.email);
  }
  return null;
}
