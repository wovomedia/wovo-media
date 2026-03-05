"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { clearSession, parseSessionFromHash, persistSession, readSessionFromStorage } from "@/lib/supabase/session-client";
import { submitPendingOnboarding } from "@/lib/wovo-ai/onboarding-client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

type ChatSummary = { id: string; title: string; created_at: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

const quickActions = [
  "Inspire me",
  "What's trending in my industry?",
  "I need a campaign idea",
  "How can I boost engagement?",
  "Draft a TikTok script",
  "Write an Instagram post",
  "Draft a posting schedule for next month",
] as const;

const planOptions = [
  { name: "Starter", price: "$24.99/mo", credits: "25 credits/mo", priceId: "price_1T76wyFmIvQosWF9UoGSKAe2", perks: ["25 AI credits/mo", "Core creation tools"] },
  { name: "Growth", price: "$49.99/mo", credits: "50 credits/mo", priceId: "price_1T76wSFmIvQosWF9u3GWCWBV", perks: ["50 AI credits/mo", "Best for growing teams"] },
  { name: "Pro", price: "$99/mo", credits: "100 credits/mo", priceId: "price_1T76vlFmIvQosWF9gmdPrCVT", badge: "Most Popular", perks: ["100 AI credits/mo", "Most Benefits", "Best value + priority"] },
] as const;

export default function WovoAiPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<(typeof quickActions)[number]>(quickActions[0]);

  const authedFetch = async (input: string, init?: RequestInit) => fetch(input, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });

  const load = async (accessToken: string) => {
    setToken(accessToken);
    supabase.setAccessToken(accessToken);

    await submitPendingOnboarding(accessToken);

    const [subRes, chatsRes, onboardRes] = await Promise.all([
      fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
      fetch("/api/wovo-ai/chats", { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch("/api/wovo-ai/onboarding", { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    const onboard = (await onboardRes.json()) as { complete?: boolean };
    if (!onboard.complete) return router.push("/signup");

    const subData = (await subRes.json()) as UnifiedSubscriptionResponse;
    setSubscription(subData);
    const active = Boolean((subData as { active?: boolean; hasPlan?: boolean })?.active ?? (subData as { active?: boolean; hasPlan?: boolean })?.hasPlan);
    setShowPlanModal(!active);
    setLoadingPlan(false);
    const chatPayload = (await chatsRes.json()) as { chats: ChatSummary[] };
    setChats(chatPayload.chats ?? []);
    setChatId(chatPayload.chats?.[0]?.id ?? null);
  };

  useEffect(() => {
    let mounted = true;

    const checkPlan = async () => {
      try {
        const s = readSessionFromStorage();
        const res = await fetch("/api/wovo-ai/subscription", {
          cache: "no-store",
          headers: s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : undefined,
        });
        const data = await res.json();
        if (!mounted) return;
        setSubscription(data);
        const active = Boolean(data?.active ?? data?.hasPlan);
        if (!active) setShowPlanModal(true);
      } catch (e) {
        console.error("Subscription check failed", e);
        if (mounted) setShowPlanModal(true);
      } finally {
        if (mounted) setLoadingPlan(false);
      }
    };

    void checkPlan();

    const fromHash = parseSessionFromHash(window.location.hash);
    if (fromHash) {
      persistSession(fromHash);
      window.history.replaceState({}, document.title, "/wovo-ai");
      void load(fromHash.access_token).catch((e) => {
        console.error("Failed to load Wovo AI", e);
        if (mounted) setLoadingPlan(false);
      });
      return;
    }
    const s = readSessionFromStorage();
    if (!s?.access_token) {
      setLoadingPlan(false);
      return router.push("/login");
    }
    void load(s.access_token).catch((e) => {
      console.error("Failed to load Wovo AI", e);
      if (mounted) setLoadingPlan(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = showPlanModal ? "hidden" : prev || "auto";
    return () => {
      document.body.style.overflow = prev || "auto";
    };
  }, [showPlanModal]);

  useEffect(() => {
    if (!chatId || !token) return;
    void authedFetch(`/api/wovo-ai/chats/${chatId}/messages`).then((r) => r.json()).then((d: { messages: ChatMessage[] }) => setMessages(d.messages ?? []));
  }, [chatId, token]);

  const createChat = async () => {
    const res = await authedFetch("/api/wovo-ai/chats", { method: "POST", body: JSON.stringify({ title: "New Chat" }) });
    const data = (await res.json()) as { chat: ChatSummary };
    setChats((prev) => [data.chat, ...prev]);
    setChatId(data.chat.id);
  };

  const send = async () => {
    if (!promptText.trim() || !chatId || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await authedFetch("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: promptText, chatId, quickAction: action.toLowerCase().replace(/[^a-z0-9]/g, "") }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPromptText("");
      const messagesRes = await authedFetch(`/api/wovo-ai/chats/${chatId}/messages`);
      setMessages(((await messagesRes.json()) as { messages: ChatMessage[] }).messages ?? []);
      const subRes = await authedFetch("/api/wovo-ai/subscription");
      setSubscription((await subRes.json()) as UnifiedSubscriptionResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const filteredChats = useMemo(() => chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())), [chats, search]);

  const handleQuickActionSelect = (selectedAction: (typeof quickActions)[number]) => {
    setAction(selectedAction);
    setPromptText(selectedAction);
  };

  const startCheckout = async (priceId: string) => {
    if (!token) return;
    const r = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ priceId }),
    });
    const { url } = (await r.json()) as { url: string };
    if (url) window.location.href = url;
  };

  if (loadingPlan) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">Loading your Wovo AI account...</div>;
  }

  return (
    <main className="min-h-screen bg-[#f4f4f5] text-zinc-900">
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
          <div className="w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-xl">
            <h2 className="mb-2 text-xl font-semibold">Choose your Wovo AI plan</h2>
            <p className="mb-6 text-zinc-400">Pick a plan to start generating AI content. Your account stays locked until an active subscription is detected.</p>
            <div className="grid gap-4 md:grid-cols-3">
              {planOptions.map((plan) => (
                <article key={plan.priceId} className={`rounded-xl border p-4 ${plan.name === "Pro" ? "border-violet-400 bg-violet-500/10" : "border-zinc-700 bg-zinc-950"}`}>
                  {plan.badge ? <p className="mb-2 inline-block rounded-full bg-violet-500 px-2 py-0.5 text-xs font-semibold">{plan.badge}</p> : null}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-zinc-200">{plan.price}</p>
                  <p className="text-sm text-zinc-400">{plan.credits}</p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300">{plan.perks.map((perk) => <li key={perk}>• {perk}</li>)}</ul>
                  <button className="mt-4 w-full rounded-lg bg-white py-2 font-semibold text-zinc-900 hover:opacity-90" onClick={() => void startCheckout(plan.priceId)}>
                    Choose {plan.name}
                  </button>
                </article>
              ))}
            </div>
            <p className="mt-5 text-xs text-zinc-500">Already paid? Refresh after checkout and you’ll be unlocked automatically.</p>
          </div>
        </div>
      )}
      <div className="grid min-h-screen grid-cols-[64px,1fr]">
        <aside className="flex flex-col items-center border-r border-zinc-200 bg-zinc-100 py-4">
          <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-[#f25555] text-lg text-white">🦉</div>
          <div className="space-y-3 text-lg text-zinc-500">
            <button className="block h-9 w-9 rounded-lg hover:bg-zinc-200">📅</button>
            <button className="block h-9 w-9 rounded-lg hover:bg-zinc-200">⊕</button>
            <button className="block h-9 w-9 rounded-full bg-[#073b4c] text-white">✦</button>
            <button className="block h-9 w-9 rounded-lg hover:bg-zinc-200">▣</button>
            <button className="block h-9 w-9 rounded-lg hover:bg-zinc-200">▮</button>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">Wovo AI</h1>
              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">Beta</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void createChat()} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">+ New chat</button>
              <details className="relative">
                <summary className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">Account</summary>
                <div className="absolute right-0 z-20 mt-2 w-56 space-y-1 rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-xl">
                  <p className="rounded px-2 py-1 text-xs text-zinc-500">Credits left: {subscription?.remaining_credits ?? subscription?.remainingCredits ?? subscription?.remaining?.credits_remaining ?? 0}</p>
                  <Link href="/wovo-ai/profile" className="block rounded px-2 py-1 hover:bg-zinc-100">Profile</Link>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-100" onClick={() => void authedFetch("/api/stripe/buy-credits", { method: "POST" }).then((r) => r.json()).then((d: { url?: string }) => d.url && (window.location.href = d.url))}>Buy credits</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-100" onClick={() => void authedFetch("/api/stripe/portal", { method: "POST" }).then((r) => r.json()).then((d: { url?: string }) => d.url && (window.location.href = d.url))}>Manage billing</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-100" onClick={async () => { const v = window.prompt("Type DELETE to confirm"); if (v === "DELETE") { await authedFetch("/api/account/delete", { method: "POST" }); clearSession(); router.push("/"); } }}>Delete account</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-100" onClick={async () => { const email = window.prompt("New email"); if (email) await authedFetch("/api/account/change-email", { method: "POST", body: JSON.stringify({ email }) }); }}>Change email</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-100" onClick={async () => { const password = window.prompt("New password"); if (password) await authedFetch("/api/account/change-password", { method: "POST", body: JSON.stringify({ password }) }); }}>Change password</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-100" onClick={() => { clearSession(); router.push("/login"); }}>Sign out</button>
                </div>
              </details>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
            <h2 className="text-center text-4xl font-semibold">How can Wovo AI help?</h2>
            <div className="mt-7 rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm">
              <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} onKeyDown={onKey} placeholder="Ask Wovo AI a question" className="h-24 w-full resize-none border-none bg-transparent text-lg outline-none placeholder:text-zinc-500" />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs" />
                  <select value={action} onChange={(e) => setAction(e.target.value as (typeof quickActions)[number])} className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium">
                    {quickActions.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <button onClick={() => void send()} disabled={sending} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? "..." : "Send"}</button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {quickActions.map((q) => (
                <button key={q} onClick={() => handleQuickActionSelect(q)} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-300">
                  {q}
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-500">Chats</h3>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {filteredChats.map((chat) => <button key={chat.id} onClick={() => setChatId(chat.id)} className={`w-full rounded-lg p-2 text-left text-sm ${chat.id === chatId ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>{chat.title}</button>)}
              </div>
            </div>

            <div className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-500">Conversation</h3>
              <div className="max-h-64 space-y-3 overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"}`}>
                    {m.content}
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
