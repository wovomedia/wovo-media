function getRequiredEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const buildUrl = (path: string) => `${getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL")}${path}`;

export const supabaseAdmin = {
  async query<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const supabaseServiceRoleKey = getRequiredEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

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
