"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { clearSession, parseSessionFromHash, persistSession, readSessionFromStorage } from "@/lib/supabase/session-client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

type ChatSummary = { id: string; title: string; created_at: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

const quickActions = ["Caption", "Facebook Post", "Instagram Caption", "Ad Copy", "Generate Image"] as const;

export default function WovoAiPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UnifiedSubscriptionResponse | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<(typeof quickActions)[number]>("Caption");

  const authedFetch = async (input: string, init?: RequestInit) => fetch(input, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });

  const load = async (accessToken: string) => {
    setToken(accessToken);
    supabase.setAccessToken(accessToken);
    const [subRes, chatsRes, onboardRes] = await Promise.all([
      fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch("/api/wovo-ai/chats", { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch("/api/wovo-ai/onboarding", { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    const onboard = (await onboardRes.json()) as { complete?: boolean };
    if (!onboard.complete) return router.push("/signup");

    setSubscription((await subRes.json()) as UnifiedSubscriptionResponse);
    const chatPayload = (await chatsRes.json()) as { chats: ChatSummary[] };
    setChats(chatPayload.chats ?? []);
    setChatId(chatPayload.chats?.[0]?.id ?? null);
  };

  useEffect(() => {
    const fromHash = parseSessionFromHash(window.location.hash);
    if (fromHash) {
      persistSession(fromHash);
      window.history.replaceState({}, document.title, "/wovo-ai");
      void load(fromHash.access_token);
      return;
    }
    const s = readSessionFromStorage();
    if (!s?.access_token) return router.push("/login");
    void load(s.access_token);
  }, [router]);

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
    if (!prompt.trim() || !chatId || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await authedFetch("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: prompt, chatId, quickAction: action.toLowerCase().replace(" ", "") }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPrompt("");
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

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[300px,1fr]">
        <aside className="rounded-2xl border border-emerald-400/25 bg-zinc-950 p-3">
          <button onClick={() => void createChat()} className="mb-3 w-full rounded-xl bg-emerald-400 py-2 font-semibold text-black">+ New Chat</button>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="mb-3 w-full rounded-xl border border-white/20 bg-black p-2" />
          <div className="mb-3 flex flex-wrap gap-2">
            {quickActions.map((q) => <button key={q} onClick={() => setAction(q)} className={`rounded-full px-3 py-1 text-xs ${action === q ? "bg-emerald-400 text-black" : "border border-white/20"}`}>{q}</button>)}
          </div>
          <div className="space-y-2">
            {filteredChats.map((chat) => <button key={chat.id} onClick={() => setChatId(chat.id)} className={`w-full rounded-lg p-2 text-left text-sm ${chat.id === chatId ? "bg-emerald-400/20" : "bg-white/5"}`}>{chat.title}</button>)}
          </div>
        </aside>

        <section className="rounded-2xl border border-emerald-400/25 bg-zinc-950 p-4">
          <header className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h1 className="text-xl font-semibold">Wovo AI</h1>
              <p className="text-xs text-white/70">Remaining credits: {subscription?.remaining.credits_remaining ?? 0}</p>
            </div>
            <details className="relative">
              <summary className="cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-sm">Account</summary>
              <div className="absolute right-0 z-20 mt-2 w-56 space-y-1 rounded-xl border border-white/15 bg-black p-2 text-sm">
                <Link href="/wovo-ai/pricing" className="block rounded px-2 py-1 hover:bg-white/10">Upgrade plan</Link>
                <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => void authedFetch("/api/stripe/buy-credits", { method: "POST" }).then((r) => r.json()).then((d: { url?: string }) => d.url && (window.location.href = d.url))}>Buy credits</button>
                <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => void authedFetch("/api/stripe/portal", { method: "POST" }).then((r) => r.json()).then((d: { url?: string }) => d.url && (window.location.href = d.url))}>Manage billing</button>
                <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={async () => { const v = prompt("Type DELETE to confirm"); if (v === "DELETE") { await authedFetch("/api/account/delete", { method: "POST" }); clearSession(); router.push("/"); } }}>Delete account</button>
                <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={async () => { const email = prompt("New email"); if (email) await authedFetch("/api/account/change-email", { method: "POST", body: JSON.stringify({ email }) }); }}>Change email</button>
                <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={async () => { const password = prompt("New password"); if (password) await authedFetch("/api/account/change-password", { method: "POST", body: JSON.stringify({ password }) }); }}>Change password</button>
                <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => { clearSession(); router.push("/login"); }}>Sign out</button>
              </div>
            </details>
          </header>

          <div className="h-[60vh] space-y-3 overflow-y-auto rounded-xl bg-black p-3">
            {messages.map((m) => <div key={m.id} className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-emerald-500/20" : "border border-white/10 bg-zinc-900"}`}>{m.content}</div>)}
          </div>
          <div className="mt-3 flex gap-2">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={onKey} placeholder="Ask Wovo AI..." className="w-full rounded-xl border border-white/20 bg-black p-3" />
            <button onClick={() => void send()} disabled={sending} className="rounded-xl bg-emerald-400 px-6 font-semibold text-black">{sending ? "..." : "Send"}</button>
          </div>
          {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        </section>
      </div>
    </main>
  );
}
