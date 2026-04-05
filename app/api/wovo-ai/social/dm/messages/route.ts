import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import {
  deleteFallbackMessage,
  isFallbackMessagingBlockedBetween,
  isFallbackThreadId,
  isMissingDmTablesError,
  listFallbackMessagesForThread,
  sendFallbackMessage,
} from "@/lib/wovo-ai/dm-fallback";

type ThreadRow = {
  id: string;
  user_a: string;
  user_b: string;
};

type MessageRow = {
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

type DmMessage = {
  id: string;
  threadId: string;
  senderUserId: string;
  content: string;
  createdAt: string;
  sender: {
    username: string;
    displayName: string;
  };
};

type PostBody = {
  threadId?: string;
  content?: string;
  messageId?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toSafeUsername(raw: string | null | undefined, fallbackSeed: string): string {
  try {
    const normalized = normalizeUsername(raw ?? "");
    if (normalized) return normalized;
  } catch {
    // ignore invalid usernames
  }
  return `brand_${fallbackSeed.slice(0, 8)}`;
}

async function ensureParticipantThread(threadId: string, currentUserId: string): Promise<ThreadRow | null> {
  const encodedThreadId = encodeURIComponent(threadId);
  const encodedUserId = encodeURIComponent(currentUserId);
  const rows = await supabaseServiceRoleRequest<ThreadRow[]>(
    `/rest/v1/dm_threads?select=id,user_a,user_b&id=eq.${encodedThreadId}&or=(user_a.eq.${encodedUserId},user_b.eq.${encodedUserId})&limit=1`,
  );
  return rows?.[0] ?? null;
}

async function isMessagingBlockedInTable(userA: string, userB: string): Promise<boolean> {
  const [blockAB, blockBA] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ blocker_user_id: string }>>(
      `/rest/v1/dm_blocks?select=blocker_user_id&blocker_user_id=eq.${encodeURIComponent(userA)}&blocked_user_id=eq.${encodeURIComponent(userB)}&limit=1`,
    ),
    supabaseServiceRoleRequest<Array<{ blocker_user_id: string }>>(
      `/rest/v1/dm_blocks?select=blocker_user_id&blocker_user_id=eq.${encodeURIComponent(userB)}&blocked_user_id=eq.${encodeURIComponent(userA)}&limit=1`,
    ),
  ]);
  return Boolean((blockAB?.length ?? 0) > 0 || (blockBA?.length ?? 0) > 0);
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const url = new URL(request.url);
    const threadId = (url.searchParams.get("threadId") ?? "").trim();
    if (!threadId || (!isUuid(threadId) && !isFallbackThreadId(threadId))) {
      return NextResponse.json({ error: "Valid threadId is required." }, { status: 400 });
    }
    if (isFallbackThreadId(threadId)) {
      const fallbackMessages = await listFallbackMessagesForThread(user.id, threadId);
      return NextResponse.json({ messages: fallbackMessages });
    }

    try {
      const thread = await ensureParticipantThread(threadId, user.id);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      }

      const messageRows = await supabaseServiceRoleRequest<MessageRow[]>(
        `/rest/v1/dm_messages?select=id,thread_id,sender_user_id,content,created_at&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.asc&limit=250`,
      );

      const participantIds = Array.from(new Set((messageRows ?? []).map((row) => row.sender_user_id)));
      const profileMap = new Map<string, ProfileRow>();
      if (participantIds.length > 0) {
        const encodedIn = encodeURIComponent(`(${participantIds.join(",")})`);
        const profileRows = await supabaseServiceRoleRequest<ProfileRow[]>(
          `/rest/v1/profiles?select=user_id,username,full_name&user_id=in.${encodedIn}`,
        ).catch(() => []);
        for (const profile of profileRows ?? []) {
          profileMap.set(profile.user_id, profile);
        }
      }

      const messages: DmMessage[] = (messageRows ?? []).map((row) => {
        const senderProfile = profileMap.get(row.sender_user_id);
        const username = toSafeUsername(senderProfile?.username, row.sender_user_id);
        const displayName = (senderProfile?.full_name ?? "").trim() || `@${username}`;
        return {
          id: row.id,
          threadId: row.thread_id,
          senderUserId: row.sender_user_id,
          content: row.content,
          createdAt: row.created_at,
          sender: {
            username,
            displayName,
          },
        };
      });

      return NextResponse.json({ messages });
    } catch (error) {
      if (!isMissingDmTablesError(error)) throw error;
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load messages." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as PostBody;
    const threadId = (body.threadId ?? "").trim();
    const content = (body.content ?? "").trim();

    if (!threadId || (!isUuid(threadId) && !isFallbackThreadId(threadId))) {
      return NextResponse.json({ error: "Valid threadId is required." }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 });
    }

    if (isFallbackThreadId(threadId)) {
      const fallbackMessage = await sendFallbackMessage(user.id, threadId, content);
      return NextResponse.json({ message: fallbackMessage });
    }

    try {
      const thread = await ensureParticipantThread(threadId, user.id);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      }

      const participantUserId = thread.user_a === user.id ? thread.user_b : thread.user_a;
      let blocked = false;
      try {
        blocked = await isMessagingBlockedInTable(user.id, participantUserId);
      } catch (error) {
        if (!isMissingDmTablesError(error)) throw error;
        blocked = await isFallbackMessagingBlockedBetween(user.id, participantUserId);
      }
      if (blocked) {
        return NextResponse.json(
          { error: "Messaging is blocked for this conversation." },
          { status: 403 },
        );
      }

      const insertedRows = await supabaseServiceRoleRequest<MessageRow[]>(
        "/rest/v1/dm_messages?select=id,thread_id,sender_user_id,content,created_at",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            thread_id: threadId,
            sender_user_id: user.id,
            content,
          }),
        },
      );
      const inserted = insertedRows?.[0];
      if (!inserted) {
        throw new Error("Unable to send message.");
      }

      await supabaseServiceRoleRequest(`/rest/v1/dm_threads?id=eq.${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          updated_at: inserted.created_at,
          last_message_at: inserted.created_at,
        }),
      }).catch(() => null);

      const senderProfiles = await supabaseServiceRoleRequest<ProfileRow[]>(
        `/rest/v1/profiles?select=user_id,username,full_name&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      ).catch(() => []);
      const senderProfile = senderProfiles?.[0];
      const senderUsername = toSafeUsername(senderProfile?.username, user.id);
      const senderDisplayName = (senderProfile?.full_name ?? "").trim() || `@${senderUsername}`;

      return NextResponse.json({
        message: {
          id: inserted.id,
          threadId: inserted.thread_id,
          senderUserId: inserted.sender_user_id,
          content: inserted.content,
          createdAt: inserted.created_at,
          sender: {
            username: senderUsername,
            displayName: senderDisplayName,
          },
        } satisfies DmMessage,
      });
    } catch (error) {
      if (!isMissingDmTablesError(error)) throw error;
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send message." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as PostBody;
    const threadId = (body.threadId ?? "").trim();
    const messageId = (body.messageId ?? "").trim();

    if (!threadId || (!isUuid(threadId) && !isFallbackThreadId(threadId))) {
      return NextResponse.json({ error: "Valid threadId is required." }, { status: 400 });
    }
    if (!messageId || !isUuid(messageId)) {
      return NextResponse.json({ error: "Valid messageId is required." }, { status: 400 });
    }

    if (isFallbackThreadId(threadId)) {
      await deleteFallbackMessage(user.id, threadId, messageId);
      const messages = await listFallbackMessagesForThread(user.id, threadId);
      return NextResponse.json({ success: true, messages });
    }

    try {
      const thread = await ensureParticipantThread(threadId, user.id);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      }

      await supabaseServiceRoleRequest(
        `/rest/v1/dm_messages?id=eq.${encodeURIComponent(messageId)}&thread_id=eq.${encodeURIComponent(threadId)}&sender_user_id=eq.${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );
      const refreshed = await supabaseServiceRoleRequest<MessageRow[]>(
        `/rest/v1/dm_messages?select=id,thread_id,sender_user_id,content,created_at&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.asc&limit=250`,
      ).catch(() => []);

      const participantIds = Array.from(new Set((refreshed ?? []).map((row) => row.sender_user_id)));
      const profileMap = new Map<string, ProfileRow>();
      if (participantIds.length > 0) {
        const encodedIn = encodeURIComponent(`(${participantIds.join(",")})`);
        const profileRows = await supabaseServiceRoleRequest<ProfileRow[]>(
          `/rest/v1/profiles?select=user_id,username,full_name&user_id=in.${encodedIn}`,
        ).catch(() => []);
        for (const profile of profileRows ?? []) {
          profileMap.set(profile.user_id, profile);
        }
      }

      const messages: DmMessage[] = (refreshed ?? []).map((row) => {
        const senderProfile = profileMap.get(row.sender_user_id);
        const username = toSafeUsername(senderProfile?.username, row.sender_user_id);
        const displayName = (senderProfile?.full_name ?? "").trim() || `@${username}`;
        return {
          id: row.id,
          threadId: row.thread_id,
          senderUserId: row.sender_user_id,
          content: row.content,
          createdAt: row.created_at,
          sender: {
            username,
            displayName,
          },
        };
      });

      return NextResponse.json({ success: true, messages });
    } catch (error) {
      if (!isMissingDmTablesError(error)) throw error;
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete message." },
      { status: 500 },
    );
  }
}
