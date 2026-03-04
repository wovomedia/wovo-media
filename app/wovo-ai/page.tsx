"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase, type Session } from "@/lib/supabase/client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { EXTRA_CREDITS_PRICE_ID } from "@/lib/wovo-ai/plans";

type SupabaseAuthUser = { id: string; email?: string };
type SubscriptionPayload = UnifiedSubscriptionResponse & { admin_access?: boolean };
type ChatSummary = { id: string; title: string; created_at: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

type QuickAction = { label: string; key: string; prefix: string };

const STORAGE_KEY = "wovo-supabase-session";
const quickActions: QuickAction[] = [
  { label: "Caption", key: "caption", prefix: "Write a short social media caption for this business goal: " },
  { label: "Facebook Post", key: "facebook", prefix: "Create a Facebook post optimized for engagement: " },
  { label: "Instagram Caption", key: "instagram", prefix: "Create an Instagram caption with emojis and CTA: " },
  { label: "Ad Copy", key: "adcopy", prefix: "Write conversion-focused ad copy for: " },
  { label: "Generate Image", key: "image", prefix: "Generate an image concept and prompt for: " },
];

const plans = [
  { key: "starter", name: "Starter", price: "$24.99", priceId: process.env.NEXT_PUBLIC_STARTER_PRICE_ID },
  { key: "pro", name: "Pro", price: "$49.99", priceId: process.env.NEXT_PUBLIC_PRO_PRICE_ID },
  { key: "business", name: "Business", price: "$99", priceId: process.env.NEXT_PUBLIC_BUSINESS_PRICE_ID },
];

function parseSessionFromHash(hash: string): Session | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  return { access_token: accessToken, refresh_token: params.get("refresh_token") ?? undefined };
}

