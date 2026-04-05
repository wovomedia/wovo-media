"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { readSessionFromStorage } from "@/lib/supabase/session-client";

type SupportAdmin = {
  userId: string;
  username: string;
  displayName: string;
};

type SupportMessage = {
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

type AdminLookupPayload = {
  admins?: SupportAdmin[];
  viewer?: {
    userId?: string;
    isAdmin?: boolean;
  };
  error?: string;
};

type SupportThread = {
  id: string;
  participant: {
    userId: string;
    username: string;
    displayName: string;
  };
  lastMessageAt?: string | null;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
  } | null;
};

const FAQ_ITEMS = [
  {
    q: "Where are my credits after purchase?",
    a: "Credits can take a short moment to sync. If they do not appear, contact support@wovomedia.com and we will fix it quickly.",
  },
  {
    q: "Why can’t I create with some modules?",
    a: "Advanced modules are Pro-only. Free and Starter can create captions and image ads. Upgrade to Pro for mascot, spokesperson, and video tools.",
  },
  {
    q: "How do I publish to the public feed?",
    a: "When your ad is generated, choose public publishing. If you skip publishing, the content stays private in your account library.",
  },
  {
    q: "Can I get direct help from support?",
    a: "Yes. Sign in and use the chat box below to message admin support directly.",
  },
];

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SupportWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState("");
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [supportAdmin, setSupportAdmin] = useState<SupportAdmin | null>(null);
  const [threadId, setThreadId] = useState("");
  const [adminThreads, setAdminThreads] = useState<SupportThread[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const session = readSessionFromStorage();
    setToken(session?.access_token ?? null);
  }, [pathname]);

  const isLoggedIn = Boolean(token);
  const isOnAuthPage = pathname === "/login" || pathname === "/signup";

  const authedFetch = useMemo(() => {
    return async (input: string, init?: RequestInit) => {
      if (!token) throw new Error("Please log in to use live support chat.");
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }
      return await fetch(input, {
        ...init,
        headers,
        cache: "no-store",
      });
    };
  }, [token]);

  async function ensureSupportThread(): Promise<string | null> {
    const adminResponse = await authedFetch("/api/support/admins");
    const adminPayload = (await adminResponse.json().catch(() => ({}))) as AdminLookupPayload;
    if (!adminResponse.ok) {
      throw new Error(adminPayload.error ?? "Unable to connect to support.");
    }

    const viewerId = (adminPayload.viewer?.userId ?? "").trim();
    const isAdmin = Boolean(adminPayload.viewer?.isAdmin);
    const adminPool = adminPayload.admins ?? [];
    const viewerIsInAdminPool = Boolean(viewerId) && adminPool.some((item) => item.userId === viewerId);
    const shouldUseAdminInbox = isAdmin || viewerIsInAdminPool;
    setViewerUserId(viewerId);
    setViewerIsAdmin(shouldUseAdminInbox);

    if (shouldUseAdminInbox) {
      const inboxResponse = await authedFetch("/api/wovo-ai/social/dm/threads");
      const inboxPayload = (await inboxResponse.json().catch(() => ({}))) as {
        threads?: SupportThread[];
        error?: string;
      };
      if (!inboxResponse.ok) {
        throw new Error(inboxPayload.error ?? "Unable to load support inbox.");
      }

      const threads = (inboxPayload.threads ?? []).filter((thread) => thread.participant.userId !== viewerId);
      setAdminThreads(threads);

      const selectedThread = threads.find((thread) => thread.id === threadId) ?? threads[0] ?? null;
      if (!selectedThread) {
        setSupportAdmin(null);
        setThreadId("");
        setMessages([]);
        setStatus("No support requests yet.");
        return null;
      }

      setSupportAdmin({
        userId: selectedThread.participant.userId,
        username: selectedThread.participant.username,
        displayName: selectedThread.participant.displayName,
      });
      setThreadId(selectedThread.id);
      return selectedThread.id;
    }

    setAdminThreads([]);
    const selectedAdmin = adminPool.find((item) => item.userId !== viewerId) ?? null;
    if (!selectedAdmin) {
      throw new Error("No support admin is available right now. Email support@wovomedia.com.");
    }
    setSupportAdmin(selectedAdmin);

    const threadResponse = await authedFetch("/api/wovo-ai/social/dm/threads", {
      method: "POST",
      body: JSON.stringify({ targetUserId: selectedAdmin.userId }),
    });
    const threadPayload = (await threadResponse.json().catch(() => ({}))) as {
      thread?: { id?: string };
      error?: string;
    };
    if (!threadResponse.ok || !threadPayload.thread?.id) {
      throw new Error(threadPayload.error ?? "Unable to open support chat.");
    }

    const nextThreadId = threadPayload.thread.id.trim();
    if (!nextThreadId) {
      throw new Error("Unable to open support chat.");
    }
    setThreadId(nextThreadId);
    return nextThreadId;
  }

  async function loadMessages(targetThreadId: string) {
    const response = await authedFetch(`/api/wovo-ai/social/dm/messages?threadId=${encodeURIComponent(targetThreadId)}`);
    const payload = (await response.json().catch(() => ({}))) as {
      messages?: SupportMessage[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load support messages.");
    }
    setMessages(payload.messages ?? []);
  }

  async function bootstrapSupport() {
    if (!token) return;
    try {
      setLoadingChat(true);
      setError("");
      setStatus("");
      const nextThreadId = await ensureSupportThread();
      if (nextThreadId) {
        await loadMessages(nextThreadId);
      }
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to connect to support chat.");
    } finally {
      setLoadingChat(false);
    }
  }

  useEffect(() => {
    if (!open || !token) return;
    void bootstrapSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  async function refreshChat() {
    if (!token) return;
    try {
      setLoadingChat(true);
      setError("");
      setStatus("");
      const nextThreadId = await ensureSupportThread();
      if (nextThreadId) {
        await loadMessages(nextThreadId);
      }
      setStatus("Support chat refreshed.");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh support chat.");
    } finally {
      setLoadingChat(false);
    }
  }

  useEffect(() => {
    if (!open || !token) return;
    const intervalId = window.setInterval(() => {
      if (viewerIsAdmin) {
        void ensureSupportThread()
          .then((nextThreadId) => {
            if (nextThreadId) return loadMessages(nextThreadId);
            return undefined;
          })
          .catch(() => undefined);
        return;
      }

      if (threadId) {
        void loadMessages(threadId).catch(() => undefined);
      }
    }, 7000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, threadId, token, viewerIsAdmin]);

  useEffect(() => {
    setThreadId("");
    setAdminThreads([]);
    setMessages([]);
    setSupportAdmin(null);
    setViewerUserId("");
    setViewerIsAdmin(false);
    setDraft("");
    setError("");
    setStatus("");
  }, [token]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !token) return;

    try {
      setSending(true);
      setError("");
      setStatus("");
      const activeThreadId = threadId || (await ensureSupportThread());
      if (!activeThreadId) {
        throw new Error(
          viewerIsAdmin
            ? "No support conversation selected yet."
            : "Unable to open support chat right now.",
        );
      }
      const response = await authedFetch("/api/wovo-ai/social/dm/messages", {
        method: "POST",
        body: JSON.stringify({
          threadId: activeThreadId,
          content,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: SupportMessage;
        error?: string;
      };
      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Unable to send support message.");
      }
      setMessages((current) => [...current, payload.message!]);
      setDraft("");
      setStatus(viewerIsAdmin ? "Reply sent." : "Message sent to support.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send support message.");
    } finally {
      setSending(false);
    }
  }

  async function selectAdminThread(nextThreadId: string) {
    const normalizedThreadId = nextThreadId.trim();
    if (!normalizedThreadId) return;
    setThreadId(normalizedThreadId);
    const selected = adminThreads.find((thread) => thread.id === normalizedThreadId) ?? null;
    if (selected) {
      setSupportAdmin({
        userId: selected.participant.userId,
        username: selected.participant.username,
        displayName: selected.participant.displayName,
      });
    }
    try {
      setLoadingChat(true);
      setError("");
      await loadMessages(normalizedThreadId);
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : "Unable to load support thread.");
    } finally {
      setLoadingChat(false);
    }
  }

  if (isOnAuthPage) return null;

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-4 z-[70] w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#091218]/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Support</p>
              <h3 className="text-lg font-semibold text-white">Help Center</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/20 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-300/40 hover:text-emerald-200"
            >
              Close
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-sm font-semibold text-slate-100">FAQ</p>
            <div className="mt-2 space-y-2">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-100">{item.q}</summary>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">Live Admin Chat</p>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => void refreshChat()}
                  className="rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300/40 hover:text-emerald-200"
                >
                  Refresh
                </button>
              ) : null}
            </div>

            {!isLoggedIn ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-300">Log in to message support admins directly.</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/login"
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-emerald-300/40 hover:text-emerald-200"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-[#00E991] px-3 py-1.5 text-xs font-semibold text-[#042319] hover:bg-[#2af0a7]"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-400">
                  {viewerIsAdmin
                    ? supportAdmin
                      ? `Admin inbox connected to ${supportAdmin.displayName}`
                      : "Admin inbox is ready. Select a support conversation."
                    : supportAdmin
                      ? `Connected with ${supportAdmin.displayName}`
                      : "Connecting to admin support..."}
                </p>
                {viewerIsAdmin ? (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300">Support conversations</p>
                    {adminThreads.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">No user support chats yet.</p>
                    ) : (
                      <select
                        value={threadId}
                        onChange={(event) => void selectAdminThread(event.target.value)}
                        className="mt-2 h-9 w-full rounded-lg border border-white/15 bg-black/45 px-2 text-xs text-white"
                      >
                        {adminThreads.map((thread) => (
                          <option key={thread.id} value={thread.id}>
                            {thread.participant.displayName} (@{thread.participant.username})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : null}
                <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/35 p-2">
                  {loadingChat ? (
                    <p className="text-xs text-slate-300">Loading support chat...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-xs text-slate-300">No messages yet. Send your question and admin support will reply here.</p>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message) => {
                        const isMine = Boolean(viewerUserId) && message.senderUserId === viewerUserId;
                        return (
                          <div
                            key={message.id}
                            className={`rounded-lg border px-2.5 py-2 text-xs ${
                              isMine
                                ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                                : "border-white/15 bg-black/35 text-slate-100"
                            }`}
                          >
                            <p className="font-semibold">
                              {isMine ? "You" : message.sender.displayName}
                              {formatTime(message.createdAt) ? ` · ${formatTime(message.createdAt)}` : ""}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Type your support question..."
                    className="h-10 flex-1 rounded-lg border border-white/15 bg-black/45 px-3 text-sm text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={sending || !draft.trim() || (viewerIsAdmin && !threadId)}
                    onClick={() => void sendMessage()}
                    className="rounded-lg bg-[#00E991] px-3 py-2 text-xs font-semibold text-[#032117] disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            )}

            <p className="mt-2 text-[11px] text-slate-400">
              Need urgent help? Email{" "}
              <a className="font-semibold text-emerald-200 underline" href="mailto:support@wovomedia.com">
                support@wovomedia.com
              </a>
              .
            </p>
            {status ? <p className="mt-1 text-[11px] text-emerald-200">{status}</p> : null}
            {error ? <p className="mt-1 text-[11px] text-rose-300">{error}</p> : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-6 right-4 z-[70] inline-flex h-12 items-center justify-center rounded-full border border-emerald-300/40 bg-[#00E991] px-5 text-sm font-semibold text-[#032117] shadow-[0_14px_30px_rgba(0,0,0,0.35)] hover:bg-[#2af0a7]"
      >
        {open ? "Hide Help" : "Need Help?"}
      </button>
    </>
  );
}
