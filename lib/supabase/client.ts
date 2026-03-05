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

function defaultHeaders(): Headers {
  const headers = new Headers();
  headers.set("apikey", supabaseAnonKey);
  headers.set("Content-Type", "application/json");
  if (currentAccessToken) {
    headers.set("Authorization", `Bearer ${currentAccessToken}`);
  }
  return headers;
}

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = defaultHeaders();
  if (init?.headers) {
    const merge = new Headers(init.headers);
    merge.forEach((value, key) => headers.set(key, value));
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  const json = text ? (JSON.parse(text) as T & { msg?: string; error_description?: string }) : null;

  if (!response.ok) {
    throw new Error((json as { msg?: string; error_description?: string } | null)?.msg ?? (json as { error_description?: string } | null)?.error_description ?? `Supabase request failed (${response.status}).`);
  }

  return json as T;
}

class QueryBuilder<T extends Record<string, unknown>> {
  constructor(private table: string, private columns = "*", private filters: string[] = []) {}

  select(columns: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.table, columns, this.filters);
  }

  eq(column: string, value: string): QueryBuilder<T> {
    const encoded = encodeURIComponent(value);
    return new QueryBuilder<T>(this.table, this.columns, [...this.filters, `${column}=eq.${encoded}`]);
  }

  async maybeSingle<R = T>(): Promise<QueryResult<R>> {
    try {
      const params = [`select=${this.columns}`, ...this.filters, "limit=1"];
      const data = await supabaseFetch<R[]>(`/rest/v1/${this.table}?${params.join("&")}`);
      return { data: data[0] ?? null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error("Query failed") };
    }
  }

  async upsert(payload: Partial<T>): Promise<QueryResult<null>> {
    try {
      await supabaseFetch(`/rest/v1/${this.table}`, {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(payload),
      });
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error("Upsert failed") };
    }
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
      currentAccessToken = null;
      currentSession = null;
      return { data: { success: true }, error: null };
    },
    async getUser(accessToken?: string): Promise<AuthResult<{ user: AuthUser | null }>> {
      try {
        const headers = defaultHeaders();
        if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
        const user = await supabaseFetch<AuthUser>("/auth/v1/user", { headers });
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: error instanceof Error ? error : new Error("Unable to load user") };
      }
    },
    async signUp(payload: { email: string; password: string; options?: { emailRedirectTo?: string } }): Promise<AuthResult<Record<string, unknown>>> {
      try {
        const data = await supabaseFetch<Record<string, unknown>>("/auth/v1/signup", {
          method: "POST",
          body: JSON.stringify({
            email: payload.email,
            password: payload.password,
            options: payload.options?.emailRedirectTo
              ? { email_redirect_to: payload.options.emailRedirectTo }
              : undefined,
          }),
        });
        return { data, error: null };
      } catch (error) {
        return { data: {}, error: error instanceof Error ? error : new Error("Unable to sign up") };
      }
    },
    async signInWithPassword(payload: { email: string; password: string }): Promise<AuthResult<{ session: Session | null }>> {
      try {
        const data = await supabaseFetch<{ access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }>(
          "/auth/v1/token?grant_type=password",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        const session: Session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          token_type: data.token_type,
        };
        currentAccessToken = session.access_token;
        currentSession = session;
        return { data: { session }, error: null };
      } catch (error) {
        return { data: { session: null }, error: error instanceof Error ? error : new Error("Unable to sign in") };
      }
    },
    async signInWithOAuth(args: { provider: OAuthProvider; options: { redirectTo: string } }): Promise<AuthResult<{ url: string | null }>> {
      try {
        const query = new URLSearchParams({ provider: args.provider, redirect_to: args.options.redirectTo }).toString();
        const data = await supabaseFetch<{ url?: string }>(`/auth/v1/authorize?${query}`, { method: "GET" });
        return { data: { url: data.url ?? null }, error: null };
      } catch {
        const fallbackUrl = `${supabaseUrl}/auth/v1/authorize?provider=${args.provider}&redirect_to=${encodeURIComponent(args.options.redirectTo)}`;
        return { data: { url: fallbackUrl }, error: null };
      }
    },
  },
  from<T extends Record<string, unknown>>(table: string) {
    return new QueryBuilder<T>(table);
  },
};


export function createClient() {
  return supabase;
}
