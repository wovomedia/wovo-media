"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DealCapture from "./DealCapture";
import { estimatePublicCredits } from "@/lib/ai/public-model-catalog";
import {
  getWovoPlanTerm,
  WOVO_PLAN_CATALOG,
  WOVO_TERM_CATALOG,
  type WovoBillingTerm,
} from "@/lib/portal/pricing-catalog";

type PlanId = "free" | "starter" | "creator" | "pro";

const TERMS = WOVO_TERM_CATALOG;

const JOBS_PER_MONTH: Record<string, number> = { occasionally: 4, weekly: 12, daily: 45, heavy: 120 };
const OUTPUTS_BY_QUALITY: Record<string, 1 | 2 | 4> = { standard: 1, high: 2, premium: 4 };

// Iteration is a real cost driver: every retry is another billed generation.
// The multipliers are stated in the UI so the estimate is never a black box.
const COMPLEXITY_STEPS = [
  { label: "Simple", attempts: 1, note: "You keep the first take." },
  { label: "Light", attempts: 1.25, note: "An occasional retry." },
  { label: "Balanced", attempts: 1.5, note: "About one retry every other asset." },
  { label: "Involved", attempts: 2, note: "Two takes for each finished asset." },
  { label: "Advanced", attempts: 2.5, note: "Repeated revisions before you keep one." },
] as const;

const EXPLORER_OUTPUTS = [1, 2, 4] as const;
const EXPLORER_SECONDS = [30, 60, 120, 180] as const;

const PLANS: Array<{
  id: PlanId;
  name: string;
  price: number;
  credits: number;
  audience: string;
  badge?: string;
  features: string[];
}> = [
  {
    id: "free",
    name: "Free",
    price: 0,
    credits: 10,
    audience: "Try a real WOVO generation",
    features: [
      "10 one-time starter credits",
      "No card required",
      "Private assets and downloads",
    ],
  },
  ...WOVO_PLAN_CATALOG.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.monthlyPriceCents / 100,
    credits: plan.monthlyCredits,
    audience:
      plan.id === "starter"
        ? "Occasional self-service creation"
        : plan.id === "creator"
          ? "Regular creators and growing brands"
          : "Heavy self-service business use",
    badge: plan.id === "creator" ? "Most popular" : undefined,
    features: [
      `${plan.monthlyCredits} credits released monthly`,
      "All creation tools",
      plan.id === "starter"
        ? "Projects, assets, and support"
        : plan.id === "creator"
          ? "Social approval and scheduling"
          : "Priority ticket support",
    ],
  })),
];

const PACKS = [10, 20, 50, 100, 500, 1000] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 ? 2 : 0,
  }).format(value);
}

function termPrice(
  planId: PlanId,
  monthly: number,
  term: (typeof TERMS)[number],
) {
  if (!monthly) return { due: 0, effective: 0, savings: 0 };
  const exact = getWovoPlanTerm(planId as Exclude<PlanId, "free">, term.id);
  return {
    due: exact.amountCents / 100,
    effective: exact.effectiveMonthlyCents / 100,
    savings: exact.savingsCents / 100,
  };
}

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 text-[#ff7659]"
      aria-hidden="true"
    >
      <path d="m4 10 4 4 8-9" />
    </svg>
  );
}

