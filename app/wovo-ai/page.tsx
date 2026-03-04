"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { supabase, type Session } from "@/lib/supabase/client";

type SupabaseAuthUser = { id: string; email?: string };
type PlanKey = "starter" | "pro" | "agency";

type Remaining = {
  credits_total: number;
  credits_remaining: number;
  weekly_limit: number;
  weekly_used: number;
};

type SubscriptionSummary = {
  status: string | null;
  plan: PlanKey | null;
  period_end: string | null;
  remaining: Remaining;
  can_generate: boolean;
  admin_access?: boolean;
  message?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  imageUrl?: string;
  result?: {
    captions: string[];
    hashtags: string;
    imagePrompt: string;
  };
};

type PlanOption = {
  key: PlanKey;
  name: string;
  price: string;
  desc: string;
  subtext?: string;
  priceId?: string;
  popular?: boolean;
};

type GenerateResponse = {
  status: string | null;
  plan: PlanKey | null;
  remaining: Remaining;
  can_generate: boolean;
  captions?: string[];
  hashtags?: string[];
  image_prompt?: string;
  image?: { url?: string } | null;
  error?: string;
  message?: string;
};

const STORAGE_KEY = "wovo-supabase-session";
const fieldClass =
  "w-full rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-400/40";
const planOrder: PlanKey[] = ["starter", "pro", "agency"];

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseSessionFromHash(hash: string): Session | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  return {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") ?? undefined,
    expires_in: params.get("expires_in") ? Number(params.get("expires_in")) : undefined,
    token_type: params.get("token_type") ?? undefined,
  };
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function formatAssistantContent(result: { captions: string[]; hashtags: string; imagePrompt: string }) {
  const captionLines = result.captions.map((caption, index) => `Caption ${index + 1}: ${caption}`);
  return [...captionLines, `Hashtags: ${result.hashtags}`, `Image prompt: ${result.imagePrompt}`].join("\n\n");
}

