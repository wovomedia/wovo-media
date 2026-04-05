import { NextResponse } from "next/server";
import { asRecord, asString, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isPaidStatus } from "@/lib/wovo-ai/plans";

type BoostBody = {
  postId?: string;
};

type GenerationRow = {
  id: string;
  user_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
};

type BoostMetadata = {
  userId: string;
  multiplier: number;
  boostedAt: string;
  activeUntil: string;
};

const BOOST_MULTIPLIER = 1.5;
const BOOST_COOLDOWN_DAYS = 3;
const BOOST_COOLDOWN_MS = BOOST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseBoostMetadata(output: Record<string, unknown>): BoostMetadata | null {
  const outputRecord = asRecord(output);
  const extra = asRecord(outputRecord.extra);
  const distribution = asRecord(extra.distribution);
  const boost = asRecord(distribution.boost);

  const userId = asString(boost.userId).trim();
  const boostedAt = asString(boost.boostedAt).trim();
  const activeUntil = asString(boost.activeUntil).trim();
  const multiplierValue = Number(boost.multiplier ?? boost.boostMultiplier ?? 1);
  const multiplier = Number.isFinite(multiplierValue) ? multiplierValue : 1;

  if (!userId || !boostedAt || !activeUntil || multiplier <= 1) return null;

  return {
    userId,
    multiplier,
    boostedAt,
    activeUntil,
  };
}

async function isVerifiedUser(userId: string): Promise<boolean> {
  const rows = await supabaseServiceRoleRequest<
    Array<{ status: string | null; badge_active: boolean | null; cancel_at_period_end: boolean | null }>
  >(
    `/rest/v1/verified_subscriptions?select=status,badge_active,cancel_at_period_end&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  ).catch(() => []);
  const row = rows?.[0];
  if (!row) return false;
  return Boolean(row.badge_active) || (isPaidStatus(row.status) && !Boolean(row.cancel_at_period_end));
}

async function validateOwnFeedPost(postId: string, userId: string): Promise<GenerationRow> {
  const rows = await supabaseServiceRoleRequest<GenerationRow[]>(
    `/rest/v1/generations?select=id,user_id,input,output,created_at&id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const post = rows?.[0];
  if (!post || !isEligibleFeedPost(post)) {
    throw new Error("Post must be your own public Wovo feed post.");
  }
  return post;
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    let body: BoostBody = {};
    const rawBody = await request.text();
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as BoostBody;
      } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      }
    }

    const postId = body.postId?.trim() ?? "";
    if (!postId || !isUuid(postId)) {
      return NextResponse.json({ error: "Valid postId is required." }, { status: 400 });
    }

    const verified = await isVerifiedUser(user.id);
    if (!verified) {
      return NextResponse.json({ error: "Only verified users can boost posts." }, { status: 403 });
    }

    const post = await validateOwnFeedPost(postId, user.id);

    const recentRows = await supabaseServiceRoleRequest<Array<{ id: string; output: Record<string, unknown>; created_at: string }>>(
      `/rest/v1/generations?select=id,output,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=260`,
    );

    let latestBoostPostId: string | null = null;
    let latestBoostAtMs = Number.NaN;
    let latestBoostActiveUntil: string | null = null;
    let latestBoostMultiplier = BOOST_MULTIPLIER;

    for (const row of recentRows ?? []) {
      const boost = parseBoostMetadata(row.output);
      if (!boost || boost.userId !== user.id) continue;
      const boostedAtMs = Date.parse(boost.boostedAt);
      if (Number.isNaN(boostedAtMs)) continue;
      if (Number.isNaN(latestBoostAtMs) || boostedAtMs > latestBoostAtMs) {
        latestBoostAtMs = boostedAtMs;
        latestBoostPostId = row.id;
        latestBoostActiveUntil = boost.activeUntil;
        latestBoostMultiplier = boost.multiplier;
      }
    }

    const nowMs = Date.now();
    const cooldownEndsAt = Number.isNaN(latestBoostAtMs) ? null : new Date(latestBoostAtMs + BOOST_COOLDOWN_MS).toISOString();
    const cooldownActive = Boolean(cooldownEndsAt && nowMs < Date.parse(cooldownEndsAt));

    if (cooldownActive && latestBoostPostId && latestBoostPostId !== postId) {
      return NextResponse.json(
        {
          error: `You can boost 1 post every ${BOOST_COOLDOWN_DAYS} days.`,
          cooldownEndsAt,
          activePostId: latestBoostPostId,
        },
        { status: 429 },
      );
    }

    if (cooldownActive && latestBoostPostId === postId) {
      return NextResponse.json({
        success: true,
        postId,
        boostMultiplier: latestBoostMultiplier,
        activeUntil: latestBoostActiveUntil ?? cooldownEndsAt,
        cooldownEndsAt,
        canBoost: false,
      });
    }

    const nowIso = new Date(nowMs).toISOString();
    const activeUntil = new Date(nowMs + BOOST_COOLDOWN_MS).toISOString();
    const outputRecord = asRecord(post.output);
    const extra = asRecord(outputRecord.extra);
    const distribution = asRecord(extra.distribution);

    const nextOutput = {
      ...outputRecord,
      extra: {
        ...extra,
        distribution: {
          ...distribution,
          boost: {
            userId: user.id,
            multiplier: BOOST_MULTIPLIER,
            boostedAt: nowIso,
            activeUntil,
          },
          updatedAt: nowIso,
        },
      },
    };

    await supabaseServiceRoleRequest(
      `/rest/v1/generations?id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          output: nextOutput,
        }),
      },
    );

    return NextResponse.json({
      success: true,
      postId,
      boostMultiplier: BOOST_MULTIPLIER,
      activeUntil,
      cooldownEndsAt: activeUntil,
      canBoost: false,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to boost post." },
      { status: 500 },
    );
  }
}

