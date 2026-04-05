import type { Session } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";

export const STORAGE_KEY = "wovo-supabase-session";

export function parseSessionFromHash(hash: string): Session | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  return { access_token: accessToken, refresh_token: params.get("refresh_token") ?? undefined };
}

export function readSessionFromStorage(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch { return null; }
}

export function persistSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  supabase.setAccessToken(session.access_token);
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  supabase.setAccessToken(null);
}
