const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: {
    id: string;
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
      name?: string;
    };
  };
};

type SupabaseAuthErrorPayload = {
  error?: string;
  error_code?: string;
  msg?: string;
  message?: string;
};

const buildUrl = (path: string) => `${supabaseUrl}${path}`;

export const supabaseClient = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  auth: {
    signInWithGoogle(redirectTo: string) {
      const url = new URL(buildUrl("/auth/v1/authorize"));
      url.searchParams.set("provider", "google");
      url.searchParams.set("redirect_to", redirectTo);
      return url.toString();
    },
    async getUser(accessToken: string) {
      const response = await fetch(buildUrl("/auth/v1/user"), {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to fetch authenticated user from Supabase Auth.");
      }

      return response.json();
    },
    async signUpWithPassword(email: string, password: string) {
      const response = await fetch(buildUrl("/auth/v1/signup"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as SupabaseAuthErrorPayload | null;
        throw payload ?? { message: "Unable to create account." };
      }

      return response.json();
    },
    async signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
      const response = await fetch(buildUrl("/auth/v1/token?grant_type=password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as SupabaseAuthErrorPayload | null;
        throw payload ?? { message: "Unable to sign in." };
      }

      return (await response.json()) as SupabaseSession;
    },
    async sendPasswordReset(email: string, redirectTo: string) {
      const response = await fetch(buildUrl("/auth/v1/recover"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email, redirect_to: redirectTo }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as SupabaseAuthErrorPayload | null;
        throw payload ?? { message: "Unable to send password reset email." };
      }
    },
  },
  from(table: string) {
    return {
      async selectByEmail(accessToken: string, email: string) {
        const url = new URL(buildUrl(`/rest/v1/${table}`));
        url.searchParams.set("select", "*");
        url.searchParams.set("email", `eq.${email}`);
        url.searchParams.set("limit", "1");

        const response = await fetch(url.toString(), {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to query ${table} in Supabase.`);
        }

        const rows = (await response.json()) as Record<string, unknown>[];
        return rows[0] ?? null;
      },
    };
  },
};
