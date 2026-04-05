"use client";

import Link from "next/link";
import WovoLogo from "@/components/ui/wovo-logo";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { clearSession, parseSessionFromHash, persistSession, readSessionFromStorage } from "@/lib/supabase/session-client";
import { submitPendingOnboarding } from "@/lib/wovo-ai/onboarding-client";
import { getAuthAccessState, resolveAiAccessState } from "@/lib/wovo-ai/access";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { EMPTY_BUSINESS_CONTEXT, type BusinessContext } from "@/lib/wovo-ai/business-context";
import type { CaptionPlatform } from "@/lib/wovo-ai/prompt-context";
import { getCreditTone, getPromptCreditCost, userHasEnoughCredits } from "@/lib/wovo-ai/usage";

type ChatSummary = { id: string; title: string; created_at: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };
type WovoMode = "chat" | "caption" | "ideas" | "engagement" | "calendar" | "image" | "caption_image";
type PlanOption = {
  name: string;
  price: string;
  credits: string;
  priceId: string;
  badge?: string | null;
  perks: string[];
  trialLabel: string;
};

const quickActions = [
  "Write a caption for today's special",
  "Generate a marketing image",
  "What's trending in my industry?",
  "I need a campaign idea",
  "Draft a TikTok script",
  "Write an Instagram post",
  "Plan next month's content calendar",
  "How do I boost engagement?",
] as const;

const captionPlatforms: Array<{ value: CaptionPlatform; label: string; icon: string }> = [
  { value: "facebook",  label: "Facebook",  icon: "f" },
  { value: "instagram", label: "Instagram", icon: "ig" },
  { value: "tiktok",    label: "TikTok",    icon: "tt" },
  { value: "youtube",   label: "YouTube",   icon: "yt" },
];

const modeOptions: Array<{ value: WovoMode; label: string; icon: string; desc: string }> = [
  { value: "chat",          label: "Chat",          icon: "💬", desc: "General AI assistant" },
  { value: "caption",       label: "Caption",       icon: "✍️", desc: "Write a social caption" },
  { value: "caption_image", label: "Caption + Image", icon: "🖼️", desc: "Caption AND image together" },
  { value: "image",         label: "Image Only",    icon: "🎨", desc: "Generate a marketing image" },
  { value: "ideas",         label: "Ideas",         icon: "💡", desc: "Content ideas & strategies" },
  { value: "engagement",    label: "Engagement",    icon: "📈", desc: "Boost likes & comments" },
  { value: "calendar",      label: "Calendar",      icon: "📅", desc: "Monthly posting plan" },
];

type StoredAssistantPayload = { text: string; image?: string; imagePrompt?: string };
const assistantPayloadPrefix = "__WOVO_ASSISTANT_JSON__";
function serializeAssistantPayload(p: StoredAssistantPayload) { return `${assistantPayloadPrefix}${JSON.stringify(p)}`; }
function deserializeAssistantPayload(content: string): StoredAssistantPayload {
  if (!content.startsWith(assistantPayloadPrefix)) return { text: content };
  try { return JSON.parse(content.slice(assistantPayloadPrefix.length)) as StoredAssistantPayload; }
  catch { return { text: content }; }
}

const planOptions: PlanOption[] = [
  {
    name: "Starter",
    price: "$24.99/mo",
    credits: "50 credits",
    priceId: "price_1T76wyFmIvQosWF9UoGSKAe2",
    badge: null,
    trialLabel: "7-day free trial",
    perks: ["50 AI credits / month", "Caption generator", "AI image generation", "Business network access", "7-day FREE trial"],
  },
  {
    name: "Growth",
    price: "$49.99/mo",
    credits: "150 credits",
    priceId: "price_1T76wSFmIvQosWF9u3GWCWBV",
    badge: "Most Popular",
    trialLabel: "7-day free trial",
    perks: ["150 AI credits / month", "Everything in Starter", "Caption + Image together", "Saved chats", "Business network + messaging"],
  },
  {
    name: "Pro",
    price: "$99/mo",
    credits: "300 credits",
    priceId: "price_1T76vlFmIvQosWF9gmdPrCVT",
    badge: "Best Value",
    trialLabel: "7-day free trial",
    perks: ["300 AI credits / month", "Priority AI generation", "Advanced brand voice", "Best value per credit", "Priority support"],
  },
];

