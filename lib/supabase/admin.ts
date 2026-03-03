const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const buildUrl = (path: string) => `${supabaseUrl}${path}`;

export const supabaseAdmin = {
  async query<T = unknown>(path: string, init?: RequestInit): Promise<T> {
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
