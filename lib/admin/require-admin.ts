import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminProEmail, resolveTrustedAuthRole } from "@/lib/wovo-ai/admin";

type AdminUserRow = {
  id: string;
  role: string | null;
};

export async function requireAdminUser(authHeader: string | null) {
  const { user } = await requireServerUser(authHeader);
  const email = user.email?.trim().toLowerCase() ?? "";
  if (resolveTrustedAuthRole(user) === "admin") {
    return user;
  }

  if (isAdminProEmail(email)) {
    return user;
  }

  const rows = await supabaseServiceRoleRequest<AdminUserRow[]>(
    `/rest/v1/users?select=id,role&id=eq.${encodeURIComponent(user.id)}&limit=1`
  ).catch(() => []);

  const role = rows?.[0]?.role?.toLowerCase() ?? "user";
  if (role !== "admin") {
    throw new Error("Forbidden");
  }

  return user;
}
