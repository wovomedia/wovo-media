import { NextResponse } from "next/server";
import {
  requireServerUser,
  updateAuthUserMetadata,
  updateAuthUserMetadataById,
} from "@/lib/supabase/server";
import {
  buildAcceptedPolicyMetadata,
  getPolicyConsentState,
} from "@/lib/wovo-ai/policy";

type ConsentRequestPayload = {
  accepted?: boolean;
};

function toUnauthorizedResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null;
  if (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function parseJsonPayload(request: Request): Promise<ConsentRequestPayload> {
  const rawBody = await request.text();
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody) as ConsentRequestPayload;
  } catch {
    throw new Error("Invalid request payload.");
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const state = getPolicyConsentState(user.user_metadata ?? null);
    return NextResponse.json({
      accepted: state.accepted,
      required_version: state.requiredVersion,
      accepted_version: state.acceptedVersion,
      accepted_at: state.acceptedAt,
    });
  } catch (error) {
    const unauthorized = toUnauthorizedResponse(error);
    if (unauthorized) return unauthorized;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, accessToken } = await requireServerUser(request.headers.get("authorization"));
    const body = await parseJsonPayload(request);
    if (body.accepted !== true) {
      return NextResponse.json(
        { error: "You must accept the policy agreement to continue." },
        { status: 400 },
      );
    }

    const nextMetadata = buildAcceptedPolicyMetadata(user.user_metadata ?? null);
    try {
      await updateAuthUserMetadata(accessToken, nextMetadata);
    } catch {
      await updateAuthUserMetadataById(user.id, nextMetadata);
    }

    const state = getPolicyConsentState(nextMetadata);
    return NextResponse.json({
      success: true,
      accepted: state.accepted,
      required_version: state.requiredVersion,
      accepted_version: state.acceptedVersion,
      accepted_at: state.acceptedAt,
    });
  } catch (error) {
    const unauthorized = toUnauthorizedResponse(error);
    if (unauthorized) return unauthorized;

    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message === "Invalid request payload." ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
