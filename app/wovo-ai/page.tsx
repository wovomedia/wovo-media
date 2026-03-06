"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { clearSession, parseSessionFromHash, persistSession, readSessionFromStorage } from "@/lib/supabase/session-client";
import { submitPendingOnboarding } from "@/lib/wovo-ai/onboarding-client";
import { resolveAiAccessState } from "@/lib/wovo-ai/access";
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
};

const quickActions = [
  "Inspire me",
  "What's trending in my industry?",
  "I need a campaign idea",
  "How can I boost engagement?",
  "Draft a TikTok script",
  "Write an Instagram post",
  "Draft a posting schedule for next month",
] as const;

const captionPlatforms: Array<{ value: CaptionPlatform; label: string }> = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
];

const modeOptions: Array<{ value: WovoMode; label: string }> = [
  { value: "chat", label: "Chat" },
  { value: "caption", label: "Caption" },
  { value: "ideas", label: "Ideas" },
  { value: "engagement", label: "Engagement" },
  { value: "calendar", label: "Calendar" },
  { value: "image", label: "Image" },
  { value: "caption_image", label: "Caption + Image" },
];

type StoredAssistantPayload = {
  text: string;
  image?: string;
  imagePrompt?: string;
};

const assistantPayloadPrefix = "__WOVO_ASSISTANT_JSON__";

function serializeAssistantPayload(payload: StoredAssistantPayload): string {
  return `${assistantPayloadPrefix}${JSON.stringify(payload)}`;
}

function deserializeAssistantPayload(content: string): StoredAssistantPayload {
  if (!content.startsWith(assistantPayloadPrefix)) {
    return { text: content };
  }

  try {
    return JSON.parse(content.slice(assistantPayloadPrefix.length)) as StoredAssistantPayload;
  } catch {
    return { text: content };
  }
}

