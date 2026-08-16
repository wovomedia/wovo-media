function getRequiredEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getSupabaseUrl() { return getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"); }
function getSupabaseAnonKey() { return getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"); }
function getSupabaseServerKey() {
  return getRequiredEnv(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY"
  );
}

function setServerKeyHeaders(headers: Headers, key: string) {
  headers.set("apikey", key);
  // New sb_secret_ keys are opaque, not JWTs, and must not be sent as Bearer tokens.
  if (!key.startsWith("sb_secret_")) headers.set("Authorization", `Bearer ${key}`);
}

export type AuthUser = {
  id: string; email?: string;
  created_at?: string;
  email_confirmed_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[]; role?: string; wovo_portal_role?: string; [key: string]: unknown };
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string; [key: string]: unknown };
  identities?: Array<{ provider?: string }>;
};

export function isGoogleAuthUser(user: AuthUser): boolean {
  if (user.app_metadata?.provider === "google") return true;
  if (user.app_metadata?.providers?.includes("google")) return true;
  return user.identities?.some((i) => i.provider === "google") ?? false;
}

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

export async function requireServerUser(authHeader: string | null): Promise<{ user: AuthUser; accessToken: string }> {
  const accessToken = getBearerToken(authHeader);
  if (!accessToken) throw new Error("Missing bearer token.");
  const headers = new Headers();
  headers.set("apikey", getSupabaseAnonKey());
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, { headers, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to verify session.");
  const user = (await response.json()) as AuthUser;
  return { user, accessToken };
}

export async function deleteAuthUserById(userId: string) {
  const serviceRoleKey = getSupabaseServerKey();
  const headers = new Headers();
  setServerKeyHeaders(headers, serviceRoleKey);
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to delete user account.");
}

function mergeHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers();
  if (initHeaders) { const n = new Headers(initHeaders); n.forEach((v, k) => headers.set(k, v)); }
  return headers;
}

export async function supabaseServiceRoleRequest<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  const serviceRoleKey = getSupabaseServerKey();
  const headers = mergeHeaders(init?.headers);
  setServerKeyHeaders(headers, serviceRoleKey);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${getSupabaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Supabase service-role request failed (${response.status}).`);
  }
  if (response.status === 204) return null;
  const payload = await response.text();
  if (!payload) return null;
  return JSON.parse(payload) as T;
}

export async function supabaseServiceRoleRawRequest(path: string, init?: RequestInit): Promise<Response> {
  const serviceRoleKey = getSupabaseServerKey();
  const headers = mergeHeaders(init?.headers);
  setServerKeyHeaders(headers, serviceRoleKey);
  return fetch(`${getSupabaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

export async function listAuthAdminUsers(options: { page?: number; perPage?: number } = {}): Promise<AuthUser[]> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(1000, Math.max(1, options.perPage ?? 100));
  const response = await supabaseServiceRoleRequest<{ users?: AuthUser[] }>(
    `/auth/v1/admin/users?page=${page}&per_page=${perPage}`
  );
  return response?.users ?? [];
}

export async function getAuthAdminUserById(userId: string): Promise<AuthUser | null> {
  const response = await supabaseServiceRoleRequest<AuthUser>(
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`
  );
  return response ?? null;
}

export async function updateAuthUserById(userId: string, payload: Record<string, unknown>): Promise<AuthUser | null> {
  return supabaseServiceRoleRequest<AuthUser>(
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export async function updateAuthUserMetadata(accessToken: string, metadata: Record<string, unknown>): Promise<void> {
  const headers = new Headers({ apikey: getSupabaseAnonKey(), Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" });
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: metadata }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to update account metadata.");
}

export async function updateAuthUserMetadataById(userId: string, metadata: Record<string, unknown>): Promise<void> {
  await updateAuthUserById(userId, { user_metadata: metadata });
}

export async function updateAuthEmail(accessToken: string, email: string) {
  const headers = new Headers();
  headers.set("apikey", getSupabaseAnonKey());
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, { method: "PUT", headers, body: JSON.stringify({ email }), cache: "no-store" });
  if (!response.ok) { const text = await response.text(); throw new Error(text || "Unable to update email."); }
}

export async function updateAuthPassword(accessToken: string, password: string) {
  const headers = new Headers();
  headers.set("apikey", getSupabaseAnonKey());
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, { method: "PUT", headers, body: JSON.stringify({ password }), cache: "no-store" });
  if (!response.ok) { const text = await response.text(); throw new Error(text || "Unable to update password."); }
}