export default function WovoAiPage() {
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [goal, setGoal] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");

  const [generating, setGenerating] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState<PlanKey | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const planOptions: PlanOption[] = useMemo(
    () => [
      { key: "starter", name: "Starter", price: "$24.99", desc: "9 credits/month · 3/week", priceId: process.env.NEXT_PUBLIC_STARTER_PRICE_ID },
      { key: "pro", name: "Pro", price: "$49.99", desc: "18 credits/month · 6/week", priceId: process.env.NEXT_PUBLIC_PRO_PRICE_ID },
      {
        key: "agency",
        name: "Agency",
        price: "$99",
        desc: "42 credits/month · 14/week",
        subtext: "Best value for teams",
        priceId: process.env.NEXT_PUBLIC_AGENCY_PRICE_ID,
        popular: true,
      },
    ],
    [],
  );

  const withAuthHeaders = (token: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  const loadSubscription = useCallback(async (token: string) => {
    const response = await fetch("/api/wovo-ai/subscription", { headers: { Authorization: `Bearer ${token}` } });
    const payload = (await response.json()) as SubscriptionSummary & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to load subscription.");
    setSubscription(payload);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const fromHash = parseSessionFromHash(window.location.hash);
        if (fromHash) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromHash));
          window.history.replaceState({}, document.title, "/wovo-ai");
          setSession(fromHash);
          return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setSession(JSON.parse(stored) as Session);
      } finally {
        setLoadingSession(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      if (!session?.access_token) return;
      try {
        supabase.setAccessToken(session.access_token);
        const { data: userData, error: userError } = await supabase.auth.getUser(session.access_token);
        if (userError || !userData.user) throw userError ?? new Error("Unable to load user.");

        const user = userData.user as SupabaseAuthUser;
        setAuthUser(user);
        setEmail(user.email ?? "");

        await loadSubscription(session.access_token);
      } catch (err: unknown) {
        setError(mapSupabaseAuthError(err).message);
      }
    };
    void hydrate();
  }, [loadSubscription, session]);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    supabase.setAccessToken(null);
    setSession(null);
    setAuthUser(null);
    setSubscription(null);
    setMessages([]);
    setInfo("");
    setError("");
  };

  const redirectUrl = typeof window === "undefined" ? "" : `${window.location.origin}/wovo-ai`;

  const handleGoogle = async () => {
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl } });
      if (oauthError) throw oauthError;
      if (data.url) window.location.href = data.url;
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    }
  };

  const handleSignUp = async () => {
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      setInfo("Check your email to confirm your account.");
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    }
  };

  const handleSignIn = async () => {
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData.session) throw signInError ?? new Error("Unable to sign in.");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(signInData.session));
      setSession(signInData.session);
    } catch (err: unknown) {
      setError(mapSupabaseAuthError(err).message);
    }
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setInfo(successMessage);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  };

  const handlePickImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      setImageName("");
      return;
    }

    try {
      const image = await toDataUrl(file);
      setImageDataUrl(image);
      setImageName(file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load image.");
    }
  };

  const currentPlanIndex = subscription?.plan ? planOrder.indexOf(subscription.plan) : -1;

  const getPlanButtonLabel = (plan: PlanOption): string => {
    if (subscription?.plan === plan.key) return "Current plan";
    if (currentPlanIndex === -1) return `Subscribe ${plan.name}`;
    const targetIndex = planOrder.indexOf(plan.key);
    return targetIndex > currentPlanIndex ? `Upgrade to ${plan.name}` : `Downgrade to ${plan.name}`;
  };

  const startCheckout = async (plan: PlanOption) => {
    if (!session?.access_token || !plan.priceId) return;
    if (subscription?.plan === plan.key) return;

    setSubmittingCheckout(plan.key);
    setError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to start checkout.");
      window.location.href = payload.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmittingCheckout(null);
    }
  };

  const openPortal = async () => {
    if (!session?.access_token) return;

    setOpeningPortal(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to open billing portal.");
      window.location.href = payload.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Portal request failed.");
    } finally {
      setOpeningPortal(false);
    }
  };

  const activeSubscription = subscription?.status === "active";
  const canAccessGenerator = Boolean(subscription?.admin_access || activeSubscription);
  const creditsRemaining = subscription?.remaining.credits_remaining ?? 0;
  const creditsTotal = subscription?.remaining.credits_total ?? 0;
  const weeklyUsed = subscription?.remaining.weekly_used ?? 0;
  const weeklyLimit = subscription?.remaining.weekly_limit ?? 0;
  const weeklyRemaining = Math.max(weeklyLimit - weeklyUsed, 0);

  const weeklyLimitHit = !subscription?.admin_access && weeklyLimit > 0 && weeklyUsed >= weeklyLimit;
  const creditsExhausted = !subscription?.admin_access && creditsRemaining <= 0;
  const composerDisabled = generating || !canAccessGenerator || creditsExhausted || weeklyLimitHit;

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!session?.access_token || !trimmedPrompt || composerDisabled) return;

    setGenerating(true);
    setError("");
    setInfo("");

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedPrompt,
      createdAt: Date.now(),
      imageUrl: imageDataUrl ?? undefined,
    };

    const thinkingId = createMessageId();
    const thinkingMessage: ChatMessage = {
      id: thinkingId,
      role: "assistant",
      content: "Thinking…",
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, thinkingMessage]);

    try {
      const response = await fetch("/api/wovo-ai", {
        method: "POST",
        headers: withAuthHeaders(session.access_token),
        body: JSON.stringify({
          topic: trimmedPrompt,
          business_name: businessName.trim() || undefined,
          business_type: businessType.trim() || undefined,
          location: location.trim() || undefined,
          contact: contact.trim() || undefined,
          goal: goal.trim() || undefined,
          reference_image: imageDataUrl || undefined,
        }),
      });

      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate content.");
      }

      const result = {
        captions: (payload.captions ?? []).slice(0, 5),
        hashtags: (payload.hashtags ?? []).join(" "),
        imagePrompt: payload.image_prompt ?? "",
      };

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: formatAssistantContent(result),
        createdAt: Date.now(),
        imageUrl: payload.image?.url,
        result,
      };

      setMessages((prev) => prev.map((message) => (message.id === thinkingId ? assistantMessage : message)));
      setPrompt("");

      setSubscription((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status,
              plan: payload.plan,
              remaining: payload.remaining,
              can_generate: payload.can_generate,
            }
          : prev,
      );
    } catch (err: unknown) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === thinkingId
            ? { ...message, content: "Something went wrong. Please try again.", result: undefined, imageUrl: undefined }
            : message,
        ),
      );
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleGenerate();
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {!loadingSession && !session && (
          <section className="mx-auto mt-20 max-w-md rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
            <h1 className="text-2xl font-bold">Sign in to use Wovo AI</h1>
            <p className="mt-2 text-sm text-white/75">Generate social captions + promo graphics with subscription access.</p>
            <div className="mt-4 space-y-3 text-left">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={fieldClass} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={fieldClass} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button onClick={() => void handleSignIn()} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">Sign in</button>
              <button onClick={() => void handleSignUp()} className="rounded-xl border border-white/35 px-4 py-2.5 text-sm">Sign up</button>
            </div>
            <button onClick={() => void handleGoogle()} className="mt-2 w-full rounded-xl border border-white/35 px-4 py-2.5 text-sm">Continue with Google</button>
          </section>
        )}

        {session && authUser && (
          <>
            <header className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold">Wovo AI</h1>
                <p className="text-sm text-white/70">Signed in as {authUser.email}</p>
              </div>
              <div className="flex gap-2">
                {(subscription?.plan || subscription?.status === "active") && (
                  <button onClick={() => void openPortal()} disabled={openingPortal} className="rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-60">
                    {openingPortal ? "Opening..." : "Manage Billing"}
                  </button>
                )}
                <button onClick={signOut} className="rounded-lg border border-white/30 px-4 py-2 text-sm">Sign out</button>
              </div>
            </header>

            {subscription?.admin_access && <p className="inline-block rounded-full border border-emerald-300/50 bg-emerald-400/15 px-3 py-1 text-xs text-emerald-200">Admin mode</p>}

            {!canAccessGenerator && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Choose your plan</h2>
                <p className="mt-1 text-sm text-white/70">Subscribe to unlock the caption + promo graphic generator.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {planOptions.map((plan) => {
                    const disabled = !plan.priceId || subscription?.plan === plan.key;
                    const emphasized = Boolean(plan.popular);

                    return (
                      <article
                        key={plan.key}
                        className={`rounded-2xl border p-4 ${
                          emphasized
                            ? "scale-[1.03] border-emerald-300/80 bg-emerald-400/15 shadow-[0_0_35px_rgba(16,185,129,0.25)]"
                            : "border-white/20 bg-black/30"
                        }`}
                      >
                        {emphasized && <p className="mb-2 inline-block rounded-full bg-emerald-300 px-2.5 py-0.5 text-xs font-extrabold text-black">Most popular · Best value</p>}
                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                        <p className="text-2xl font-bold">{plan.price}</p>
                        <p className="mt-1 text-sm text-white/70">{plan.desc}</p>
                        {plan.subtext && <p className="mt-1 text-xs text-emerald-200">{plan.subtext}</p>}
                        <button
                          onClick={() => void startCheckout(plan)}
                          disabled={disabled || submittingCheckout === plan.key}
                          className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submittingCheckout === plan.key ? "Opening..." : getPlanButtonLabel(plan)}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {canAccessGenerator && (
              <section className="grid gap-4 lg:grid-cols-[300px,1fr]">
                <aside className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm">
                  <h2 className="text-lg font-semibold">Dashboard</h2>
                  <p className="mt-2 text-white/80">Plan: {subscription?.plan ?? "none"}</p>
                  <p className="text-white/80">Status: {subscription?.status ?? "inactive"}</p>
                  <p className="text-white/80">Credits remaining: {creditsRemaining} / {creditsTotal}</p>
                  <p className="text-white/80">Weekly remaining: {weeklyRemaining} / {weeklyLimit}</p>
                  {(creditsExhausted || weeklyLimitHit) && (
                    <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-amber-100">
                      <p className="text-xs">{creditsExhausted ? "You’re out of credits this month. Upgrade or wait for reset." : "Weekly limit reached. Try again after reset or upgrade."}</p>
                      <button onClick={() => void openPortal()} className="mt-2 rounded-lg border border-amber-200/50 px-3 py-1 text-xs">Upgrade plan</button>
                    </div>
                  )}
                </aside>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <h2 className="text-lg font-semibold">Wovo AI Chat</h2>
                  <div ref={transcriptRef} className="mt-3 h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 md:h-[420px]">
                    {messages.length === 0 && <p className="text-sm text-white/60">Ask for a promotion caption and concept to begin.</p>}
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-[95%] rounded-xl p-3 ${
                          msg.role === "user" ? "ml-auto bg-white/10" : "mr-auto border border-white/15 bg-black/50"
                        }`}
                      >
                        <p className="mb-1 text-xs uppercase text-white/60">{msg.role}</p>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.imageUrl && msg.role === "user" && (
                          <Image src={msg.imageUrl} alt="Reference upload" width={600} height={600} unoptimized className="mt-2 max-h-56 w-full rounded-lg object-cover" />
                        )}
                        {msg.result && (
                          <div className="mt-3 space-y-2 text-sm">
                            {msg.result.captions.map((caption, index) => (
                              <div key={`${msg.id}-caption-${index}`} className="rounded-lg border border-white/15 bg-black/40 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold">Caption {index + 1}</p>
                                  <button onClick={() => void copyText(caption, `Caption ${index + 1} copied.`)} className="rounded border border-white/25 px-2 py-1 text-xs">Copy</button>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-white/90">{caption}</p>
                              </div>
                            ))}
                            <div className="rounded-lg border border-white/15 bg-black/40 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold">Hashtags</p>
                                <button onClick={() => void copyText(msg.result.hashtags, "Hashtags copied.")} className="rounded border border-white/25 px-2 py-1 text-xs">Copy</button>
                              </div>
                              <p className="mt-2 text-white/90">{msg.result.hashtags}</p>
                            </div>
                            <div className="rounded-lg border border-white/15 bg-black/40 p-3">
                              <p className="font-semibold">Image prompt</p>
                              <p className="mt-2 whitespace-pre-wrap text-white/90">{msg.result.imagePrompt}</p>
                            </div>
                            {msg.imageUrl && (
                              <div className="rounded-lg border border-white/15 bg-black/40 p-3">
                                <Image src={msg.imageUrl} alt="Generated promo graphic" width={1024} height={1024} unoptimized className="aspect-square w-full rounded-lg object-cover" />
                                <a href={msg.imageUrl} download="wovo-promo.png" className="mt-2 inline-block rounded border border-white/25 px-2 py-1 text-xs">Download image</a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <button onClick={() => setShowDetails((prev) => !prev)} className="text-xs text-emerald-300 underline">{showDetails ? "Hide" : "Show"} Details</button>
                    {showDetails && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" className={fieldClass} />
                        <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Business type" className={fieldClass} />
                        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className={fieldClass} />
                        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact" className={fieldClass} />
                        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={fieldClass} />
                        <div className="rounded-xl border border-white/20 bg-black/30 p-3">
                          <label className="text-xs text-white/80">Reference image (optional)</label>
                          <input type="file" accept="image/*" onChange={(e) => void handlePickImage(e)} className="mt-1 block w-full text-xs text-white/70" />
                          {imageName && <p className="mt-1 text-xs text-white/60">{imageName}</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 mt-3 rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur">
                    {(creditsExhausted || weeklyLimitHit || !canAccessGenerator) && (
                      <p className="mb-2 text-xs text-amber-300">
                        {!canAccessGenerator
                          ? "Your subscription is inactive."
                          : creditsExhausted
                            ? "You’re out of credits this month. Upgrade or wait for reset."
                            : "Weekly limit reached. Try again after reset or upgrade."}
                      </p>
                    )}
                    {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
                    <div className="flex gap-2">
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder="Type your message..."
                        rows={3}
                        disabled={composerDisabled}
                        className={fieldClass}
                      />
                      <button
                        onClick={() => void handleGenerate()}
                        disabled={composerDisabled || !prompt.trim()}
                        className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
                      >
                        {generating ? "Sending..." : "Send"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-white/60">Enter to send • Shift+Enter for new line</p>
                    <p className="mt-1 text-xs text-white/60">Credits remaining: {creditsRemaining} · Weekly remaining: {weeklyRemaining}</p>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        <p className="text-center text-xs text-white/40">Need help? <Link className="underline" href="/">Back home</Link></p>
        {info && <p className="text-sm text-emerald-300">{info}</p>}
      </div>
    </main>
  );
}
