import { requireEnvAny } from "@/lib/env";

const buildUrl = (path: string) =>
  `${requireEnvAny(["NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL", "SUPABASE_URL"])}${path}`;

export const supabaseAdmin = {
  async query<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const supabaseServiceRoleKey = requireEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]);

    const response = await fetch(buildUrl(path), {
      ...init,
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Supabase admin request failed for ${path}.`);
    }

    return response.json() as Promise<T>;
  },
};
