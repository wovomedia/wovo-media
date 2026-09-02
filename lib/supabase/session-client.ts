import type { Session } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";
import { accessTokenExpired, isDefinitiveAuthFailure } from "@/lib/supabase/session-recovery";

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

// Refresh a minute early so a request never races its own token expiry.
const REFRESH_BUFFER_MS = 60_000;

async function refreshStoredSession(refreshToken: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession(refreshToken);
  if (data.session) {
    persistSession(data.session);
    return data.session;
  }

  // Supabase refresh tokens are single use. If another tab rotated the token
  // while this request was in flight, the loser of that race is rejected even
  // though the person is still perfectly signed in.
  const current = readSessionFromStorage();
  if (current?.refresh_token && current.refresh_token !== refreshToken) {
    supabase.setAccessToken(current.access_token);
    return current;
  }

  if (isDefinitiveAuthFailure(error)) {
    clearSession();
    return null;
  }

  // Transient failure: offline, a timeout, a 5xx. Keep the stored session so a
  // later call can recover, and keep using the current token if it has not
  // actually expired yet.
  if (current && !accessTokenExpired(current.access_token, 0)) {
    supabase.setAccessToken(current.access_token);
    return current;
  }
  return null;
}

export async function getActiveSession(): Promise<Session | null> {
  const stored = readSessionFromStorage();
  if (!stored) return null;
  if (!accessTokenExpired(stored.access_token, REFRESH_BUFFER_MS)) {
    supabase.setAccessToken(stored.access_token);
    return stored;
  }
  if (!stored.refresh_token) {
    clearSession();
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = refreshStoredSession(stored.refresh_token).finally(() => {
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