const planOptions: PlanOption[] = [
  {
    name: "Starter",
    price: "$24.99/mo",
    credits: "50 credits",
    priceId: "price_1T76wyFmIvQosWF9UoGSKAe2",
    badge: null,
    perks: ["50 AI credits / month", "Caption generator", "Basic image prompts", "Standard speed"],
  },
  {
    name: "Growth",
    price: "$49.99/mo",
    credits: "150 credits",
    priceId: "price_1T76wSFmIvQosWF9u3GWCWBV",
    badge: null,
    perks: ["150 AI credits / month", "Everything in Starter", "Faster generations", "Saved chats"],
  },
  {
    name: "Pro",
    price: "$99/mo",
    credits: "300 credits",
    priceId: "price_1T76vlFmIvQosWF9gmdPrCVT",
    badge: "Most Benefits",
    perks: ["300 AI credits / month", "Priority AI generations", "Best value per credit", "Advanced templates", "Brand voice presets", "Priority support"],
  },
];

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
  const [mode, setMode] = useState<WovoMode>("chat");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<CaptionPlatform | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [businessContext, setBusinessContext] = useState<BusinessContext>(EMPTY_BUSINESS_CONTEXT);
  const [showLowCreditPrompt, setShowLowCreditPrompt] = useState(false);

  const authedFetch = async (input: string, init?: RequestInit) => {
    const nextHeaders = new Headers(init?.headers);
    nextHeaders.set("Authorization", `Bearer ${token}`);
    if (init?.body && !(init.body instanceof FormData) && !nextHeaders.has("Content-Type")) {
      nextHeaders.set("Content-Type", "application/json");
    }
    return fetch(input, { ...init, headers: nextHeaders });
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
    const onboard = (await onboardRes.json()) as { complete?: boolean };
    if (!onboard.complete) return router.push("/signup");

    const subData = (await subRes.json()) as UnifiedSubscriptionResponse;
    setSubscription(subData);
    setShowPlanModal(resolveAiAccessState(subData).showPaywall);
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
        const subscriptionData = data as UnifiedSubscriptionResponse;
        setSubscription(subscriptionData);
        setShowPlanModal(resolveAiAccessState(subscriptionData).showPaywall);
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
    setMessages([]);
    setPromptText("");
    setError("");
  };

  const saveMessage = async (activeChatId: string, role: "user" | "assistant", content: string) => {
    const saveRes = await authedFetch(`/api/wovo-ai/chats/${activeChatId}/messages`, {
      method: "POST",
      body: JSON.stringify({ role, content }),
    });
    const saveData = (await saveRes.json()) as { error?: string; message?: ChatMessage };
    if (!saveRes.ok || !saveData.message) {
      throw new Error(saveData.error ?? "Failed to save message.");
    }
    return saveData.message;
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const buildRequestPayload = (basePayload: Record<string, unknown>) => {
    const payloadWithPlatform = {
      ...basePayload,
      selectedPlatform,
      businessContext,
    };

    if (!attachment) {
      return {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithPlatform),
      };
    }

    const formData = new FormData();
    for (const [key, value] of Object.entries(payloadWithPlatform)) {
      formData.append(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    formData.append("referenceImage", attachment);

    return { body: formData };
  };

  const send = async () => {
    if (!promptText.trim() || !chatId || !canSend) {
      if (!hasEnoughCredits) {
        setError("Not enough credits for this action.");
      }
      return;
    }

    const inputMessage = promptText.trim();
    const activeChatId = chatId;
    const localUserId = `local-user-${Date.now()}`;

    setSending(true);
    setError("");
    setMessages((prev) => [...prev, { id: localUserId, role: "user", content: inputMessage, created_at: new Date().toISOString() }]);
    setPromptText("");
    try {
      const history = messages.map((message) => ({
        role: message.role,
        content: deserializeAssistantPayload(message.content).text,
      }));

      const userSavedMessage = await saveMessage(activeChatId, "user", inputMessage);
      setMessages((prev) => prev.map((item) => (item.id === localUserId ? userSavedMessage : item)));

      let assistantPayload: StoredAssistantPayload = { text: "" };

      if (mode === "image") {
        const imageRequest = buildRequestPayload({ prompt: inputMessage });
        const imageRes = await authedFetch("/api/wovo/image", {
          method: "POST",
          ...imageRequest,
        });
        const imageData = (await imageRes.json()) as { error?: string; image?: string };
        if (!imageRes.ok || !imageData.image) {
          throw new Error(imageData.error ?? "Failed to generate image.");
        }
        assistantPayload = {
          text: "Here is your generated marketing image:",
          image: imageData.image,
        };
      } else if (mode === "caption_image") {
        const captionImageRequest = buildRequestPayload({ prompt: inputMessage });
        const captionImageRes = await authedFetch("/api/wovo/caption-image", {
          method: "POST",
          ...captionImageRequest,
        });
        const captionImageData = (await captionImageRes.json()) as { error?: string; caption?: string; imagePrompt?: string; image?: string };
        if (!captionImageRes.ok || !captionImageData.caption || !captionImageData.image) {
          throw new Error(captionImageData.error ?? "Failed to generate caption and image.");
        }
        assistantPayload = {
          text: captionImageData.caption,
          imagePrompt: captionImageData.imagePrompt,
          image: captionImageData.image,
        };
      } else {
        const chatRequest = buildRequestPayload({ message: inputMessage, history, mode });
        const chatRes = await authedFetch("/api/wovo/chat", {
          method: "POST",
          ...chatRequest,
        });
        const chatData = (await chatRes.json()) as { error?: string; reply?: string };
        if (!chatRes.ok || !chatData.reply) {
          throw new Error(chatData.error ?? "Failed to generate response.");
        }
        assistantPayload = { text: chatData.reply };
      }

      const assistantSaved = await saveMessage(activeChatId, "assistant", serializeAssistantPayload(assistantPayload));
      setMessages((prev) => [...prev, assistantSaved]);

      clearAttachment();
      const subRes = await authedFetch("/api/wovo-ai/subscription");
      setSubscription((await subRes.json()) as UnifiedSubscriptionResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      const messagesRes = await authedFetch(`/api/wovo-ai/chats/${activeChatId}/messages`);
      setMessages(((await messagesRes.json()) as { messages: ChatMessage[] }).messages ?? []);
    } finally {
      setSending(false);
    }
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!canSend) return;
      void send();
    }
  };

  const creditsRemaining = subscription?.remaining_credits ?? subscription?.remainingCredits ?? subscription?.remaining?.credits_remaining ?? 0;
  const requiredCredits = getPromptCreditCost(mode);
  const hasEnoughCredits = userHasEnoughCredits(creditsRemaining, mode);
  const canSend = hasEnoughCredits && !sending;
  const creditTone = getCreditTone(creditsRemaining);
  const toneClasses =
    creditTone === "green"
      ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-200"
      : creditTone === "yellow"
        ? "border-amber-300/60 bg-amber-500/15 text-amber-200"
        : "border-red-300/60 bg-red-500/15 text-red-200";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = "wovo-low-credit-alert-seen";
    const alreadySeen = window.sessionStorage.getItem(storageKey) === "1";

    if (creditsRemaining <= 10 && !alreadySeen) {
      setShowLowCreditPrompt(true);
      window.sessionStorage.setItem(storageKey, "1");
    }
  }, [creditsRemaining]);

  const filteredChats = useMemo(() => chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())), [chats, search]);

  const beginRename = () => {
    if (!chatId) return;
    const selected = chats.find((chat) => chat.id === chatId);
    if (!selected) return;
    setRenameChatId(chatId);
    setRenameValue(selected.title || "");
  };

  const saveRename = async () => {
    if (!renameChatId) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed.length > 60) {
      setError("Chat name must be between 1 and 60 characters.");
      return;
    }

    try {
      const response = await authedFetch(`/api/wovo-ai/chats/${renameChatId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed }),
      });
      const payload = (await response.json()) as { error?: string; chat?: ChatSummary };
      if (!response.ok || !payload.chat) {
        throw new Error(payload.error ?? "Unable to rename chat.");
      }
      setChats((prev) => prev.map((chat) => (chat.id === renameChatId ? { ...chat, title: payload.chat?.title ?? trimmed } : chat)));
      setRenameChatId(null);
      setRenameValue("");
      setError("");
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Unable to rename chat.");
    }
  };

  const deleteChat = async (chatToDeleteId: string) => {
    try {
      const response = await authedFetch(`/api/wovo-ai/chats/${chatToDeleteId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete chat.");
      }

      const remainingChats = chats.filter((chat) => chat.id !== chatToDeleteId);
      setChats(remainingChats);

      if (renameChatId === chatToDeleteId) {
        setRenameChatId(null);
        setRenameValue("");
      }

      if (chatId === chatToDeleteId) {
        if (remainingChats.length > 0) {
          setChatId(remainingChats[0].id);
        } else {
          await createChat();
        }
      }

      setError("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete chat.");
    }
  };

  const handleQuickActionSelect = (selectedAction: (typeof quickActions)[number]) => {
    setPromptText(selectedAction);
  };



  const goToBuyCredits = () => {
    router.push("/wovo-ai/buy-credits");
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
    <main className="min-h-screen bg-[#060807] text-white">
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
          <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0d1110] p-6 text-white shadow-xl">
            <h2 className="mb-2 text-xl font-semibold">Choose your Wovo AI plan</h2>
            <p className="mb-6 text-zinc-400">Pick a plan to start generating AI content. Your account stays locked until an active subscription is detected.</p>
            <div className="grid gap-4 md:grid-cols-3">
              {planOptions.map((plan) => (
                <article key={plan.priceId} className={`rounded-xl border p-4 ${plan.name === "Pro" ? "border-emerald-400/80 bg-emerald-500/10" : "border-white/10 bg-black/30"}`}>
                  {plan.badge && (<p className="mb-2 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-black">{plan.badge}</p>)}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-zinc-200">{plan.price}</p>
                  <p className="text-sm text-zinc-400">{plan.credits}</p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300">{plan.perks.map((perk) => <li key={perk}>• {perk}</li>)}</ul>
                  <button className="mt-4 w-full rounded-lg bg-emerald-400 py-2 font-semibold text-black hover:bg-emerald-300" onClick={() => void startCheckout(plan.priceId)}>
                    Choose {plan.name}
                  </button>
                </article>
              ))}
            </div>
            <p className="mt-5 text-xs text-zinc-500">Already paid? Refresh after checkout and you’ll be unlocked automatically.</p>
          </div>
        </div>
      )}
      <div className="min-h-screen">
        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">Wovo AI</h1>
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">Beta</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void createChat()} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-white/10">+ New chat</button>
              <details className="relative">
                <summary className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100">Account</summary>
                <div className="absolute right-0 z-20 mt-2 w-56 space-y-1 rounded-xl border border-white/10 bg-[#111313] p-2 text-sm shadow-xl">
                  <p className="rounded px-2 py-1 text-xs text-zinc-400">Credits left: {creditsRemaining}</p>
                  <Link href="/wovo-ai/profile" className="block rounded px-2 py-1 hover:bg-white/10">Profile</Link>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={goToBuyCredits}>Buy credits</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => void authedFetch("/api/stripe/portal", { method: "POST" }).then((r) => r.json()).then((d: { url?: string }) => d.url && (window.location.href = d.url))}>Manage billing</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={async () => { const v = window.prompt("Type DELETE to confirm"); if (v === "DELETE") { await authedFetch("/api/account/delete", { method: "POST" }); clearSession(); router.push("/"); } }}>Delete account</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={async () => { const email = window.prompt("New email"); if (email) await authedFetch("/api/account/change-email", { method: "POST", body: JSON.stringify({ email }) }); }}>Change email</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={async () => { const password = window.prompt("New password"); if (password) await authedFetch("/api/account/change-password", { method: "POST", body: JSON.stringify({ password }) }); }}>Change password</button>
                  <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => { clearSession(); router.push("/login"); }}>Sign out</button>
                </div>
              </details>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">
            <h2 className="text-center text-4xl font-semibold">How can Wovo AI help?</h2>
            <p className="mt-2 text-center text-sm text-zinc-400">Create content, generate visuals, and keep your campaigns moving.</p>
            <div className="mt-7 rounded-2xl border border-white/10 bg-[#101212] p-5 shadow-2xl shadow-black/20">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setAttachment(f);
                }}
              />
              <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} onKeyDown={onKey} placeholder="Ask Wovo AI a question" className="h-24 w-full resize-none border-none bg-transparent text-lg text-white outline-none placeholder:text-zinc-500" />
              {attachment && (
                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                  <span className="font-medium text-emerald-200">Reference image added:</span>
                  <span className="max-w-[190px] truncate text-zinc-100 sm:max-w-xs">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="rounded-full px-1 text-zinc-300 hover:bg-white/10 hover:text-white"
                    aria-label="Remove reference image"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <select value={mode} onChange={(e) => setMode(e.target.value as WovoMode)} className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-medium text-zinc-100">
                    {modeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:border-emerald-400/50 hover:bg-white/10"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add reference image or logo"
                    title="Add reference image or logo"
                  >
                    <span aria-hidden>📎</span>
                    <span className="hidden sm:inline">Add Reference</span>
                  </button>
                  <button type="button" className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10" aria-label="Voice input">
                    🎤
                  </button>
                </div>
                <div className={`rounded-full border px-3 py-2 text-sm font-semibold ${toneClasses}`}>
                  {creditsRemaining} credits
                </div>
                {!hasEnoughCredits ? (
                  <button
                    type="button"
                    onClick={goToBuyCredits}
                    className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
                  >
                    Buy Credits
                  </button>
                ) : (
                  <button onClick={() => void send()} disabled={!canSend} className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50">{sending ? "..." : "Send"}</button>
                )}
              </div>

              <details className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200">
                  Optional Business Context
                </summary>
                <p className="mt-1 text-xs text-zinc-400">Add business details to get more accurate captions and visuals.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <input
                    value={businessContext.businessName}
                    onChange={(event) => setBusinessContext((prev) => ({ ...prev, businessName: event.target.value }))}
                    placeholder="Enter business name"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0d0d] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                    aria-label="Business Name"
                  />
                  <input
                    value={businessContext.phoneNumber}
                    onChange={(event) => setBusinessContext((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                    placeholder="Enter phone number"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0d0d] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                    aria-label="Phone Number"
                  />
                  <input
                    value={businessContext.email}
                    onChange={(event) => setBusinessContext((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="Enter email"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0d0d] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                    aria-label="Email"
                  />
                  <input
                    value={businessContext.businessDescription}
                    onChange={(event) => setBusinessContext((prev) => ({ ...prev, businessDescription: event.target.value }))}
                    placeholder="Describe the business"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0d0d] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 sm:col-span-2"
                    aria-label="Business Description"
                  />
                  <input
                    value={businessContext.location}
                    onChange={(event) => setBusinessContext((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder="Enter location"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0d0d] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                    aria-label="Business Location"
                  />
                  <input
                    value={businessContext.serviceLocation}
                    onChange={(event) => setBusinessContext((prev) => ({ ...prev, serviceLocation: event.target.value }))}
                    placeholder="Enter service area"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0d0d] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                    aria-label="Service Area"
                  />
                </div>
              </details>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 px-3 py-3 sm:px-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-300">Optional Caption Platform</p>
              <p className="mt-1 text-[11px] text-zinc-500">Tailor captions for a specific platform.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {captionPlatforms.map((platform) => {
                  const active = selectedPlatform === platform.value;
                  return (
                    <button
                      key={platform.value}
                      type="button"
                      onClick={() => setSelectedPlatform((prev) => (prev === platform.value ? null : platform.value))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-emerald-400/80 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]"
                          : "border-white/15 bg-[#121515] text-zinc-100 hover:border-emerald-400/50 hover:text-emerald-200"
                      }`}
                      aria-pressed={active}
                    >
                      {platform.label}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {quickActions.map((q) => (
                <button key={q} onClick={() => handleQuickActionSelect(q)} className="rounded-full border border-white/10 bg-[#111313] px-5 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-400/70 hover:text-emerald-300">
                  {q}
                </button>
              ))}
            </div>

            <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-white/10 bg-[#101212] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-300">Chats</h3>
                  <button
                    type="button"
                    onClick={beginRename}
                    disabled={!chatId}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Rename
                  </button>
                </div>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500" />
                <div className="max-h-[54vh] space-y-2 overflow-y-auto pr-1">
                  {filteredChats.map((chat) => (
                    <div key={chat.id} className={`group flex items-center gap-2 rounded-lg border px-2 py-2 text-sm transition ${chat.id === chatId ? "border-emerald-400/70 bg-emerald-500/10" : "border-white/5 bg-black/30 hover:border-white/20 hover:bg-white/5"}`}>
                      <button onClick={() => setChatId(chat.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-zinc-100">{chat.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteChat(chat.id);
                        }}
                        className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                        aria-label={`Delete ${chat.title}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </aside>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-[#101212] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-300">Conversation</h3>
                  {renameChatId && (
                    <input
                      value={renameValue}
                      maxLength={60}
                      autoFocus
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={() => void saveRename()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveRename();
                        }
                        if (event.key === "Escape") {
                          setRenameChatId(null);
                          setRenameValue("");
                        }
                      }}
                      className="w-56 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs text-zinc-100"
                      placeholder="Rename chat"
                    />
                  )}
                </div>
                <div className="h-[65vh] min-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-white/5 bg-black/25 p-4 lg:h-[70vh] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
                  {messages.map((m) => (
                    <div key={m.id} className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto border border-emerald-400/40 bg-emerald-500/15 text-emerald-50" : "border border-white/10 bg-[#151819] text-zinc-100"}`}>
                    {(() => {
                      const payload = deserializeAssistantPayload(m.content);
                      return (
                        <>
                          {payload.text}
                          {payload.imagePrompt && <p className="mt-2 text-xs text-zinc-400">Image prompt: {payload.imagePrompt}</p>}
                          {payload.image && (
                            <img
                              src={payload.image}
                              alt="Generated marketing visual"
                              className="mt-3 h-auto max-w-full rounded-xl border border-white/10 object-cover"
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))}
                  {messages.length === 0 && <p className="text-sm text-zinc-500">Start a conversation to generate content with Wovo AI.</p>}
                </div>
              </section>
              </div>

            {!hasEnoughCredits && (
              <p className="mt-3 text-sm text-amber-300">
                {creditsRemaining <= 0 ? "You are out of credits. Buy credits to continue sending." : `Not enough credits for this action. This mode requires ${requiredCredits} credits.`}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </div>
        </section>
      </div>

      {showLowCreditPrompt && (
        <div className="fixed bottom-6 right-6 z-40 w-full max-w-xs rounded-xl border border-amber-400/30 bg-[#111313] p-4 shadow-xl">
          <p className="text-sm font-semibold text-zinc-100">You're running low on credits.</p>
          <p className="mt-1 text-xs text-zinc-400">Top up now to keep generating content.</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={goToBuyCredits}
              className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-emerald-300"
            >
              Buy Credits
            </button>
            <button
              type="button"
              onClick={() => setShowLowCreditPrompt(false)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
