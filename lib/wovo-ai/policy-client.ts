import { sanitizeInternalNextPath, WOVO_POLICY_VERSION } from "@/lib/wovo-ai/policy";

export type PolicyConsentResponse = {
  accepted: boolean;
  required_version?: string;
  accepted_version?: string | null;
  accepted_at?: string | null;
};

export function buildPolicyConsentPath(nextPath?: string | null): string {
  const safeNextPath = sanitizeInternalNextPath(nextPath, "/wovo-ai");
  return `/wovo-ai/policy-consent?next=${encodeURIComponent(safeNextPath)}`;
}

export async function fetchPolicyConsentStatus(accessToken: string): Promise<PolicyConsentResponse | null> {
  const response = await fetch("/api/account/policy-consent", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as PolicyConsentResponse | null;
}

export function hasAcceptedCurrentPolicy(status: PolicyConsentResponse | null): boolean {
  if (!status?.accepted) return false;
  const requiredVersion = status.required_version?.trim() || WOVO_POLICY_VERSION;
  const acceptedVersion = status.accepted_version?.trim() || "";
  return acceptedVersion === requiredVersion;
}
