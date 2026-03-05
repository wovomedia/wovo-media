type PendingOnboarding = {
  full_name: string;
  username: string;
  age: number;
  gender: "boy" | "girl" | "other";
};

const PENDING_ONBOARDING_KEY = "wovo-pending-onboarding";

export function storePendingOnboarding(payload: PendingOnboarding) {
  localStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(payload));
}

export function clearPendingOnboarding() {
  localStorage.removeItem(PENDING_ONBOARDING_KEY);
}

function readPendingOnboarding(): PendingOnboarding | null {
  const raw = localStorage.getItem(PENDING_ONBOARDING_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingOnboarding;
  } catch {
    clearPendingOnboarding();
    return null;
  }
}

export async function submitPendingOnboarding(accessToken: string): Promise<boolean> {
  const pending = readPendingOnboarding();
  if (!pending) return false;

  const response = await fetch("/api/wovo-ai/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(pending),
  });

  if (!response.ok) return false;
  clearPendingOnboarding();
  return true;
}

