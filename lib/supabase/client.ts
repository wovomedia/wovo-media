export type Session = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type AuthUser = { id: string; email?: string };
type QueryResult<T> = { data: T | null; error: Error | null };
type AuthResult<T> = { data: T; error: Error | null };
type OAuthProvider = "google";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let currentAccessToken: string | null = null;
let currentSession: Session | null = null;
const PKCE_KEY = "wovo-supabase-pkce-code-verifier";
// An OAuth round trip should never outlive this. Keeps a stale verifier from
// lingering if the user abandons the Google consent screen.
const PKCE_MAX_AGE_SECONDS = 600;

/**
 * localStorage is origin-scoped, so a verifier written on www.wovomedia.com is
 * invisible to wovomedia.com (and vice versa). Since both hosts serve the site,
 * an OAuth round trip that starts on one and returns on the other loses the
 * verifier and the code exchange fails. A cookie scoped to the registrable
 * domain is readable from both hosts, so the verifier survives the hop.
 *
 * Returns null on localhost and *.vercel.app previews — those get a host-only
 * cookie instead. (.vercel.app is a public suffix and browsers reject it.)
 */
function pkceCookieDomain(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === "wovomedia.com" || host.endsWith(".wovomedia.com")) return ".wovomedia.com";
  return null;
}

function writeCodeVerifier(verifier: string): void {
  try {
    localStorage.setItem(PKCE_KEY, verifier);
  } catch {
    // Private browsing can throw on write. The cookie below is the real path.
  }
  if (typeof document === "undefined") return;
  const domain = pkceCookieDomain();
  // SameSite=Lax is required, not optional: the OAuth return is a top-level
  // cross-site GET navigation, which Lax permits and Strict would block.
  const attributes = [
    `${PKCE_KEY}=${encodeURIComponent(verifier)}`,
    `Max-Age=${PKCE_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (window.location.protocol === "https:") attributes.push("Secure");
  if (domain) attributes.push(`Domain=${domain}`);
  document.cookie = attributes.join("; ");
}

function readCodeVerifier(): string | null {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp(`(?:^|; )${PKCE_KEY}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }
  try {
    return localStorage.getItem(PKCE_KEY);
  } catch {
    return null;
  }
}

function clearCodeVerifier(): void {
  try {
    localStorage.removeItem(PKCE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
  if (typeof document === "undefined") return;
  const domain = pkceCookieDomain();
  const attributes = [`${PKCE_KEY}=`, "Max-Age=0", "Path=/", "SameSite=Lax"];
  if (domain) attributes.push(`Domain=${domain}`);
  document.cookie = attributes.join("; ");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateCodeVerifier(): string {
  const r = new Uint8Array(32);
  crypto.getRandomValues(r);
  return toBase64Url(r);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(digest));
}

function defaultHeaders(): Headers {
  const h = new Headers();
  h.set("apikey", supabaseAnonKey);
  h.set("Content-Type", "application/json");
  if (currentAccessToken) h.set("Authorization", `Bearer ${currentAccessToken}`);
  return h;
}

/**
 * Carries the HTTP status next to the message. Session recovery has to tell a
 * rejected refresh token apart from a network blip: the first means the person
 * is signed out, the second means try again shortly.
 */
export class SupabaseRequestError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
  }
}

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = defaultHeaders();
  if (init?.headers) {
    const merge = new Headers(init.headers);
    merge.forEach((v, k) => headers.set(k, v));
  }
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}${path}`, { ...init, headers, cache: "no-store" });
  } catch (cause) {
    // Offline, DNS failure, a laptop waking up. Status stays null so callers
    // keep the stored session rather than signing the person out.
    throw new SupabaseRequestError(
      cause instanceof Error ? cause.message : "Network request failed",
      null,
    );
  }
  const text = await response.text();
  const json = text ? (JSON.parse(text) as T & { msg?: string; error_description?: string }) : null;
  if (!response.ok) {
    throw new SupabaseRequestError(
      (json as { msg?: string } | null)?.msg ??
      (json as { error_description?: string } | null)?.error_description ??
      `Supabase request failed (${response.status}).`,
      response.status,
    );
  }
  return json as T;
}

class QueryBuilder<T extends Record<string, unknown>> {
  constructor(private table: string, private columns = "*", private filters: string[] = []) {}
  select(columns: string) { return new QueryBuilder<T>(this.table, columns, this.filters); }
  eq(column: string, value: string) {
    return new QueryBuilder<T>(this.table, this.columns, [...this.filters, `${column}=eq.${encodeURIComponent(value)}`]);
  }
  async maybeSingle<R = T>(): Promise<QueryResult<R>> {
    try {
      const params = [`select=${this.columns}`, ...this.filters, "limit=1"];
      const data = await supabaseFetch<R[]>(`/rest/v1/${this.table}?${params.join("&")}`);
      return { data: data[0] ?? null, error: null };
    } catch (e) { return { data: null, error: e instanceof Error ? e : new Error("Query failed") }; }
  }
  async upsert(payload: Partial<T>): Promise<QueryResult<null>> {
    try {
      await supabaseFetch(`/rest/v1/${this.table}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload),
      });
      return { data: null, error: null };
    } catch (e) { return { data: null, error: e instanceof Error ? e : new Error("Upsert failed") }; }
  }
}

