import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { businessToContext, normalizeBusinessProfile, parseBusinessProfilesFromGoal, seedBusinessFromContext, serializeBusinessProfilesToGoal, type BusinessProfile } from "@/lib/wovo-ai/business-profiles";
import { ensureProfileForUser } from "@/lib/wovo-ai/profile-bootstrap";

type ProfileBusinessRow = {
  user_id: string;
  goal: string | null;
  business_name: string | null;
  business_type: string | null;
  location: string | null;
  contact: string | null;
};

type CreateBusinessBody = {
  name?: string;
  businessType?: string;
  location?: string;
  serviceLocation?: string;
  phoneNumber?: string;
  email?: string;
  logoUrl?: string;
  businessDescription?: string;
  setActive?: boolean;
};

type UpdateBusinessBody = {
  id?: string;
  activeBusinessId?: string;
  name?: string;
  businessType?: string;
  location?: string;
  serviceLocation?: string;
  phoneNumber?: string;
  email?: string;
  logoUrl?: string;
  businessDescription?: string;
};

type DeleteBusinessBody = {
  id?: string;
};

const PROFILE_SELECT_CANDIDATES = [
  "user_id,goal,business_name,business_type,location,contact",
  "user_id,goal,business_name,business_type,location",
  "user_id,goal,business_name,location",
  "user_id,goal",
  "user_id,business_name,business_type,location,contact",
  "user_id,business_name,business_type,location",
  "user_id,business_name,location",
  "user_id",
];

function isMissingProfileColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column profiles.") && message.includes("does not exist")) ||
    (message.includes("could not find the") && message.includes("column") && message.includes("profiles") && message.includes("schema cache"))
  );
}

function shouldRetryProfileQuery(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return isMissingProfileColumnError(error) || (message.includes("permission denied") && message.includes("profiles"));
}

