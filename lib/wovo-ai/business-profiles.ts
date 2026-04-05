import { type BusinessContext, EMPTY_BUSINESS_CONTEXT, normalizeBusinessContext } from "@/lib/wovo-ai/business-context";

export type BusinessProfile = {
  id: string;
  name: string;
  businessType: string;
  location: string;
  serviceLocation: string;
  phoneNumber: string;
  email: string;
  logoUrl: string;
  businessDescription: string;
  createdAt: string;
  updatedAt: string;
};

type BusinessProfilesBlob = {
  businesses: BusinessProfile[];
  activeBusinessId: string | null;
  legacyGoal?: string | null;
  updatedAt?: string;
};

const PROFILE_BLOB_PREFIX = "WOVO_BUSINESSES_V1::";

function cleanText(value: unknown, maxLen: number): string {
  return (typeof value === "string" ? value.trim() : "").slice(0, maxLen);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceIso(value: unknown, fallback: string): string {
  const text = cleanText(value, 80);
  if (!text) return fallback;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function newBusinessId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `biz_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function normalizeBusinessProfile(input: Partial<BusinessProfile> & { id?: string }): BusinessProfile {
  const now = new Date().toISOString();
  const id = cleanText(input.id, 80) || newBusinessId();
  const createdAt = coerceIso(input.createdAt, now);
  const updatedAt = coerceIso(input.updatedAt, now);
  return {
    id,
    name: cleanText(input.name, 80),
    businessType: cleanText(input.businessType, 80),
    location: cleanText(input.location, 120),
    serviceLocation: cleanText(input.serviceLocation, 120),
    phoneNumber: cleanText(input.phoneNumber, 40),
    email: cleanText(input.email, 120),
    logoUrl: cleanText(input.logoUrl, 220_000),
    businessDescription: cleanText(input.businessDescription, 500),
    createdAt,
    updatedAt,
  };
}

export function seedBusinessFromContext(input?: Partial<BusinessContext> | null): BusinessProfile | null {
  const ctx = normalizeBusinessContext(input);
  if (!ctx.businessName && !ctx.location && !ctx.phoneNumber && !ctx.serviceLocation && !ctx.email && !ctx.logoUrl && !ctx.businessDescription) {
    return null;
  }

  return normalizeBusinessProfile({
    name: ctx.businessName || "My Business",
    businessType: "",
    location: ctx.location,
    serviceLocation: ctx.serviceLocation,
    phoneNumber: ctx.phoneNumber,
    email: ctx.email,
    logoUrl: ctx.logoUrl,
    businessDescription: ctx.businessDescription,
  });
}

export function businessToContext(business: BusinessProfile | null | undefined): BusinessContext {
  if (!business) return EMPTY_BUSINESS_CONTEXT;
  return normalizeBusinessContext({
    businessName: business.name,
    location: business.location,
    serviceLocation: business.serviceLocation,
    phoneNumber: business.phoneNumber,
    email: business.email,
    logoUrl: business.logoUrl,
    businessDescription: business.businessDescription,
  });
}

export function parseBusinessProfilesFromGoal(goalValue: string | null | undefined): {
  businesses: BusinessProfile[];
  activeBusinessId: string | null;
  legacyGoal: string | null;
} {
  const raw = cleanText(goalValue, 700_000);
  if (!raw) {
    return {
      businesses: [],
      activeBusinessId: null,
      legacyGoal: null,
    };
  }

  if (!raw.startsWith(PROFILE_BLOB_PREFIX)) {
    return {
      businesses: [],
      activeBusinessId: null,
      legacyGoal: raw,
    };
  }

  const payload = raw.slice(PROFILE_BLOB_PREFIX.length);
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isRecord(parsed)) {
      return { businesses: [], activeBusinessId: null, legacyGoal: null };
    }

    const rawBusinesses = Array.isArray(parsed.businesses) ? parsed.businesses : [];
    const businesses = rawBusinesses
      .map((item) => (isRecord(item) ? normalizeBusinessProfile(item as Partial<BusinessProfile>) : null))
      .filter((item): item is BusinessProfile => {
        if (!item) return false;
        return Boolean(item.name);
      });

    const requestedActiveId = cleanText(parsed.activeBusinessId, 80) || null;
    const activeBusinessId = requestedActiveId && businesses.some((item) => item.id === requestedActiveId)
      ? requestedActiveId
      : businesses[0]?.id ?? null;

    return {
      businesses,
      activeBusinessId,
      legacyGoal: cleanText(parsed.legacyGoal, 1_000) || null,
    };
  } catch {
    return {
      businesses: [],
      activeBusinessId: null,
      legacyGoal: null,
    };
  }
}

export function serializeBusinessProfilesToGoal(input: {
  businesses: BusinessProfile[];
  activeBusinessId: string | null;
  legacyGoal?: string | null;
}): string {
  const normalizedBusinesses = input.businesses
    .map((item) => normalizeBusinessProfile(item))
    .filter((item) => Boolean(item.name))
    .slice(0, 50);

  const activeBusinessId =
    cleanText(input.activeBusinessId, 80) && normalizedBusinesses.some((item) => item.id === input.activeBusinessId)
      ? input.activeBusinessId
      : normalizedBusinesses[0]?.id ?? null;

  const payload: BusinessProfilesBlob = {
    businesses: normalizedBusinesses,
    activeBusinessId,
    legacyGoal: cleanText(input.legacyGoal, 1_000) || null,
    updatedAt: new Date().toISOString(),
  };

  return `${PROFILE_BLOB_PREFIX}${JSON.stringify(payload)}`;
}