export const supabase = {
  setAccessToken(token: string | null) {
    currentAccessToken = token;
    currentSession = token ? { access_token: token } : null;
  },
  auth: {
    async getSession(): Promise<AuthResult<{ session: Session | null }>> {
      return { data: { session: currentSession }, error: null };
    },
    async signOut(): Promise<AuthResult<{ success: boolean }>> {
      try {
        if (currentAccessToken) {
          await supabaseFetch<null>("/auth/v1/logout?scope=local", { method: "POST" });
        }
        return { data: { success: true }, error: null };
      } catch (e) {
        return { data: { success: false }, error: e instanceof Error ? e : new Error("Unable to revoke session") };
      } finally {
        currentAccessToken = null;
        currentSession = null;
      }
    },
    async getUser(accessToken?: string): Promise<AuthResult<{ user: AuthUser | null }>> {
      try {
        const h = defaultHeaders();
        if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
        const user = await supabaseFetch<AuthUser>("/auth/v1/user", { headers: h });
        return { data: { user }, error: null };
      } catch (e) { return { data: { user: null }, error: e instanceof Error ? e : new Error("Unable to load user") }; }
    },
    async signUp(payload: { email: string; password: string; options?: { emailRedirectTo?: string } }): Promise<AuthResult<Record<string, unknown>>> {
      try {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: payload.email, password: payload.password, options: payload.options?.emailRedirectTo ? { email_redirect_to: payload.options.emailRedirectTo } : undefined }),
        });
        const data = await response.json() as Record<string, unknown> & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to create account.");
        return { data, error: null };
      } catch (e) { return { data: {}, error: e instanceof Error ? e : new Error("Unable to sign up") }; }
    },
    async signInWithPassword(payload: { email: string; password: string }): Promise<AuthResult<{ session: Session | null }>> {
      try {
        const data = await supabaseFetch<{ access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }>("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify(payload) });
        const session: Session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, token_type: data.token_type };
        currentAccessToken = session.access_token; currentSession = session;
        return { data: { session }, error: null };
      } catch (e) { return { data: { session: null }, error: e instanceof Error ? e : new Error("Unable to sign in") }; }
    },
    async refreshSession(refreshToken: string): Promise<AuthResult<{ session: Session | null }>> {
      try {
        const data = await supabaseFetch<{ access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }>(
          "/auth/v1/token?grant_type=refresh_token",
          { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }
        );
        const session: Session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? refreshToken,
          expires_in: data.expires_in,
          token_type: data.token_type,
        };
        currentAccessToken = session.access_token;
        currentSession = session;
        return { data: { session }, error: null };
      } catch (e) {
        return { data: { session: null }, error: e instanceof Error ? e : new Error("Unable to refresh session") };
      }
    },
    async resetPasswordForEmail(email: string, redirectTo: string): Promise<AuthResult<{ success: boolean }>> {
      try {
        const response = await fetch("/api/auth/recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, redirectTo }),
        });
        if (!response.ok) throw new Error("Unable to send reset email");
        return { data: { success: true }, error: null };
      } catch (e) {
        return { data: { success: false }, error: e instanceof Error ? e : new Error("Unable to send reset email") };
      }
    },
    async signInWithOAuth(args: { provider: OAuthProvider; options: { redirectTo: string } }): Promise<AuthResult<{ url: string | null }>> {
      const codeVerifier = generateCodeVerifier();
      writeCodeVerifier(codeVerifier);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      try {
        const query = new URLSearchParams({ provider: args.provider, redirect_to: args.options.redirectTo, code_challenge: codeChallenge, code_challenge_method: "S256" }).toString();
        const data = await supabaseFetch<{ url?: string }>(`/auth/v1/authorize?${query}`, { method: "GET" });
        return { data: { url: data.url ?? null }, error: null };
      } catch {
        return { data: { url: `${supabaseUrl}/auth/v1/authorize?provider=${args.provider}&redirect_to=${encodeURIComponent(args.options.redirectTo)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256` }, error: null };
      }
    },
    async exchangeCodeForSession(authCode: string): Promise<AuthResult<{ session: Session | null }>> {
      try {
        const codeVerifier = readCodeVerifier();
        if (!codeVerifier) throw new Error("Missing PKCE code verifier.");
        const data = await supabaseFetch<{ access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }>("/auth/v1/token?grant_type=pkce", { method: "POST", body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }) });
        const session: Session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, token_type: data.token_type };
        currentAccessToken = session.access_token; currentSession = session;
        clearCodeVerifier();
        return { data: { session }, error: null };
      } catch (e) {
        // A failed exchange leaves a verifier that can never succeed. Drop it so
        // the next attempt starts clean rather than reusing a dead value.
        clearCodeVerifier();
        return { data: { session: null }, error: e instanceof Error ? e : new Error("Unable to exchange auth code") };
      }
    },
  },
  from<T extends Record<string, unknown>>(table: string) { return new QueryBuilder<T>(table); },
};

export function createClient() { return supabase; }
