"use client";

import Link from "next/link";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { isSessionExpiredError, supabase, type Session } from "@/lib/supabase/client";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

type PlanKey = "starter" | "pro" | "agency";
type SupabaseAuthUser = { id: string; email?: string };

type SubscriptionPayload = UnifiedSubscriptionResponse & { admin_access?: boolean };
type GenerateResponse = SubscriptionPayload & {
  captions: string[];
  hashtags: string[];
  image_prompt: string;
};

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; result?: GenerateResponse };

type PlanOption = { key: PlanKey; name: string; price: string; priceId?: string; desc: string; subtext?: string; popular?: boolean };

const STORAGE_KEY = "wovo-supabase-session";
const planOrder: PlanKey[] = ["starter", "pro", "agency"];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSessionFromHash(hash: string): Session | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  const expiresIn = params.get("expires_in");
  return {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") ?? undefined,
    expires_in: expiresIn ? Number(expiresIn) : undefined,
    token_type: params.get("token_type") ?? undefined,
  };
}

const inputClass = "w-full rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-sm text-white outline-none";

export default function WovoAiPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionPayload | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    const headers = await authHeaders();
    const response = await fetch("/api/wovo-ai/subscription", { headers });
    const payload = (await response.json()) as SubscriptionPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to load subscription.");
    setSubscription(payload);
  }, [authHeaders]);

  const clearSessionState = useCallback((message?: string) => {
    localStorage.removeItem(STORAGE_KEY);
    supabase.setSession(null);
    setSession(null);
    setAuthUser(null);
    setSubscription(null);
    setMessages([]);
    if (message) setError(message);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const fromHash = parseSessionFromHash(window.location.hash);
        if (fromHash) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromHash));
          window.history.replaceState({}, document.title, "/wovo-ai");
          setSession(fromHash);
          supabase.setSession(fromHash);
          return;
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Session;
          setSession(parsed);
          supabase.setSession(parsed);
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
      if (userError || !data.user) {
        if (isSessionExpiredError(userError)) {
          clearSessionState("Your session expired. Please sign in again.");
          return;
        }
        setError(mapSupabaseAuthError(userError).message);
        return;
      }
      if (data.session) {
        setSession(data.session);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.session));
      }
      setAuthUser(data.user as SupabaseAuthUser);
      setEmail(data.user.email ?? "");
      await loadSubscription();
    };
    void hydrate();
  }, [clearSessionState, loadSubscription, session?.access_token]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const active = subscription?.status === "active";
  const isAdmin = Boolean(subscription?.admin_access);
  const canChat = Boolean(active || isAdmin);
  const remaining = subscription?.remaining ?? { credits_total: 0, credits_remaining: 0, weekly_limit: 0, weekly_used: 0 };
  const weeklyRemaining = Math.max(remaining.weekly_limit - remaining.weekly_used, 0);
  const blocked = !isAdmin && (!subscription?.can_generate || remaining.credits_remaining <= 0 || (remaining.weekly_limit > 0 && remaining.weekly_used >= remaining.weekly_limit));

  const currentPlanIndex = subscription?.plan && subscription.plan !== "none" ? planOrder.indexOf(subscription.plan) : -1;
  const planLabel = (plan: PlanOption) => {
    if (subscription?.plan === plan.key && active) return "Current plan";
    if (!active) return `Subscribe ${plan.name}`;
    const targetIndex = planOrder.indexOf(plan.key);
    return targetIndex > currentPlanIndex ? "Upgrade" : "Downgrade";
  };

  const signOut = (message?: string) => {
    clearSessionState(message);
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

  const handleGenerate = async () => {
    const message = prompt.trim();
    if (!message || generating || !canChat || blocked) return;
    setGenerating(true);
    setError("");

    const thinkingId = createId();
    setMessages((prev) => [...prev, { id: createId(), role: "user", text: message }, { id: thinkingId, role: "assistant", text: "Thinking..." }]);

    try {
      const response = await fetch("/api/wovo-ai/generate", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as Partial<GenerateResponse> & { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Generation failed.");

      const result: GenerateResponse = {
        status: payload.status === "active" ? "active" : "inactive",
        plan: payload.plan === "starter" || payload.plan === "pro" || payload.plan === "agency" ? payload.plan : "none",
        remaining: payload.remaining ?? { credits_total: 0, credits_remaining: 0, weekly_limit: 0, weekly_used: 0 },
        can_generate: Boolean(payload.can_generate),
        captions: payload.captions ?? [],
        hashtags: payload.hashtags ?? [],
        image_prompt: payload.image_prompt ?? "",
      };

      setSubscription((prev) => (prev ? { ...prev, ...result, admin_access: prev.admin_access } : prev));
      setMessages((prev) => prev.map((m) => (m.id === thinkingId ? { id: createId(), role: "assistant", text: "Generated response", result } : m)));
      setPrompt("");
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === thinkingId ? { ...m, text: "Something went wrong. Please try again." } : m)));
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleGenerate();
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {!loadingSession && !session && <section className="mx-auto mt-20 max-w-md rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
          <h1 className="text-2xl font-bold">Sign in to use Wovo AI</h1>
          <div className="mt-4 space-y-3 text-left">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputClass} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={inputClass} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button onClick={async () => {
              const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
              if (signInError || !data.session) return setError(mapSupabaseAuthError(signInError).message);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.session));
              supabase.setSession(data.session);
              setSession(data.session);
            }} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">Sign in</button>
            <button onClick={async () => {
              const { error: signUpError } = await supabase.auth.signUp({ email, password });
              if (signUpError) return setError(mapSupabaseAuthError(signUpError).message);
              setInfo("Check your email to confirm your account.");
            }} className="rounded-xl border border-white/35 px-4 py-2.5 text-sm">Sign up</button>
          </div>
        </section>}

        {session && authUser && (
          <>
            <header className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h1 className="text-xl font-semibold">Wovo AI</h1><p className="text-sm text-white/70">Signed in as {authUser.email}</p></div>
              <div className="flex gap-2">
                {active && !isAdmin && <button onClick={() => void openPortal()} disabled={openingPortal} className="rounded-lg border border-white/30 px-4 py-2 text-sm">{openingPortal ? "Opening..." : "Manage Billing"}</button>}
                <button onClick={signOut} className="rounded-lg border border-white/30 px-4 py-2 text-sm">Sign out</button>
              </div>
            </header>

            <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <h2 className="text-xl font-semibold">Choose your plan</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {plans.map((plan) => {
                  const disabled = Boolean((active && subscription?.plan === plan.key) || !plan.priceId || submittingCheckout === plan.key);
                  return <article key={plan.key} className={`rounded-2xl border p-4 ${plan.popular ? "border-emerald-300/80 bg-emerald-400/10 shadow-[0_0_35px_rgba(16,185,129,0.25)]" : "border-white/20 bg-black/30"}`}>
                    {plan.popular && <p className="mb-2 inline-block rounded-full bg-emerald-300 px-2 py-0.5 text-xs font-bold text-black">Best value</p>}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="text-2xl font-bold">{plan.price}</p>
                    <p className="mt-1 text-sm text-white/70">{plan.desc}</p>
                    {plan.subtext && <p className="mt-1 text-xs text-emerald-200">{plan.subtext}</p>}
                    <button onClick={() => void startCheckout(plan)} disabled={disabled} className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-60">{submittingCheckout === plan.key ? "Working..." : planLabel(plan)}</button>
                  </article>;
                })}
              </div>
            </section>

            {canChat ? <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div ref={transcriptRef} className="h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 md:h-[430px]">
                {messages.length === 0 && <p className="text-sm text-white/60">Ask for caption ideas to begin.</p>}
                {messages.map((m) => <div key={m.id} className={`max-w-[92%] rounded-xl p-3 ${m.role === "user" ? "ml-auto bg-white/10" : "mr-auto border border-white/15 bg-black/50"}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                  {m.result && <div className="mt-3 space-y-2 text-sm">
                    <div><p className="font-semibold">Captions:</p><ol className="list-decimal space-y-1 pl-5">{m.result.captions.map((c, i) => <li key={`${m.id}-${i}`}>{c}</li>)}</ol></div>
                    <p><span className="font-semibold">Hashtags:</span> {m.result.hashtags.join(" ")}</p>
                    <div><p className="font-semibold">Image prompt:</p><pre className="mt-1 overflow-x-auto rounded-md bg-black/70 p-2 text-xs">{m.result.image_prompt}</pre></div>
                  </div>}
                </div>)}
              </div>

              <div className="sticky bottom-0 mt-3 rounded-xl border border-white/10 bg-black/80 p-3">
                {blocked && <p className="mb-2 text-xs text-amber-300">{subscription?.message ?? "You have reached your credit limit."}</p>}
                <div className="flex gap-2">
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={onComposerKeyDown} rows={3} className={inputClass} placeholder="Type your message..." disabled={generating || blocked} />
                  <button onClick={() => void handleGenerate()} disabled={generating || blocked || !prompt.trim()} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-60">{generating ? "Sending..." : "Send"}</button>
                </div>
                <p className="mt-2 text-xs text-white/60">Enter to send • Shift+Enter for new line</p>
                <p className="mt-1 text-xs text-white/60">Credits remaining: {remaining.credits_remaining} · Weekly remaining: {weeklyRemaining}</p>
              </div>
            </section> : <section className="rounded-2xl border border-white/15 bg-white/5 p-5"><p className="text-white/80">Subscribe to an active plan to use the generator.</p></section>}
          </>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}
        {info && <p className="text-sm text-emerald-300">{info}</p>}
        <p className="text-center text-xs text-white/40">Need help? <Link className="underline" href="/">Back home</Link></p>
      </div>
    </main>
  );
}