async function getProfileRow(userId: string): Promise<ProfileBusinessRow | null> {
  let lastError: unknown = null;
  for (const select of PROFILE_SELECT_CANDIDATES) {
    try {
      const rows = await supabaseServiceRoleRequest<ProfileBusinessRow[]>(
        `/rest/v1/profiles?select=${select}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      return rows?.[0] ?? null;
    } catch (error) {
      lastError = error;
      if (shouldRetryProfileQuery(error)) continue;
      throw error;
    }
  }
  if (lastError && !shouldRetryProfileQuery(lastError)) throw lastError;
  return null;
}

function withLegacySeed(profile: ProfileBusinessRow | null): {
  businesses: BusinessProfile[];
  activeBusinessId: string | null;
  legacyGoal: string | null;
  didSeed: boolean;
} {
  const parsed = parseBusinessProfilesFromGoal(profile?.goal);
  if (parsed.businesses.length > 0) {
    return { ...parsed, didSeed: false };
  }

  const seeded = seedBusinessFromContext({
    businessName: profile?.business_name ?? "",
    location: profile?.location ?? "",
    serviceLocation: "",
    phoneNumber: profile?.contact ?? "",
    email: "",
    logoUrl: "",
    businessDescription: "",
  });

  if (!seeded) {
    return { ...parsed, didSeed: false };
  }

  const seededWithType = normalizeBusinessProfile({
    ...seeded,
    businessType: profile?.business_type ?? "",
  });

  return {
    businesses: [seededWithType],
    activeBusinessId: seededWithType.id,
    legacyGoal: parsed.legacyGoal,
    didSeed: true,
  };
}

async function persistBusinesses(params: {
  userId: string;
  businesses: BusinessProfile[];
  activeBusinessId: string | null;
  legacyGoal: string | null;
}): Promise<void> {
  const activeBusiness = params.businesses.find((item) => item.id === params.activeBusinessId) ?? null;
  const activeContext = businessToContext(activeBusiness);
  const serializedGoal = serializeBusinessProfilesToGoal({
    businesses: params.businesses,
    activeBusinessId: activeBusiness?.id ?? null,
    legacyGoal: params.legacyGoal,
  });

  const corePatch = {
    updated_at: new Date().toISOString(),
  };
  const writeCandidates: Array<Record<string, unknown>> = [
    {
      ...corePatch,
      goal: serializedGoal,
      business_name: activeContext.businessName || null,
      business_type: activeBusiness?.businessType || null,
      location: activeContext.location || null,
      contact: activeContext.phoneNumber || null,
    },
    {
      ...corePatch,
      goal: serializedGoal,
      business_name: activeContext.businessName || null,
      business_type: activeBusiness?.businessType || null,
      location: activeContext.location || null,
    },
    {
      ...corePatch,
      goal: serializedGoal,
      business_name: activeContext.businessName || null,
      location: activeContext.location || null,
    },
    {
      ...corePatch,
      business_name: activeContext.businessName || null,
      business_type: activeBusiness?.businessType || null,
      location: activeContext.location || null,
      contact: activeContext.phoneNumber || null,
    },
    {
      ...corePatch,
      business_name: activeContext.businessName || null,
      location: activeContext.location || null,
    },
    {
      ...corePatch,
      goal: serializedGoal,
    },
    corePatch,
  ];

  let lastWriteError: unknown = null;
  for (const candidate of writeCandidates) {
    try {
      await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(params.userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(candidate),
      });
      return;
    } catch (error) {
      lastWriteError = error;
      if (shouldRetryProfileQuery(error) || isMissingProfileColumnError(error)) {
        continue;
      }
      throw error;
    }
  }

  if (lastWriteError) {
    throw lastWriteError;
  }
}

function responsePayload(params: {
  businesses: BusinessProfile[];
  activeBusinessId: string | null;
}): { businesses: BusinessProfile[]; activeBusinessId: string | null } {
  const businesses = params.businesses
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const activeBusinessId =
    params.activeBusinessId && businesses.some((business) => business.id === params.activeBusinessId)
      ? params.activeBusinessId
      : businesses[0]?.id ?? null;

  return { businesses, activeBusinessId };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    await ensureProfileForUser(user);

    const profile = await getProfileRow(user.id);
    const state = withLegacySeed(profile);
    if (state.didSeed) {
      await persistBusinesses({
        userId: user.id,
        businesses: state.businesses,
        activeBusinessId: state.activeBusinessId,
        legacyGoal: state.legacyGoal,
      });
    }

    return NextResponse.json(responsePayload(state));
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load businesses." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    await ensureProfileForUser(user);
    const body = (await request.json().catch(() => ({}))) as CreateBusinessBody;

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    }

    const profile = await getProfileRow(user.id);
    const state = withLegacySeed(profile);
    const created = normalizeBusinessProfile({
      name,
      businessType: body.businessType ?? "",
      location: body.location ?? "",
      serviceLocation: body.serviceLocation ?? "",
      phoneNumber: body.phoneNumber ?? "",
      email: body.email ?? "",
      logoUrl: body.logoUrl ?? "",
      businessDescription: body.businessDescription ?? "",
    });

    const businesses = [created, ...state.businesses].slice(0, 50);
    const activeBusinessId = body.setActive === false ? state.activeBusinessId ?? created.id : created.id;

    await persistBusinesses({
      userId: user.id,
      businesses,
      activeBusinessId,
      legacyGoal: state.legacyGoal,
    });

    return NextResponse.json(responsePayload({ businesses, activeBusinessId }));
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create business profile." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    await ensureProfileForUser(user);
    const body = (await request.json().catch(() => ({}))) as UpdateBusinessBody;

    const profile = await getProfileRow(user.id);
    const state = withLegacySeed(profile);
    const nextBusinesses = state.businesses.slice();
    let nextActiveBusinessId = state.activeBusinessId;

    const activeBusinessId = (body.activeBusinessId ?? "").trim();
    if (activeBusinessId) {
      if (!nextBusinesses.some((item) => item.id === activeBusinessId)) {
        return NextResponse.json({ error: "Selected business was not found." }, { status: 404 });
      }
      nextActiveBusinessId = activeBusinessId;
    }

    const businessId = (body.id ?? "").trim();
    if (businessId) {
      const index = nextBusinesses.findIndex((item) => item.id === businessId);
      if (index < 0) {
        return NextResponse.json({ error: "Business profile not found." }, { status: 404 });
      }

      const current = nextBusinesses[index];
      const next = normalizeBusinessProfile({
        ...current,
        id: current.id,
        name: typeof body.name === "string" ? body.name : current.name,
        businessType: typeof body.businessType === "string" ? body.businessType : current.businessType,
        location: typeof body.location === "string" ? body.location : current.location,
        serviceLocation: typeof body.serviceLocation === "string" ? body.serviceLocation : current.serviceLocation,
        phoneNumber: typeof body.phoneNumber === "string" ? body.phoneNumber : current.phoneNumber,
        email: typeof body.email === "string" ? body.email : current.email,
        logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : current.logoUrl,
        businessDescription: typeof body.businessDescription === "string" ? body.businessDescription : current.businessDescription,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });

      if (!next.name) {
        return NextResponse.json({ error: "Business name cannot be empty." }, { status: 400 });
      }

      nextBusinesses[index] = next;
      if (!nextActiveBusinessId) {
        nextActiveBusinessId = next.id;
      }
    }

    if (!businessId && !activeBusinessId) {
      return NextResponse.json({ error: "No update payload provided." }, { status: 400 });
    }

    await persistBusinesses({
      userId: user.id,
      businesses: nextBusinesses,
      activeBusinessId: nextActiveBusinessId,
      legacyGoal: state.legacyGoal,
    });

    return NextResponse.json(responsePayload({ businesses: nextBusinesses, activeBusinessId: nextActiveBusinessId }));
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update business profile." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    await ensureProfileForUser(user);
    const body = (await request.json().catch(() => ({}))) as DeleteBusinessBody;
    const targetId = (body.id ?? "").trim();
    if (!targetId) {
      return NextResponse.json({ error: "Business id is required." }, { status: 400 });
    }

    const profile = await getProfileRow(user.id);
    const state = withLegacySeed(profile);
    const businesses = state.businesses.filter((item) => item.id !== targetId);
    if (businesses.length === state.businesses.length) {
      return NextResponse.json({ error: "Business profile not found." }, { status: 404 });
    }

    const activeBusinessId = state.activeBusinessId === targetId ? businesses[0]?.id ?? null : state.activeBusinessId;

    await persistBusinesses({
      userId: user.id,
      businesses,
      activeBusinessId,
      legacyGoal: state.legacyGoal,
    });

    return NextResponse.json(responsePayload({ businesses, activeBusinessId }));
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete business profile." },
      { status: 500 },
    );
  }
}