export default function WovoAiPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [subscription, setSubscription] = useState<UnifiedSubscriptionResponse | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<WovoMode>("caption_image");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<CaptionPlatform | null>("instagram");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [businessContext, setBusinessContext] = useState<BusinessContext>(EMPTY_BUSINESS_CONTEXT);
  const [showLowCreditPrompt, setShowLowCreditPrompt] = useState(false);
  const [showModePanel, setShowModePanel] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(false);

  const handlePaywallBack = () => router.push("/");
  const handlePaywallSignOut = async () => { await supabase.auth.signOut(); clearSession(); router.push("/login"); };

  const authedFetch = async (input: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    h.set("Authorization", `Bearer ${token}`);
    if (init?.body && !(init.body instanceof FormData) && !h.has("Content-Type")) h.set("Content-Type", "application/json");
    return fetch(input, { ...init, headers: h });
  };

  const load = async (accessToken: string) => {
    setToken(accessToken);
    supabase.setAccessToken(accessToken);
    await submitPendingOnboarding(accessToken);
    const [subRes, chatsRes, onboardRes] = await Promise.all([
      fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
      fetch("/api/wovo-ai/chats", { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch("/api/wovo-ai/onboarding", { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    if (onboardRes.status === 401) return router.push("/login");
    let onboard: { complete?: boolean; is_google_user?: boolean } | null = null;
    if (onboardRes.ok) onboard = (await onboardRes.json()) as { complete?: boolean; is_google_user?: boolean };
    if (onboard && !onboard.complete && !onboard.is_google_user) return router.push("/wovo-ai/profile");
    const subData = (await subRes.json()) as UnifiedSubscriptionResponse;
    const accessState = resolveAiAccessState(subData);
    const serverShowPaywall = subData.show_paywall ?? accessState.showPaywall;
    setSubscription(subData);
    setShowPlanModal(serverShowPaywall);
    setLoadingPlan(false);
    const chatPayload = (await chatsRes.json()) as { chats: ChatSummary[] };
    setChats(chatPayload.chats ?? []);
    setChatId(chatPayload.chats?.[0]?.id ?? null);
  };

  useEffect(() => {
    let mounted = true;
    const checkPlan = async () => {
      const session = readSessionFromStorage();
      const authState = getAuthAccessState({ session });
      if (!authState.isAuthenticated || !session?.access_token) { if (mounted) { setShowPlanModal(false); setLoadingPlan(false); } router.push("/login"); return; }
      try {
        const res = await fetch("/api/wovo-ai/subscription", { cache: "no-store", headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.status === 401) { if (mounted) { setShowPlanModal(false); setLoadingPlan(false); } router.push("/login"); return; }
        const data = (await res.json()) as UnifiedSubscriptionResponse;
        if (!mounted) return;
        const nextAuthState = getAuthAccessState({ session, subscription: data });
        setSubscription(data);
        setShowPlanModal(data.show_paywall ?? nextAuthState.showPaywall);
      } catch { if (mounted) setShowPlanModal(true); }
      finally { if (mounted) setLoadingPlan(false); }
    };
    void checkPlan();
    const fromHash = parseSessionFromHash(window.location.hash);
    if (fromHash) { persistSession(fromHash); window.history.replaceState({}, document.title, "/wovo-ai"); void load(fromHash.access_token).catch(() => { if (mounted) setLoadingPlan(false); }); return; }
    const s = readSessionFromStorage();
    if (!s?.access_token) return;
    void load(s.access_token).catch(() => { if (mounted) setLoadingPlan(false); });
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    document.body.style.overflow = showPlanModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPlanModal]);

  useEffect(() => {
    if (!chatId || !token) return;
    void authedFetch(`/api/wovo-ai/chats/${chatId}/messages`).then(r => r.json()).then((d: { messages: ChatMessage[] }) => setMessages(d.messages ?? []));
  }, [chatId, token]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const createChat = async () => {
    const res = await authedFetch("/api/wovo-ai/chats", { method: "POST", body: JSON.stringify({ title: "New Chat" }) });
    const data = (await res.json()) as { chat: ChatSummary };
    setChats(prev => [data.chat, ...prev]);
    setChatId(data.chat.id);
    setMessages([]); setPromptText(""); setError("");
  };

  const saveMessage = async (activeChatId: string, role: "user" | "assistant", content: string) => {
    const r = await authedFetch(`/api/wovo-ai/chats/${activeChatId}/messages`, { method: "POST", body: JSON.stringify({ role, content }) });
    const d = (await r.json()) as { error?: string; message?: ChatMessage };
    if (!r.ok || !d.message) throw new Error(d.error ?? "Failed to save message.");
    return d.message;
  };

  const clearAttachment = () => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const buildRequestPayload = (basePayload: Record<string, unknown>) => {
    const full = { ...basePayload, selectedPlatform, businessContext };
    if (!attachment) return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(full) };
    const fd = new FormData();
    for (const [k, v] of Object.entries(full)) fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
    fd.append("referenceImage", attachment);
    return { body: fd };
  };

  const send = async () => {
    if (!promptText.trim() || !chatId || !canSend) { if (!hasEnoughCredits) setError("Not enough credits. Buy more to continue."); return; }
    const inputMessage = promptText.trim();
    const activeChatId = chatId;
    const localId = `local-user-${Date.now()}`;
    setSending(true); setError("");
    setMessages(prev => [...prev, { id: localId, role: "user", content: inputMessage, created_at: new Date().toISOString() }]);
    setPromptText("");
    try {
      const history = messages.map(m => ({ role: m.role, content: deserializeAssistantPayload(m.content).text }));
      const userMsg = await saveMessage(activeChatId, "user", inputMessage);
      setMessages(prev => prev.map(m => m.id === localId ? userMsg : m));
      let assistantPayload: StoredAssistantPayload = { text: "" };
      if (mode === "image") {
        const res = await authedFetch("/api/wovo/image", { method: "POST", ...buildRequestPayload({ prompt: inputMessage }) });
        const data = (await res.json()) as { error?: string; image?: string };
        if (!res.ok || !data.image) throw new Error(data.error ?? "Failed to generate image.");
        assistantPayload = { text: "Here is your generated marketing image:", image: data.image };
      } else if (mode === "caption_image") {
        const res = await authedFetch("/api/wovo/caption-image", { method: "POST", ...buildRequestPayload({ prompt: inputMessage }) });
        const data = (await res.json()) as { error?: string; caption?: string; imagePrompt?: string; image?: string };
        if (!res.ok || !data.caption || !data.image) throw new Error(data.error ?? "Failed.");
        assistantPayload = { text: data.caption, imagePrompt: data.imagePrompt, image: data.image };
      } else {
        const res = await authedFetch("/api/wovo/chat", { method: "POST", ...buildRequestPayload({ message: inputMessage, history, mode }) });
        const data = (await res.json()) as { error?: string; reply?: string };
        if (!res.ok || !data.reply) throw new Error(data.error ?? "Failed.");
        assistantPayload = { text: data.reply };
      }
      const saved = await saveMessage(activeChatId, "assistant", serializeAssistantPayload(assistantPayload));
      setMessages(prev => [...prev, saved]);
      clearAttachment();
      const subRes = await authedFetch("/api/wovo-ai/subscription");
      setSubscription((await subRes.json()) as UnifiedSubscriptionResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      const r = await authedFetch(`/api/wovo-ai/chats/${activeChatId}/messages`);
      setMessages(((await r.json()) as { messages: ChatMessage[] }).messages ?? []);
    } finally { setSending(false); }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) void send(); }
  };

  const creditsRemaining = subscription?.remaining?.credits_remaining ?? 0;
  const totalCredits = Math.max(subscription?.remaining?.monthly_limit ?? 50, 1);
  const usagePercent = Math.min((creditsRemaining / totalCredits) * 100, 100);
  const progressTone = usagePercent > 60 ? "bg-emerald-400" : usagePercent > 25 ? "bg-amber-400" : "bg-red-400";
  const requiredCredits = getPromptCreditCost(mode);
  const hasEnoughCredits = userHasEnoughCredits(creditsRemaining, mode);
  const canSend = hasEnoughCredits && !sending;
  const creditTone = getCreditTone(creditsRemaining);
  const toneClasses = creditTone === "green" ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-200" : creditTone === "yellow" ? "border-amber-300/60 bg-amber-500/15 text-amber-200" : "border-red-300/60 bg-red-500/15 text-red-200";
  const filteredChats = useMemo(() => chats.filter(c => c.title.toLowerCase().includes(search.toLowerCase())), [chats, search]);

  const beginRename = () => { if (!chatId) return; const s = chats.find(c => c.id === chatId); if (!s) return; setRenameChatId(chatId); setRenameValue(s.title ?? ""); };
  const saveRename = async () => {
    if (!renameChatId) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed.length > 60) { setError("Chat name must be 1–60 characters."); return; }
    try {
      const r = await authedFetch(`/api/wovo-ai/chats/${renameChatId}`, { method: "PATCH", body: JSON.stringify({ title: trimmed }) });
      const p = (await r.json()) as { error?: string; chat?: ChatSummary };
      if (!r.ok || !p.chat) throw new Error(p.error ?? "Unable to rename.");
      setChats(prev => prev.map(c => c.id === renameChatId ? { ...c, title: p.chat?.title ?? trimmed } : c));
      setRenameChatId(null); setRenameValue(""); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to rename."); }
  };

  const deleteChat = async (id: string) => {
    try {
      const r = await authedFetch(`/api/wovo-ai/chats/${id}`, { method: "DELETE" });
      const p = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(p.error ?? "Unable to delete.");
      const remaining = chats.filter(c => c.id !== id);
      setChats(remaining);
      if (renameChatId === id) { setRenameChatId(null); setRenameValue(""); }
      if (chatId === id) { if (remaining.length > 0) setChatId(remaining[0].id); else await createChat(); }
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete."); }
  };

  const startCheckout = async (priceId: string) => {
    if (!token) return;
    const r = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ priceId, trial_period_days: 7 }) });
    const { url } = (await r.json()) as { url: string };
    if (url) window.location.href = url;
  };

  const goToBuyCredits = () => router.push("/wovo-ai/buy-credits");
  const currentMode = modeOptions.find(m => m.value === mode)!;

  if (loadingPlan) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060807]">
        <div className="text-center">
          <WovoLogo variant="ai" size={160} className="mx-auto mb-4" />
          <div className="text-zinc-400 text-sm">Loading your account...</div>
          <div className="mt-4 h-1 w-48 mx-auto bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{width:'60%'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#060807] text-white">
      {/* ─── PAYWALL MODAL ─── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1110] p-5 text-white shadow-2xl sm:p-7">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_60%)]" />
            <div className="mb-5 flex items-center justify-between gap-3">
              <button type="button" onClick={handlePaywallBack} className="rounded-full border border-white/15 bg-transparent px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5">← Back</button>
              <button type="button" onClick={() => void handlePaywallSignOut()} className="rounded-full border border-red-400/40 bg-red-500/5 px-3 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/10">Sign out</button>
            </div>
            <div className="mb-2 flex items-center gap-3">
              <WovoLogo variant="ai" size={140} />
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">Beta</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Start your 7-day free trial</h2>
            <p className="mt-1 text-zinc-400">Choose a plan — your card won't be charged until after your 7-day trial ends. Cancel anytime.</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5">
              <span className="text-emerald-400 text-lg">🎁</span>
              <p className="text-sm text-emerald-200 font-medium">7 days completely free — then your chosen plan starts. No surprise charges.</p>
            </div>
            <p className="my-4 text-xs text-zinc-500">Secure checkout powered by Stripe · Cancel before trial ends to pay nothing</p>
            <div className="grid gap-4 md:grid-cols-3">
              {planOptions.map(plan => (
                <article key={plan.priceId} className={`rounded-xl border p-4 transition hover:scale-[1.02] ${plan.badge === "Most Popular" ? "border-emerald-400/80 bg-emerald-500/10" : plan.badge === "Best Value" ? "border-violet-400/60 bg-violet-500/8" : "border-white/10 bg-black/30"}`}>
                  {plan.badge && <p className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold text-black ${plan.badge === "Most Popular" ? "bg-emerald-400" : "bg-violet-400"}`}>{plan.badge}</p>}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-2xl font-black text-white">{plan.price}</p>
                  <p className="text-xs font-semibold text-emerald-400 mb-2">{plan.trialLabel} ✓</p>
                  <p className="text-sm text-zinc-400">{plan.credits}</p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300">{plan.perks.map(p => <li key={p}>• {p}</li>)}</ul>
                  <button className={`mt-4 w-full rounded-lg py-2.5 font-bold text-black transition hover:-translate-y-0.5 ${plan.badge === "Most Popular" ? "bg-emerald-400 hover:bg-emerald-300" : "bg-white hover:bg-zinc-100"}`} onClick={() => void startCheckout(plan.priceId)}>
                    Start Free Trial →
                  </button>
                </article>
              ))}
            </div>
            <p className="mt-4 text-xs text-zinc-500 text-center">Already subscribed? Refresh the page and you'll be unlocked automatically.</p>
          </div>
        </div>
      )}

      {/* ─── APP SHELL ─── */}
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#060807]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-black text-white hover:text-emerald-400 transition">Wovo</Link>
            <span className="text-zinc-600">/</span>
            <h1 className="text-lg font-bold text-emerald-400">Wovo Media AI</h1>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wide">Beta</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Credits pill */}
            <div className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClasses}`}>
              {creditsRemaining} credits
            </div>
            <button onClick={() => void createChat()} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-white/10 transition">+ New</button>
            <Link href="/wovo-ai/network" className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition">🤝 Network</Link>
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 hover:bg-white/10">Account ▾</summary>
              <div className="absolute right-0 z-30 mt-2 w-56 space-y-1 rounded-xl border border-white/10 bg-[#111313] p-2 text-xs shadow-xl">
                <p className="rounded px-2 py-1.5 text-zinc-400">Credits: <span className="text-white font-semibold">{creditsRemaining}</span> remaining</p>
                <Link href="/wovo-ai/profile" className="block rounded px-2 py-1.5 hover:bg-white/10">Profile & Settings</Link>
                <Link href="/wovo-ai/network" className="block rounded px-2 py-1.5 hover:bg-white/10">🤝 Business Network</Link>
                <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-white/10" onClick={goToBuyCredits}>Buy Credits</button>
                <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-white/10" onClick={() => void authedFetch("/api/stripe/portal", { method: "POST" }).then(r => r.json()).then((d: { url?: string }) => d.url && (window.location.href = d.url))}>Manage Billing</button>
                <hr className="border-white/10" />
                <button className="block w-full rounded px-2 py-1.5 text-left text-red-300 hover:bg-red-500/10" onClick={() => { clearSession(); router.push("/login"); }}>Sign Out</button>
              </div>
            </details>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — chat history */}
          <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[#0a0c0b] lg:flex">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Chats</span>
              <button type="button" onClick={beginRename} disabled={!chatId} className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/10 disabled:opacity-30">Rename</button>
            </div>
            <div className="px-3 py-2">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..." className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/50" />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
              {filteredChats.map(chat => (
                <div key={chat.id} className={`group flex items-center gap-2 rounded-lg border px-2 py-2 text-xs transition ${chat.id === chatId ? "border-emerald-400/50 bg-emerald-500/10" : "border-transparent hover:border-white/10 hover:bg-white/5"}`}>
                  <button onClick={() => setChatId(chat.id)} className="min-w-0 flex-1 text-left truncate text-zinc-300">{chat.title}</button>
                  <button type="button" onClick={e => { e.stopPropagation(); void deleteChat(chat.id); }} className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-600 hover:text-red-400 transition">✕</button>
                </div>
              ))}
              {filteredChats.length === 0 && <p className="text-center text-xs text-zinc-600 py-4">No chats yet</p>}
            </div>
            {/* Credit bar */}
            <div className="border-t border-white/10 px-4 py-3">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Credits</span>
                <span>{creditsRemaining}/{totalCredits}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${progressTone}`} style={{ width: `${usagePercent}%` }} />
              </div>
              <button onClick={goToBuyCredits} className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-xs text-zinc-400 hover:border-emerald-400/50 hover:text-emerald-400 transition">+ Buy Credits</button>
            </div>
          </aside>

          {/* Center — compose + conversation */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Compose bar */}
            <div className="flex-shrink-0 border-b border-white/10 bg-[#0d0f0e] p-4">
              {/* Mode + platform row */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {/* Mode selector */}
                <div className="relative">
                  <button type="button" onClick={() => setShowModePanel(!showModePanel)} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-emerald-400/50 transition">
                    <span>{currentMode.icon}</span> {currentMode.label} ▾
                  </button>
                  {showModePanel && (
                    <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-xl border border-white/10 bg-[#111313] p-2 shadow-xl">
                      {modeOptions.map(opt => (
                        <button key={opt.value} type="button" onClick={() => { setMode(opt.value as WovoMode); setShowModePanel(false); }} className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition ${mode === opt.value ? "bg-emerald-500/15 text-emerald-200" : "hover:bg-white/5 text-zinc-300"}`}>
                          <span className="text-base">{opt.icon}</span>
                          <div><div className="text-xs font-semibold">{opt.label}</div><div className="text-[10px] text-zinc-500">{opt.desc}</div></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Platform pills */}
                <div className="flex gap-1">
                  {captionPlatforms.map(p => (
                    <button key={p.value} type="button" onClick={() => setSelectedPlatform(prev => prev === p.value ? null : p.value)} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${selectedPlatform === p.value ? "border-emerald-400/80 bg-emerald-500/15 text-emerald-200" : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Attachment button */}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 hover:border-emerald-400/50 hover:text-emerald-400 transition">📎 Reference</button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => setAttachment(e.target.files?.[0] ?? null)} />
                {/* Context toggle */}
                <button type="button" onClick={() => setShowContextPanel(!showContextPanel)} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition ${showContextPanel ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-zinc-500 hover:border-white/20"}`}>🏢 Business Info</button>
              </div>

              {/* Business context panel */}
              {showContextPanel && (
                <div className="mb-3 rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Your Business Details (makes AI smarter)</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      { key: "businessName", label: "Business Name", ph: "e.g. Boot Stompin' BBQ" },
                      { key: "phoneNumber", label: "Phone", ph: "(555) 000-0000" },
                      { key: "email", label: "Email", ph: "info@yourbiz.com" },
                      { key: "businessDescription", label: "Description", ph: "What do you do?" },
                      { key: "location", label: "Location", ph: "Columbia, TN" },
                      { key: "serviceLocation", label: "Service Area", ph: "Maury County, TN" },
                    ] as const).map(f => (
                      <input key={f.key} value={businessContext[f.key]} onChange={e => setBusinessContext(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.ph} aria-label={f.label} className="w-full rounded-lg border border-white/10 bg-[#0b0d0d] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/50" />
                    ))}
                  </div>
                </div>
              )}

              {/* Attachment pill */}
              {attachment && (
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                  <span className="font-medium">📎</span>
                  <span className="max-w-[200px] truncate">{attachment.name}</span>
                  <button type="button" onClick={clearAttachment} className="rounded-full px-1 text-zinc-400 hover:text-white">×</button>
                </div>
              )}

              {/* Textarea + send */}
              <div className="relative">
                <textarea
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={mode === "caption_image" ? "What do you want to post? (e.g. 'Weekend BBQ special, $12.99 brisket plate')" : mode === "image" ? "Describe the marketing image you want to create..." : "Ask Wovo Media AI anything about your business or content..."}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 pr-24 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50 transition"
                  rows={3}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {!hasEnoughCredits ? (
                    <button type="button" onClick={goToBuyCredits} className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-black hover:bg-amber-300 transition">Buy Credits</button>
                  ) : (
                    <button onClick={() => void send()} disabled={!canSend || !promptText.trim()} className="rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-bold text-black hover:bg-emerald-300 disabled:opacity-40 transition">
                      {sending ? "..." : mode === "caption_image" ? "✨ Generate" : mode === "image" ? "🎨 Create" : "→ Send"}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {quickActions.map(q => (
                  <button key={q} onClick={() => setPromptText(q)} className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] text-zinc-500 hover:border-emerald-400/50 hover:text-emerald-400 transition">
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center px-4">
                  <div className="text-5xl mb-4">✨</div>
                  <h2 className="text-xl font-bold text-white mb-2">How can Wovo Media AI help?</h2>
                  <p className="text-sm text-zinc-500 max-w-sm">Select a mode above, choose your platform, and start creating. Type what you want to promote and hit Generate.</p>
                  <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm">
                    {[
                      { icon: "🖼️", label: "Caption + Image", action: () => { setMode("caption_image"); setPromptText("Write a caption for my latest product and create an image"); } },
                      { icon: "✍️", label: "Just a caption", action: () => { setMode("caption"); setPromptText("Write an Instagram caption for my business"); } },
                      { icon: "💡", label: "Content ideas", action: () => { setMode("ideas"); setPromptText("Give me 10 content ideas for this week"); } },
                      { icon: "📅", label: "Monthly plan", action: () => { setMode("calendar"); setPromptText("Create a posting calendar for next month"); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:border-emerald-400/50 hover:bg-emerald-500/10 transition">
                        <div className="text-xl mb-1">{item.icon}</div>
                        <div className="text-xs font-semibold text-zinc-300">{item.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map(m => {
                const payload = deserializeAssistantPayload(m.content);
                return (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-50" : "border border-white/10 bg-[#151819] text-zinc-100"}`}>
                      {m.role === "assistant" && <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Wovo Media AI</div>}
                      <div className="whitespace-pre-wrap leading-relaxed">{payload.text}</div>
                      {payload.imagePrompt && <p className="mt-2 text-[10px] text-zinc-500 italic">Prompt: {payload.imagePrompt}</p>}
                      {payload.image && (
                        <div className="mt-3">
                          <img src={payload.image} alt="Generated" className="rounded-xl border border-white/10 max-w-full" />
                          <a href={payload.image} download="wovo-ai-image.png" className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition">⬇ Download Image</a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-[#151819] px-4 py-3 text-sm">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Wovo Media AI</div>
                    <div className="flex gap-1"><span className="animate-bounce text-emerald-400" style={{animationDelay:'0ms'}}>●</span><span className="animate-bounce text-emerald-400" style={{animationDelay:'150ms'}}>●</span><span className="animate-bounce text-emerald-400" style={{animationDelay:'300ms'}}>●</span></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Rename bar */}
            {renameChatId && (
              <div className="flex-shrink-0 border-t border-white/10 bg-[#0d0f0e] px-4 py-2 flex items-center gap-2">
                <input value={renameValue} maxLength={60} autoFocus onChange={e => setRenameValue(e.target.value)} onBlur={() => void saveRename()} onKeyDown={e => { if (e.key === "Enter") void saveRename(); if (e.key === "Escape") { setRenameChatId(null); setRenameValue(""); } }} className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-zinc-100 outline-none" placeholder="Rename this chat..." />
                <button onClick={() => void saveRename()} className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-black">Save</button>
                <button onClick={() => { setRenameChatId(null); setRenameValue(""); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400">Cancel</button>
              </div>
            )}

            {/* Error */}
            {error && <div className="flex-shrink-0 border-t border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-300">{error}</div>}
          </div>
        </div>
      </div>

      {/* Low credit toast */}
      {showLowCreditPrompt && (
        <div className="fixed bottom-6 right-6 z-40 w-full max-w-xs rounded-xl border border-amber-400/30 bg-[#111313] p-4 shadow-xl">
          <p className="text-sm font-bold text-zinc-100">Running low on credits 🔋</p>
          <p className="mt-1 text-xs text-zinc-400">Top up to keep creating content.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={goToBuyCredits} className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-300">Buy Credits</button>
            <button type="button" onClick={() => setShowLowCreditPrompt(false)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10">Later</button>
          </div>
        </div>
      )}
    </main>
  );
}