export default function WovoAiPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionPayload | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedAction, setSelectedAction] = useState<QuickAction>(quickActions[0]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    return currentSession?.access_token ?? session?.access_token ?? null;
  }, [session?.access_token]);

  const authHeaders = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error("Missing auth session.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, [getAccessToken]);

  const loadSubscription = useCallback(async () => {
    const response = await fetch("/api/wovo-ai/subscription", { headers: await authHeaders() });
    const payload = (await response.json()) as SubscriptionPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to load subscription.");
    setSubscription(payload);
  }, [authHeaders]);

  const loadChats = useCallback(async () => {
    const response = await fetch("/api/wovo-ai/chats", { headers: await authHeaders() });
    const payload = (await response.json()) as { chats?: ChatSummary[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to load chats.");
    const nextChats = payload.chats ?? [];
    setChats(nextChats);
    setActiveChatId((prev) => prev ?? nextChats[0]?.id ?? null);
  }, [authHeaders]);

  const loadMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/wovo-ai/chats/${chatId}/messages`, { headers: await authHeaders() });
      const payload = (await response.json()) as { messages?: ChatMessage[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load messages.");
      setMessages(payload.messages ?? []);
    } finally {
      setLoadingMessages(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const load = async () => {
      try {
        const fromHash = parseSessionFromHash(window.location.hash);
        if (fromHash) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromHash));
          window.history.replaceState({}, document.title, "/wovo-ai");
          setSession(fromHash);
          supabase.setAccessToken(fromHash.access_token);
          return;
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Session;
          setSession(parsed);
          supabase.setAccessToken(parsed.access_token);
        }
      } finally {
        setLoadingSession(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      if (!session?.access_token) return;
      const { data, error: userError } = await supabase.auth.getUser(session.access_token);
      if (userError || !data.user) return;
      setAuthUser(data.user as SupabaseAuthUser);
      setEmail(data.user.email ?? "");
      await Promise.all([loadSubscription(), loadChats()]);
    };
    void hydrate().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load account."));
  }, [loadChats, loadSubscription, session?.access_token]);

  useEffect(() => {
    if (!activeChatId || !session?.access_token) return;
    void loadMessages(activeChatId).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load messages."));
  }, [activeChatId, loadMessages, session?.access_token]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const createChat = async (title = "New Chat") => {
    const response = await fetch("/api/wovo-ai/chats", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ title }),
    });
    const payload = (await response.json()) as { chat?: ChatSummary; error?: string };
    if (!response.ok || !payload.chat) throw new Error(payload.error ?? "Unable to create chat.");
    setChats((prev) => [payload.chat as ChatSummary, ...prev]);
    setActiveChatId(payload.chat.id);
    setMessages([]);
    return payload.chat.id;
  };

  const persistMessage = async (chatId: string, role: "user" | "assistant", content: string) => {
    const response = await fetch(`/api/wovo-ai/chats/${chatId}/messages`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ role, content }),
    });
    const payload = (await response.json()) as { message?: ChatMessage; error?: string };
    if (!response.ok || !payload.message) throw new Error(payload.error ?? "Unable to save message.");
    return payload.message;
  };

  const sendMessage = async () => {
    const topic = prompt.trim();
    if (!topic || generating) return;
    setGenerating(true);
    setError("");

    try {
      const chatId = activeChatId ?? await createChat(topic.slice(0, 50));
      const finalPrompt = `${selectedAction.prefix}${topic}`;
      const userMessage = await persistMessage(chatId, "user", finalPrompt);
      setMessages((prev) => [...prev, userMessage]);
      setPrompt("");

      const assistantTempId = `temp-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantTempId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      const response = await fetch("/api/wovo-ai/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ message: finalPrompt, quickAction: selectedAction.key, chatId }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to generate content.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const data = JSON.parse(event.slice(6)) as { delta?: string; done?: boolean; assistantText?: string };
          if (data.delta) {
            assistantContent += data.delta;
            setMessages((prev) => prev.map((message) => message.id === assistantTempId ? { ...message, content: assistantContent } : message));
          }
          if (data.done && data.assistantText) {
            assistantContent = data.assistantText;
          }
        }
      }

      const persistedAssistant = await persistMessage(chatId, "assistant", assistantContent.trim() || "Done.");
      setMessages((prev) => prev.map((message) => message.id === assistantTempId ? persistedAssistant : message));
      await loadSubscription();
      await loadChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setGenerating(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const startCheckout = async (priceId?: string) => {
    if (!priceId) return;
    const response = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ priceId }),
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to start checkout.");
    window.location.href = payload.url;
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    supabase.setAccessToken(null);
    setSession(null);
    setAuthUser(null);
    setSubscription(null);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
  };

  const planName = useMemo(() => subscription?.plan ?? "none", [subscription?.plan]);
  const monthlyUsed = subscription?.remaining.monthly_used ?? 0;
  const monthlyLimit = subscription?.remaining.monthly_limit ?? 0;
  const remaining = subscription?.remaining.credits_remaining ?? 0;

  return <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-white">
    <div className="mx-auto max-w-6xl space-y-4">
      {!loadingSession && !session && <section className="mx-auto mt-20 max-w-md rounded-2xl border border-white/20 bg-black/40 p-6">
        <h1 className="text-2xl font-bold">Wovo AI</h1>
        <p className="mb-3 text-sm text-white/70">Sign in to continue</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mb-2 w-full rounded border border-white/20 bg-black p-2" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mb-3 w-full rounded border border-white/20 bg-black p-2" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={async () => {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError || !data.session) return setError(mapSupabaseAuthError(signInError).message);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.session));
            supabase.setAccessToken(data.session.access_token);
            setSession(data.session);
          }} className="rounded bg-white px-3 py-2 text-black">Sign in</button>
          <button onClick={async () => {
            const { error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) return setError(mapSupabaseAuthError(signUpError).message);
            setInfo("Check your email to confirm your account.");
          }} className="rounded border border-white/30 px-3 py-2">Sign up</button>
        </div>
      </section>}

      {session && authUser && <>
        <header className="flex items-center justify-between rounded-2xl border border-white/20 bg-black/40 p-4">
          <div>
            <h1 className="text-xl font-semibold">Wovo AI Assistant</h1>
            <p className="text-xs text-white/70">{authUser.email}</p>
          </div>
          <button onClick={signOut} className="rounded border border-white/20 px-3 py-2 text-sm">Sign out</button>
        </header>

        <section className="grid gap-3 rounded-2xl border border-white/20 bg-black/40 p-4 md:grid-cols-5">
          <div><p className="text-xs text-white/70">Plan</p><p className="font-semibold capitalize">{planName}</p></div>
          <div><p className="text-xs text-white/70">Monthly credits used</p><p className="font-semibold">{monthlyUsed}/{monthlyLimit}</p></div>
          <div><p className="text-xs text-white/70">Remaining credits</p><p className="font-semibold">{remaining}</p></div>
          <button onClick={() => {
            const nextPlan = plans.find((plan) => plan.key !== planName);
            void startCheckout(nextPlan?.priceId).catch((err: unknown) => setError(err instanceof Error ? err.message : "Checkout failed."));
          }} className="rounded bg-white px-3 py-2 text-sm font-semibold text-black">Upgrade plan</button>
          <button onClick={() => void startCheckout(EXTRA_CREDITS_PRICE_ID).catch((err: unknown) => setError(err instanceof Error ? err.message : "Checkout failed."))} className="rounded border border-white/25 px-3 py-2 text-sm">Buy extra credits</button>
        </section>

        <section className="grid gap-4 md:grid-cols-[260px,1fr]">
          <aside className="rounded-2xl border border-white/20 bg-black/40 p-3">
            <button onClick={() => void createChat().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to create chat."))} className="mb-3 w-full rounded bg-white px-3 py-2 text-black">New Chat</button>
            <div className="space-y-2">
              {chats.map((chat) => <button key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`w-full rounded border px-2 py-2 text-left text-sm ${activeChatId === chat.id ? "border-white bg-white/10" : "border-white/20"}`}>{chat.title}</button>)}
            </div>
          </aside>

          <div className="rounded-2xl border border-white/20 bg-black/40 p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickActions.map((action) => <button key={action.key} onClick={() => setSelectedAction(action)} className={`rounded px-3 py-1 text-sm ${selectedAction.key === action.key ? "bg-white text-black" : "border border-white/20"}`}>{action.label}</button>)}
            </div>
            <div ref={transcriptRef} className="h-[420px] space-y-3 overflow-y-auto rounded border border-white/20 bg-black/50 p-3">
              {loadingMessages && <p className="text-sm text-white/70">Loading messages...</p>}
              {!loadingMessages && messages.length === 0 && <p className="text-sm text-white/70">Start a conversation.</p>}
              {messages.map((message) => <div key={message.id} className={`max-w-[90%] whitespace-pre-wrap rounded p-2 text-sm ${message.role === "user" ? "ml-auto bg-white/10" : "border border-white/15 bg-black"}`}>{message.content}</div>)}
            </div>
            <div className="mt-3 flex gap-2">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={onComposerKeyDown} rows={3} className="w-full rounded border border-white/20 bg-black p-2" placeholder="Ask Wovo AI..." disabled={generating || remaining <= 0} />
              <button onClick={() => void sendMessage()} disabled={generating || !prompt.trim() || remaining <= 0} className="rounded bg-white px-4 py-2 text-black disabled:opacity-60">{generating ? "Sending..." : "Send"}</button>
            </div>
            <p className="mt-1 text-xs text-white/70">Enter = send · Shift+Enter = newline</p>
          </div>
        </section>
      </>}

      {error && <p className="text-sm text-red-300">{error}</p>}
      {info && <p className="text-sm text-emerald-300">{info}</p>}
    </div>
  </main>;
}
