export const WOVO_POLICY_VERSION = "2026-03-24.1";

const POLICY_ACCEPTED_KEY = "wovo_policy_accepted";
const POLICY_VERSION_KEY = "wovo_policy_version_accepted";
const POLICY_ACCEPTED_AT_KEY = "wovo_policy_accepted_at";

type UserMetadataLike = Record<string, unknown> | null | undefined;

export type PolicyConsentState = {
  accepted: boolean;
  requiredVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
};

function toMetadataRecord(userMetadata: UserMetadataLike): Record<string, unknown> {
  if (!userMetadata || Array.isArray(userMetadata)) return {};
  return userMetadata;
}

function readStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function readBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

export function getPolicyConsentState(userMetadata: UserMetadataLike): PolicyConsentState {
  const metadata = toMetadataRecord(userMetadata);
  const acceptedFlag = readBooleanValue(metadata[POLICY_ACCEPTED_KEY]);
  const acceptedVersion = readStringValue(metadata[POLICY_VERSION_KEY]);
  const acceptedAt = readStringValue(metadata[POLICY_ACCEPTED_AT_KEY]);
  const accepted = acceptedFlag && acceptedVersion === WOVO_POLICY_VERSION && Boolean(acceptedAt);

  return {
    accepted,
    requiredVersion: WOVO_POLICY_VERSION,
    acceptedVersion,
    acceptedAt,
  };
}

export function hasAcceptedRequiredPolicy(userMetadata: UserMetadataLike): boolean {
  return getPolicyConsentState(userMetadata).accepted;
}

export function buildAcceptedPolicyMetadata(
  currentMetadata: UserMetadataLike,
  acceptedAt = new Date().toISOString(),
): Record<string, unknown> {
  const metadata = toMetadataRecord(currentMetadata);
  return {
    ...metadata,
    [POLICY_ACCEPTED_KEY]: true,
    [POLICY_VERSION_KEY]: WOVO_POLICY_VERSION,
    [POLICY_ACCEPTED_AT_KEY]: acceptedAt,
  };
}

export function sanitizeInternalNextPath(rawNextPath: string | null | undefined, fallbackPath = "/wovo-ai"): string {
  if (!rawNextPath) return fallbackPath;

  const decoded = (() => {
    try {
      return decodeURIComponent(rawNextPath);
    } catch {
      return rawNextPath;
    }
  })();

  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return fallbackPath;
  }

  return decoded;
}
