"use client";

import Link from "next/link";
import { type ChangeEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase, type Session } from "@/lib/supabase/client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

type PlanKey = "starter" | "pro" | "agency";
type SupabaseAuthUser = { id: string; email?: string };

type SubscriptionPayload = UnifiedSubscriptionResponse & { admin_access?: boolean };
type ChatSummary = { id: string; title: string; created_at: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };
type PlanOption = { key: PlanKey; name: string; price: string; priceId?: string; desc: string; subtext?: string; popular?: boolean };
type ToolMode = "caption" | "image";

const STORAGE_KEY = "wovo-supabase-session";
const planOrder: PlanKey[] = ["starter", "pro", "agency"];
const inputClass = "w-full rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-sm text-white outline-none";

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
  const [prompt, setPrompt] = useState("");
  const [toolMode, setToolMode] = useState<ToolMode>("caption");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageName, setReferenceImageName] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState<PlanKey | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const plans: PlanOption[] = useMemo(() => [
    { key: "starter", name: "Starter", price: "$24.99", desc: "9 credits/month · 3/week", priceId: process.env.NEXT_PUBLIC_STARTER_PRICE_ID },
    { key: "pro", name: "Pro", price: "$49.99", desc: "18 credits/month · 6/week", priceId: process.env.NEXT_PUBLIC_PRO_PRICE_ID },
    { key: "agency", name: "Agency", price: "$99", desc: "42 credits/month · 14/week", subtext: "Best for agencies & daily posting", popular: true, priceId: process.env.NEXT_PUBLIC_AGENCY_PRICE_ID },
  ], []);

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

  const active = subscription?.status === "active";
  const isAdmin = Boolean(subscription?.admin_access);
  const canChat = Boolean(active || isAdmin);
  const remaining = subscription?.remaining ?? { credits_total: 0, credits_remaining: 0, weekly_limit: 0, weekly_used: 0 };
  const blocked = !isAdmin && (!subscription?.can_generate || remaining.credits_remaining <= 0 || (remaining.weekly_limit > 0 && remaining.weekly_used >= remaining.weekly_limit));

  const createChat = async () => {
    const title = prompt.trim().slice(0, 48) || "New Chat";
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
    if (!topic || generating || !canChat || blocked) return;
    setGenerating(true);
    setError("");

    try {
      const chatId = activeChatId ?? await createChat();
      const userMessage = await persistMessage(chatId, "user", topic);
      setMessages((prev) => [...prev, userMessage]);
      setPrompt("");

      const assistantTempId = `temp-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantTempId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: topic,
          reference_image: toolMode === "image" ? referenceImage : null,
        }),
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

  const onReferenceImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReferenceImageName(file.name);
    const readAsDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to attach image."));
      reader.readAsDataURL(file);
    });
    setReferenceImage(readAsDataUrl);
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

  const currentPlanIndex = subscription?.plan && subscription.plan !== "none" ? planOrder.indexOf(subscription.plan) : -1;
  const planLabel = (plan: PlanOption) => {
    if (subscription?.plan === plan.key && active) return "Current plan";
    if (!active) return `Subscribe ${plan.name}`;
    const targetIndex = planOrder.indexOf(plan.key);
    return targetIndex > currentPlanIndex ? "Upgrade" : "Downgrade";
  };

  const startCheckout = async (plan: PlanOption) => {
    if (!plan.priceId) return;
    setSubmittingCheckout(plan.key);
    setError("");
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ priceId: plan.priceId }) });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to start billing.");
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmittingCheckout(null);
    }
  };

  const openPortal = async () => {
    setOpeningPortal(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST", headers: await authHeaders() });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to open portal.");
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed.");
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#113126_0%,#060808_40%,#020202_100%)] px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {!loadingSession && !session && <section className="mx-auto mt-20 max-w-md rounded-3xl border border-emerald-200/20 bg-black/60 p-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Wovo AI</p>
          <h1 className="mt-2 text-2xl font-bold">Sign in to launch better social content</h1>
          <div className="mt-4 space-y-3 text-left">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputClass} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={inputClass} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button onClick={async () => {
              const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
              if (signInError || !data.session) return setError(mapSupabaseAuthError(signInError).message);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.session));
              supabase.setAccessToken(data.session.access_token);
              setSession(data.session);
            }} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">Sign in</button>
            <button onClick={async () => {
              const { error: signUpError } = await supabase.auth.signUp({ email, password });
              if (signUpError) return setError(mapSupabaseAuthError(signUpError).message);
              setInfo("Check your email to confirm your account.");
            }} className="rounded-xl border border-white/35 px-4 py-2.5 text-sm">Sign up</button>
          </div>
        </section>}

        {session && authUser && <>
          <header className="flex flex-col gap-3 rounded-3xl border border-emerald-200/20 bg-black/55 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Wovo AI</p>
              <h1 className="text-2xl font-semibold">Content command center</h1>
              <p className="text-sm text-white/70">Signed in as {authUser.email}</p>
            </div>
            <div className="flex gap-2">
              {active && !isAdmin && <button onClick={() => void openPortal()} disabled={openingPortal} className="rounded-lg border border-white/30 px-4 py-2 text-sm">{openingPortal ? "Opening..." : "Manage Billing"}</button>}
              <button onClick={signOut} className="rounded-lg border border-white/30 px-4 py-2 text-sm">Sign out</button>
            </div>
          </header>

          <section className="rounded-3xl border border-white/15 bg-black/45 p-5">
            <h2 className="text-xl font-semibold">Choose your Wovo AI plan</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const disabled = Boolean((active && subscription?.plan === plan.key) || !plan.priceId || submittingCheckout === plan.key);
                return <article key={plan.key} className={`rounded-2xl border p-4 ${plan.popular ? "border-emerald-300/80 bg-emerald-400/10" : "border-white/20 bg-black/30"}`}>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-2xl font-bold">{plan.price}</p>
                  <p className="mt-1 text-sm text-white/70">{plan.desc}</p>
                  <button onClick={() => void startCheckout(plan)} disabled={disabled} className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-60">{submittingCheckout === plan.key ? "Working..." : planLabel(plan)}</button>
                </article>;
              })}
            </div>
          </section>

          {canChat && <section className="rounded-3xl border border-white/15 bg-black/45 p-4">
            <div className="grid gap-4 md:grid-cols-[280px,1fr]">
              <aside className="rounded-2xl border border-white/15 bg-black/30 p-3">
                <button onClick={() => void createChat()} className="mb-3 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-black">+ New Chat</button>
                <div className="space-y-2">
                  {chats.map((chat) => <button key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${activeChatId === chat.id ? "border-emerald-300 bg-emerald-500/10" : "border-white/20"}`}>
                    <p className="truncate text-sm">{chat.title}</p>
                    <p className="text-white/50">{new Date(chat.created_at).toLocaleDateString()}</p>
                  </button>)}
                </div>
              </aside>

              <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
                <div ref={transcriptRef} className="h-[420px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3">
                  {loadingMessages && <p className="text-sm text-white/60">Loading messages…</p>}
                  {!loadingMessages && messages.length === 0 && <p className="text-sm text-white/60">Start a new conversation.</p>}
                  {messages.map((message) => <div key={message.id} className={`max-w-[92%] rounded-xl p-3 text-sm whitespace-pre-wrap ${message.role === "user" ? "ml-auto bg-white/10" : "mr-auto border border-white/15 bg-black/50"}`}>
                    {message.content}
                  </div>)}
                </div>

                <div className="mt-3 rounded-xl border border-white/15 bg-black/70 p-3">
                  {blocked && <p className="mb-2 text-xs text-amber-300">You’ve reached your current generation limits. Please update your plan or wait for reset.</p>}
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <label className="text-white/70">Tool</label>
                    <select value={toolMode} onChange={(e) => setToolMode(e.target.value as ToolMode)} className="rounded-md border border-white/20 bg-black px-2 py-1">
                      <option value="caption">Caption</option>
                      <option value="image">Image</option>
                    </select>
                    <span className="text-white/60">Credits: {remaining.credits_remaining} · Weekly left: {Math.max(remaining.weekly_limit - remaining.weekly_used, 0)}</span>
                  </div>
                  {toolMode === "image" && <div className="mb-2 text-xs text-white/70">
                    <input type="file" accept="image/*" onChange={(e) => void onReferenceImageChange(e)} disabled={generating || blocked} />
                    {referenceImageName && <span className="ml-2">Attached: {referenceImageName}</span>}
                  </div>}
                  <div className="flex gap-2">
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={onComposerKeyDown} rows={3} className={inputClass} placeholder="Ask Wovo AI for captions or image post ideas..." disabled={generating || blocked} />
                    <button onClick={() => void sendMessage()} disabled={generating || blocked || !prompt.trim()} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-60">{generating ? "Sending..." : "Send"}</button>
                  </div>
                  <p className="mt-2 text-xs text-white/60">Enter = send · Shift+Enter = newline</p>
                </div>
              </div>
            </div>
          </section>}
        </>}

        {error && <p className="text-sm text-red-300">{error}</p>}
        {info && <p className="text-sm text-emerald-300">{info}</p>}
        <p className="text-center text-xs text-white/40">Need help? <Link className="underline" href="/">Back home</Link></p>
      </div>
    </main>
  );
}
