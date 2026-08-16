import type { Session } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";

export const STORAGE_KEY = "wovo-supabase-session";
let refreshPromise: Promise<Session | null> | null = null;

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

function accessTokenExpiresSoon(accessToken: string): boolean {
  try {
    const segment = accessToken.split(".")[1];
    const padding = "=".repeat((4 - segment.length % 4) % 4);
    const payload = JSON.parse(atob((segment + padding).replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return !payload.exp || payload.exp * 1000 <= Date.now() + 60_000;
  } catch {
    return true;
  }
}

export async function getActiveSession(): Promise<Session | null> {
  const stored = readSessionFromStorage();
  if (!stored) return null;
  if (!accessTokenExpiresSoon(stored.access_token)) {
    supabase.setAccessToken(stored.access_token);
    return stored;
  }
  if (!stored.refresh_token) {
    clearSession();
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession(stored.refresh_token)
      .then(({ data, error }) => {
        if (error || !data.session) {
          clearSession();
          return null;
        }
        persistSession(data.session);
        return data.session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function signOutAndClear(): Promise<void> {
  try {
    const stored = readSessionFromStorage();
    supabase.setAccessToken(stored?.access_token ?? null);
    await supabase.auth.signOut();
  } finally {
    clearSession();
  }
}
