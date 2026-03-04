const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export type AuthUser = {
  id: string;
  email?: string;
};

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

export async function requireServerUser(authHeader: string | null): Promise<{ user: AuthUser; accessToken: string }> {
  const url = getRequiredEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const accessToken = getBearerToken(authHeader);

  if (!accessToken) {
    throw new Error("Missing bearer token.");
  }

  const headers = new Headers();
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${url}/auth/v1/user`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to verify session.");
  }

  const user = (await response.json()) as AuthUser;
  return { user, accessToken };
}

export async function deleteAuthUserById(userId: string) {
  const url = getRequiredEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to delete user account.");
  }
}

export async function supabaseRestRequest<T = unknown>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T | null> {
  const url = getRequiredEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Supabase request failed (${response.status}).`);
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
}
