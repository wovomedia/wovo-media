type PendingOnboarding = { full_name: string; username: string; age: number; gender: "boy" | "girl" | "other" };
const KEY = "wovo-pending-onboarding";

export function storePendingOnboarding(payload: PendingOnboarding) { localStorage.setItem(KEY, JSON.stringify(payload)); }
export function clearPendingOnboarding() { localStorage.removeItem(KEY); }

function readPendingOnboarding(): PendingOnboarding | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as PendingOnboarding; } catch { clearPendingOnboarding(); return null; }
}

export async function submitPendingOnboarding(accessToken: string): Promise<boolean> {
  const pending = readPendingOnboarding();
  if (!pending) return false;
  const r = await fetch("/api/wovo-ai/onboarding", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(pending) });
  if (!r.ok) return false;
  clearPendingOnboarding();
  return true;
}
