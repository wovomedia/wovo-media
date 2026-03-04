function getRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getSupabaseUrl() {
  return getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
}

function getSupabaseAnonKey() {
  return getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
  const accessToken = getBearerToken(authHeader);

  if (!accessToken) {
    throw new Error("Missing bearer token.");
  }

  const headers = new Headers();
  headers.set("apikey", getSupabaseAnonKey());
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
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
  const serviceRoleKey = getRequiredEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

  const headers = new Headers();
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);

  const response = await fetch(`${getSupabaseUrl()}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to delete user account.");
  }
}

function mergeHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers();

  if (initHeaders) {
    const normalizedHeaders = new Headers(initHeaders);
    normalizedHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

export async function supabaseRestRequest<T = unknown>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T | null> {
  const headers = mergeHeaders(init?.headers);
  headers.set("apikey", getSupabaseAnonKey());
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Supabase request failed (${response.status}).`);
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
}

export async function supabaseServiceRoleRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const serviceRoleKey = getRequiredEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

  const headers = mergeHeaders(init?.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Supabase service-role request failed (${response.status}).`);
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
}

export async function updateAuthEmail(accessToken: string, email: string) {
  const headers = new Headers();
  headers.set("apikey", getSupabaseAnonKey());
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ email }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to update email.");
  }
}

export async function updateAuthPassword(accessToken: string, password: string) {
  const headers = new Headers();
  headers.set("apikey", getSupabaseAnonKey());
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to update password.");
  }
}
