import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import {
  createFallbackThreadForUsers,
  isMissingDmTablesError,
  listFallbackBlockedUsersByViewer,
  listFallbackThreadsForUser,
} from "@/lib/wovo-ai/dm-fallback";

type ThreadRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

type DmMessageRow = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  content: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  full_name?: string | null;
};

type ThreadListItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  blockedByViewer: boolean;
  participant: {
    userId: string;
    username: string;
    displayName: string;
  };
  lastMessage: {
    id: string;
    senderUserId: string;
    content: string;
    createdAt: string;
  } | null;
};

type CreateThreadBody = {
  targetUserId?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sortPair(a: string, b: string): [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

function toSafeUsername(raw: string | null | undefined, fallbackSeed: string): string {
  try {
    const normalized = normalizeUsername(raw ?? "");
    if (normalized) return normalized;
  } catch {
    // ignore invalid legacy usernames
  }
  return `brand_${fallbackSeed.slice(0, 8)}`;
}

async function getOrCreateThread(currentUserId: string, targetUserId: string): Promise<ThreadRow> {
  const [userA, userB] = sortPair(currentUserId, targetUserId);
  const existingRows = await supabaseServiceRoleRequest<ThreadRow[]>(
    `/rest/v1/dm_threads?select=id,user_a,user_b,created_at,updated_at,last_message_at&user_a=eq.${encodeURIComponent(userA)}&user_b=eq.${encodeURIComponent(userB)}&limit=1`,
  );
  const existing = existingRows?.[0];
  if (existing) return existing;

  const insertedRows = await supabaseServiceRoleRequest<ThreadRow[]>(
    "/rest/v1/dm_threads?select=id,user_a,user_b,created_at,updated_at,last_message_at&on_conflict=user_a,user_b",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_a: userA,
        user_b: userB,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  const inserted = insertedRows?.[0];
  if (inserted) return inserted;

  const refetchedRows = await supabaseServiceRoleRequest<ThreadRow[]>(
    `/rest/v1/dm_threads?select=id,user_a,user_b,created_at,updated_at,last_message_at&user_a=eq.${encodeURIComponent(userA)}&user_b=eq.${encodeURIComponent(userB)}&limit=1`,
  );
  const refetched = refetchedRows?.[0];
  if (!refetched) {
    throw new Error("Unable to create DM thread.");
  }
  return refetched;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const encodedUserId = encodeURIComponent(user.id);

    let threads: ThreadRow[] | null = null;
    try {
      threads = await supabaseServiceRoleRequest<ThreadRow[]>(
        `/rest/v1/dm_threads?select=id,user_a,user_b,created_at,updated_at,last_message_at&or=(user_a.eq.${encodedUserId},user_b.eq.${encodedUserId})&order=last_message_at.desc.nullslast&order=updated_at.desc`,
      );
    } catch (error) {
      if (isMissingDmTablesError(error)) {
        const fallbackThreads = await listFallbackThreadsForUser(user.id);
        const blockedUsers = await listFallbackBlockedUsersByViewer(
          user.id,
          fallbackThreads.map((thread) => thread.participant.userId),
        );
        return NextResponse.json({
          threads: fallbackThreads.map((thread) => ({
            ...thread,
            blockedByViewer: blockedUsers.has(thread.participant.userId),
          })),
        });
      }
      throw error;
    }

    if (!threads?.length) {
      return NextResponse.json({ threads: [] });
    }

    const otherUserIds = Array.from(
      new Set(
        threads.map((thread) => (thread.user_a === user.id ? thread.user_b : thread.user_a)).filter(Boolean),
      ),
    );
    const threadIds = threads.map((thread) => thread.id);

    const encodedUserIn = encodeURIComponent(`(${otherUserIds.join(",")})`);
    const encodedThreadIn = encodeURIComponent(`(${threadIds.join(",")})`);

    const [profileRows, messageRows, blockRows] = await Promise.all([
      supabaseServiceRoleRequest<ProfileRow[]>(
        `/rest/v1/profiles?select=user_id,username,full_name&user_id=in.${encodedUserIn}`,
      ).catch(() => []),
      supabaseServiceRoleRequest<DmMessageRow[]>(
        `/rest/v1/dm_messages?select=id,thread_id,sender_user_id,content,created_at&thread_id=in.${encodedThreadIn}&order=created_at.desc&limit=500`,
      ).catch(() => []),
      supabaseServiceRoleRequest<Array<{ blocked_user_id: string }>>(
        `/rest/v1/dm_blocks?select=blocked_user_id&blocker_user_id=eq.${encodedUserId}&blocked_user_id=in.${encodedUserIn}`,
      ).catch((error) => {
        if (isMissingDmTablesError(error)) return null;
        throw error;
      }),
    ]);

    const blockedByViewerSet =
      blockRows === null
        ? await listFallbackBlockedUsersByViewer(user.id, otherUserIds)
        : new Set((blockRows ?? []).map((row) => row.blocked_user_id));

    const profileMap = new Map((profileRows ?? []).map((row) => [row.user_id, row]));
    const lastMessageByThread = new Map<string, DmMessageRow>();
    for (const message of messageRows ?? []) {
      if (!lastMessageByThread.has(message.thread_id)) {
        lastMessageByThread.set(message.thread_id, message);
      }
    }

    const list: ThreadListItem[] = threads.map((thread) => {
      const otherUserId = thread.user_a === user.id ? thread.user_b : thread.user_a;
      const profile = profileMap.get(otherUserId);
      const username = toSafeUsername(profile?.username, otherUserId);
      const displayName = (profile?.full_name ?? "").trim() || `@${username}`;
      const lastMessage = lastMessageByThread.get(thread.id);
      return {
        id: thread.id,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        lastMessageAt: thread.last_message_at,
        blockedByViewer: blockedByViewerSet.has(otherUserId),
        participant: {
          userId: otherUserId,
          username,
          displayName,
        },
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              senderUserId: lastMessage.sender_user_id,
              content: lastMessage.content,
              createdAt: lastMessage.created_at,
            }
          : null,
      };
    });

    return NextResponse.json({ threads: list });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load DM threads." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as CreateThreadBody;
    const targetUserId = (body.targetUserId ?? "").trim();
    if (!targetUserId || !isUuid(targetUserId)) {
      return NextResponse.json({ error: "Valid targetUserId is required." }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot DM yourself." }, { status: 400 });
    }

    try {
      const thread = await getOrCreateThread(user.id, targetUserId);
      const profileRows = await supabaseServiceRoleRequest<ProfileRow[]>(
        `/rest/v1/profiles?select=user_id,username,full_name&user_id=eq.${encodeURIComponent(targetUserId)}&limit=1`,
      ).catch(() => []);
      const profile = profileRows?.[0];
      const username = toSafeUsername(profile?.username, targetUserId);
      const displayName = (profile?.full_name ?? "").trim() || `@${username}`;

      return NextResponse.json({
        thread: {
          id: thread.id,
          createdAt: thread.created_at,
          updatedAt: thread.updated_at,
          lastMessageAt: thread.last_message_at,
          blockedByViewer: false,
          participant: {
            userId: targetUserId,
            username,
            displayName,
          },
          lastMessage: null,
        } satisfies ThreadListItem,
      });
    } catch (error) {
      if (!isMissingDmTablesError(error)) throw error;
      const fallbackThread = await createFallbackThreadForUsers(user.id, targetUserId);
      return NextResponse.json({
        thread: {
          ...fallbackThread,
          blockedByViewer: false,
        },
      });
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create DM thread." },
      { status: 500 },
    );
  }
}