export default function PricingExperience() {
  const [termId, setTermId] = useState<WovoBillingTerm>("annual");
  const [creation, setCreation] = useState("mixed");
  const [frequency, setFrequency] = useState("weekly");
  const [quality, setQuality] = useState("high");
  const [complexity, setComplexity] = useState(2);
  const [explorer, setExplorer] = useState<"image" | "video" | "audio">("image");
  const [explorerOutputs, setExplorerOutputs] = useState<1 | 2 | 4>(1);
  const [explorerSeconds, setExplorerSeconds] = useState<30 | 60 | 120 | 180>(30);
  const [explorerPremiumAudio, setExplorerPremiumAudio] = useState(false);
  const [pack, setPack] = useState<number>(20);
  const [custom, setCustom] = useState("");
  const term = TERMS.find((item) => item.id === termId) ?? TERMS[0];

  const complexityStep = COMPLEXITY_STEPS[complexity] ?? COMPLEXITY_STEPS[2];

  // Every number below comes from the same catalog the composer quotes from,
  // so the estimator can never advertise a price WOVO does not charge.
  const monthlyEstimate = useMemo(() => {
    const jobs = JOBS_PER_MONTH[frequency] ?? 12;
    const outputCount = OUTPUTS_BY_QUALITY[quality] ?? 1;
    const imageCredits = estimatePublicCredits({ type: "image", modelId: "flux-2", outputCount });
    const videoCredits = estimatePublicCredits({ type: "video", modelId: "wan-2-2-turbo" });
    const premiumAudioCredits = estimatePublicCredits({ type: "audio", modelId: "stable-audio-2-5" });
    const perJob =
      creation === "images"
        ? imageCredits
        : creation === "videos"
          ? videoCredits
          : creation === "premium"
            ? videoCredits + premiumAudioCredits
            : Math.round((imageCredits + videoCredits) / 2);
    return Math.round(jobs * perJob * complexityStep.attempts);
  }, [creation, frequency, quality, complexityStep]);

  const recommendedPlan = useMemo(
    () => WOVO_PLAN_CATALOG.find((plan) => plan.monthlyCredits >= monthlyEstimate) ?? null,
    [monthlyEstimate],
  );

  const explorerCredits =
    explorer === "image"
      ? estimatePublicCredits({ type: "image", modelId: "flux-2", outputCount: explorerOutputs })
      : explorer === "video"
        ? estimatePublicCredits({ type: "video", modelId: "wan-2-2-turbo" })
        : estimatePublicCredits({
            type: "audio",
            modelId: explorerPremiumAudio ? "stable-audio-2-5" : "cassette-music",
            durationSeconds: explorerSeconds,
          });
  const explorerStarterNote =
    explorerCredits <= 10
      ? `Your 10 free starter credits cover ${Math.floor(10 / explorerCredits)} of these.`
      : "One of these costs more than the 10 free starter credits.";
  // The composer is a statically rendered landing page, so it does not read
  // query parameters. The link opens it rather than pretending to preload.
  const explorerHref = "/";
  const selectedPack = Math.max(10, Number(custom) || pack);
  const selectedCredits = Math.floor(selectedPack * 11);

  return (
    <main className="min-h-screen bg-[#0b0b0c] text-[#f7f4ee]">
      <DealCapture />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b0c]/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-17 max-w-[1280px] items-center justify-between px-4 sm:px-7">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="text-xl font-black tracking-[-.075em]">WOVO</span>
            <span className="rounded-full border border-white/20 px-2 py-1 text-[8px] font-bold uppercase tracking-[.2em] text-white/55">
              AI
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-white/55 md:flex">
            <Link href="/">Create</Link>
            <Link href="/#explore">Explore</Link>
            <Link href="/pricing" className="text-white">
              Pricing
            </Link>
            <Link href="/contact">Support</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login?next=/portal"
              className="inline-flex min-h-10 items-center px-3 text-sm text-white/65"
            >
              Sign in
            </Link>
            <Link
              href="/signup?next=/portal"
              className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 text-sm font-bold text-black"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <div className="border-b border-[#f05a3a]/20 bg-[#f05a3a] px-4 py-2.5 text-center text-xs font-black uppercase tracking-[.13em] text-[#190b07]">
        Annual plans save 20% · monthly credits still release one month at a
        time
      </div>

      <section className="mx-auto max-w-[1180px] px-4 pb-12 pt-16 text-center sm:px-7 sm:pt-24">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff7659]">
          WOVO Credits
        </p>
        <h1 className="mx-auto mt-4 max-w-4xl text-[clamp(3rem,7vw,6rem)] font-medium leading-[.92] tracking-[-.06em]">
          Create more. Know the cost first.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/48">
          Every plan includes the same creation workspace. Choose how many
          credits you need, and see the exact model cost before every
          generation.
        </p>
      </section>

      <section id="plans" className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-7">
        <div className="mx-auto flex max-w-xl rounded-2xl border border-white/10 bg-white/[.025] p-1.5">
          {TERMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTermId(item.id)}
              className={`min-h-10 flex-1 rounded-xl px-2 text-xs font-semibold transition ${termId === item.id ? "bg-white text-black" : "text-white/42 hover:text-white"}`}
            >
              {item.label}
              {item.discountPercent ? (
                <span className="ml-1 hidden text-[9px] text-[#d94326] sm:inline">
                  -{item.discountPercent}%
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = termPrice(plan.id, plan.price, term);
            const recommended = recommendedPlan?.id === plan.id;
            return (
              <article
                key={plan.id}
                className={`relative flex min-h-[480px] flex-col rounded-[26px] border p-6 ${plan.id === "creator" ? "border-[#f05a3a] bg-[#1b1716] shadow-[0_24px_80px_rgba(240,90,58,.14)]" : "border-white/10 bg-[#141415]"}`}
              >
                {plan.badge ? (
                  <span className="absolute right-4 top-4 rounded-full bg-[#f05a3a] px-3 py-1 text-[9px] font-black uppercase tracking-[.12em] text-black">
                    {plan.badge}
                  </span>
                ) : null}
                {recommended ? (
                  <span className="mb-4 w-fit rounded-full border border-white/10 bg-white/[.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-white/65">
                    Recommended for your estimate
                  </span>
                ) : null}
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="mt-2 min-h-11 text-sm leading-6 text-white/42">
                  {plan.audience}
                </p>
                <div className="mt-7">
                  <div className="flex items-end gap-2">
                    <strong className="text-5xl font-medium tracking-[-.055em]">
                      {money(price.effective)}
                    </strong>
                    {plan.price ? (
                      <span className="pb-1 text-xs text-white/38">
                        / month
                      </span>
                    ) : null}
                  </div>
                  {term.monthsCovered > 1 && plan.price ? (
                    <p className="mt-2 text-xs text-white/42">
                      {money(price.due)} due today · save {money(price.savings)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-white/42">
                      {plan.id === "free"
                        ? "One-time starter grant"
                        : "Cancel future renewals anytime"}
                    </p>
                  )}
                </div>
                <div className="mt-7 rounded-2xl bg-white/[.045] p-4">
                  <p className="text-2xl font-semibold">
                    {plan.credits.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {plan.id === "free"
                      ? "one-time WOVO Credits"
                      : "WOVO Credits every month"}
                  </p>
                  {plan.id !== "free" ? (
                    <p className="mt-3 text-[11px] leading-5 text-white/35">
                      About {Math.floor(plan.credits / 2)} standard images, {Math.floor(plan.credits / 12)} short 720p videos, or a mix. Exact costs appear before generation.
                    </p>
                  ) : null}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2.5 text-sm text-white/55"
                    >
                      <Check />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={
                    plan.id === "free"
                      ? "/signup?next=%2Fportal"
                      : `/signup?next=${encodeURIComponent(`/portal?plan=${plan.id}&term=${term.id}`)}`
                  }
                  className={`mt-auto inline-flex min-h-12 items-center justify-center rounded-xl text-sm font-bold ${plan.id === "creator" ? "bg-[#f05a3a] text-black" : "bg-white text-black"}`}
                >
                  {plan.id === "free" ? "Start free" : `Choose ${plan.name}`}
                </Link>
              </article>
            );
          })}
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-white/35">
          Paid multi-month plans release the listed credits monthly—not all at
          once. Existing customer terms remain unchanged unless they choose a
          new plan.
        </p>
      </section>

      <section className="border-y border-white/10 bg-[#101011] py-20">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 sm:px-7 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff7659]">
              Plan estimator
            </p>
            <h2 className="mt-4 text-4xl font-medium leading-[1] tracking-[-.045em]">
              Find a plan without guessing.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/45">
              This recommendation uses current WOVO credit charges. It does not
              force a plan or hide premium-model costs.
            </p>
            <div className="mt-8 rounded-2xl border border-[#f05a3a]/30 bg-[#f05a3a]/8 p-5">
              <p className="text-xs text-white/45">Recommended</p>
              <p className="mt-1 text-2xl font-semibold">
                {recommendedPlan ? recommendedPlan.name : "Pro plus credit packs"}
              </p>
              <p className="mt-2 text-sm text-white/45">
                About {monthlyEstimate} credits a month at this pace
                {recommendedPlan
                  ? ` · ${recommendedPlan.monthlyCredits} included`
                  : " · more than any plan allowance, so top up with credit packs"}
                .
              </p>
              <p className="mt-3 text-xs leading-5 text-white/35">
                Built from the same charges the composer quotes. Exact costs
                still appear before every generation.
              </p>
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-[#171718] p-5 sm:p-7">
            <EstimatorGroup
              label="What will you create?"
              options={[
                ["images", "Images"],
                ["videos", "Short video"],
                ["premium", "Premium video"],
                ["mixed", "Mixed"],
              ]}
              value={creation}
              onChange={setCreation}
            />
            <EstimatorGroup
              label="How often?"
              options={[
                ["occasionally", "Occasionally"],
                ["weekly", "Weekly"],
                ["daily", "Daily"],
                ["heavy", "Heavy"],
              ]}
              value={frequency}
              onChange={setFrequency}
            />
            <EstimatorGroup
              label="Quality"
              options={[
                ["standard", "Standard"],
                ["high", "High"],
                ["premium", "Premium"],
              ]}
              value={quality}
              onChange={setQuality}
              last
            />
            <p className="mt-3 text-xs leading-5 text-white/35">
              Higher quality asks for more variations per prompt, so it costs
              more credits.
            </p>
            <div className="mt-6 border-t border-white/10 pt-6">
              <label
                htmlFor="estimator-complexity"
                className="text-sm font-semibold"
              >
                How much do you iterate?
              </label>
              <input
                id="estimator-complexity"
                type="range"
                min={0}
                max={COMPLEXITY_STEPS.length - 1}
                step={1}
                value={complexity}
                onChange={(event) => setComplexity(Number(event.target.value))}
                aria-valuetext={complexityStep.label}
                className="mt-4 w-full accent-[#f05a3a]"
              />
              <div className="mt-2 flex justify-between text-[11px] text-white/38">
                <span>Simple</span>
                <span>Advanced</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#ff9b82]">
                {complexityStep.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/40">
                {complexityStep.note} Every retry is another billed generation,
                so this moves the estimate by {complexityStep.attempts}x.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-20 sm:px-7">
        <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff7659]">
              Pay as you go
            </p>
            <h2 className="mt-4 text-4xl font-medium leading-[1] tracking-[-.045em]">
              No subscription required.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/45">
              Buy credits for one project, then return whenever you want.
              Purchased credits are tracked separately from subscription grants.
            </p>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-[#141415] p-5 sm:p-7">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PACKS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setPack(amount);
                    setCustom("");
                  }}
                  className={`min-h-12 rounded-xl border text-sm font-bold ${!custom && pack === amount ? "border-[#f05a3a] bg-[#f05a3a] text-black" : "border-white/10 text-white/62 hover:border-white/25"}`}
                >
                  {money(amount)}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-semibold text-white/48">
              Custom amount
              <input
                value={custom}
                onChange={(event) =>
                  setCustom(event.target.value.replace(/[^0-9]/g, ""))
                }
                inputMode="numeric"
                placeholder="Minimum $10"
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.035] px-4 text-base text-white outline-none focus:border-[#f05a3a]"
              />
            </label>
            <div className="mt-5 flex flex-col justify-between gap-4 rounded-2xl bg-white/[.04] p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs text-white/42">You receive</p>
                <p className="mt-1 text-2xl font-semibold">
                  {selectedCredits.toLocaleString()} credits
                </p>
                <p className="mt-1 text-[11px] text-white/32">
                  Server-calculated at checkout · 11 credits per dollar in this
                  launch catalog
                </p>
              </div>
              <Link
                href={`/login?next=${encodeURIComponent(`/portal?buyCredits=${selectedPack}`)}`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-black"
              >
                Sign in to buy {money(selectedPack)}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#101011] py-20">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff7659]">
                See cost before create
              </p>
              <h2 className="mt-3 text-4xl font-medium tracking-[-.045em]">
                Credits follow the real work.
              </h2>
            </div>
            <div
              className="flex rounded-xl border border-white/10 p-1"
              role="tablist"
              aria-label="Cost explorer"
            >
              {(["image", "video", "audio"] as const).map((item) => (
                <button
                  key={item}
                  role="tab"
                  aria-selected={explorer === item}
                  onClick={() => setExplorer(item)}
                  className={`min-h-9 rounded-lg px-4 text-xs font-semibold capitalize ${explorer === item ? "bg-white text-black" : "text-white/42"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-2xl border border-white/10 bg-[#171718] p-5 sm:p-7">
              {explorer === "image" ? (
                <>
                  <label
                    htmlFor="explorer-outputs"
                    className="text-sm font-semibold"
                  >
                    Images per prompt
                  </label>
                  <input
                    id="explorer-outputs"
                    type="range"
                    min={0}
                    max={EXPLORER_OUTPUTS.length - 1}
                    step={1}
                    value={EXPLORER_OUTPUTS.indexOf(explorerOutputs)}
                    onChange={(event) =>
                      setExplorerOutputs(
                        EXPLORER_OUTPUTS[Number(event.target.value)],
                      )
                    }
                    aria-valuetext={`${explorerOutputs} images`}
                    className="mt-4 w-full accent-[#f05a3a]"
                  />
                  <div className="mt-2 flex justify-between text-[11px] text-white/38">
                    {EXPLORER_OUTPUTS.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                  <p className="mt-5 text-sm leading-6 text-white/45">
                    FLUX 2 · standard image · {explorerOutputs}{" "}
                    {explorerOutputs === 1 ? "output" : "outputs"}
                  </p>
                </>
              ) : explorer === "video" ? (
                <>
                  <p className="text-sm font-semibold">Short vertical clip</p>
                  <p className="mt-5 text-sm leading-6 text-white/45">
                    Wan 2.2 Turbo is the one verified video model today, at 720p
                    vertical. WOVO does not sell 1080p or 4K video, because it
                    cannot deliver them yet.
                  </p>
                </>
              ) : (
                <>
                  <label
                    htmlFor="explorer-seconds"
                    className="text-sm font-semibold"
                  >
                    Track length
                  </label>
                  <input
                    id="explorer-seconds"
                    type="range"
                    min={0}
                    max={EXPLORER_SECONDS.length - 1}
                    step={1}
                    value={EXPLORER_SECONDS.indexOf(explorerSeconds)}
                    onChange={(event) =>
                      setExplorerSeconds(
                        EXPLORER_SECONDS[Number(event.target.value)],
                      )
                    }
                    aria-valuetext={`${explorerSeconds} seconds`}
                    className="mt-4 w-full accent-[#f05a3a]"
                  />
                  <div className="mt-2 flex justify-between text-[11px] text-white/38">
                    <span>30s</span>
                    <span>1m</span>
                    <span>2m</span>
                    <span>3m</span>
                  </div>
                  <button
                    onClick={() => setExplorerPremiumAudio((current) => !current)}
                    aria-pressed={explorerPremiumAudio}
                    className={`mt-5 min-h-11 rounded-xl border px-4 text-xs font-semibold ${explorerPremiumAudio ? "border-[#f05a3a] bg-[#f05a3a]/12 text-[#ff9b82]" : "border-white/10 text-white/45"}`}
                  >
                    Premium audio render
                  </button>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-[#f05a3a]/30 bg-[#f05a3a]/8 p-5 sm:p-7">
              <p className="text-xs text-white/45">This setup costs</p>
              <p className="mt-2 text-5xl font-medium tracking-[-.045em]">
                {explorerCredits}
                <span className="ml-2 text-sm text-white/45">credits</span>
              </p>
              <p className="mt-4 text-xs leading-5 text-white/45">
                {explorerStarterNote}
              </p>
              <Link
                href={explorerHref}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-xs font-black text-[#140b08]"
              >
                Open the composer
              </Link>
            </div>
          </div>
          <p className="mt-5 text-xs leading-5 text-white/34">
            Premium models, more outputs, longer clips, supported higher
            resolutions, native audio, and advanced references cost more. WOVO
            never applies a hidden surcharge.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-20 sm:px-7">
        <div className="overflow-hidden rounded-[30px] border border-[#f05a3a]/30 bg-[#191312] lg:grid lg:grid-cols-[1fr_.7fr]">
          <div className="p-7 sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff7659]">
              WOVO Agency
            </p>
            <h2 className="mt-4 text-4xl font-medium tracking-[-.045em]">
              Want a real WOVO person helping?
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/48">
              Agency is separate from the self-service plans. It can include a
              defined strategy call, human campaign review, and limited managed
              assistance—never unlimited labor hidden inside a cheap plan.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center rounded-xl bg-[#f05a3a] px-5 text-sm font-bold text-black"
              >
                Talk to WOVO
              </Link>
              <span className="inline-flex min-h-12 items-center px-3 text-sm text-white/42">
                Pricing under labor-economics review
              </span>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/[.035] p-7 lg:border-l lg:border-t-0 sm:p-10">
            <p className="text-sm font-semibold">Concept includes</p>
            <ul className="mt-5 space-y-3">
              {[
                "Pro-level software access",
                "One defined monthly strategy session",
                "Human account and campaign review",
                "Priority support and higher social limits",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-white/48">
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 text-xs text-white/35 sm:px-7">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} WOVO Media LLC</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/terms-of-use">Terms</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/cancellation-refund-policy">Billing & refunds</Link>
            <Link href="/contact">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function EstimatorGroup({
  label,
  options,
  value,
  onChange,
  last = false,
}: {
  label: string;
  options: string[][];
  value: string;
  onChange: (value: string) => void;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-6 border-b border-white/10 pb-6"}>
      <p className="mb-3 text-sm font-semibold">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map(([id, title]) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`min-h-11 rounded-xl border px-3 text-xs font-semibold ${value === id ? "border-[#f05a3a] bg-[#f05a3a]/12 text-[#ff9b82]" : "border-white/10 text-white/42 hover:text-white"}`}
          >
            {title}
          </button>
        ))}
      </div>
    </div>
  );
}
