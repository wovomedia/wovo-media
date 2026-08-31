import type { Metadata } from "next";
import Link from "next/link";
import DealCapture from "./DealCapture";

export const metadata: Metadata = {
  title: "WOVO Pricing — One Workspace, Flexible Credits",
  description: "Choose a WOVO billing period or buy creation credits without a subscription. Every workspace includes the same tools; credits control usage.",
  alternates: { canonical: "/pricing" },
};

const periods = [
  { name: "Monthly", due: "$44.99", cadence: "every month", effective: "$44.99/month", savings: "Flexible billing", badge: "" },
  { name: "Every 3 months", due: "$119.97", cadence: "every 3 months", effective: "$39.99/month", savings: "Save $15 each term", badge: "SAVE 11%" },
  { name: "Every 6 months", due: "$209.94", cadence: "every 6 months", effective: "$34.99/month", savings: "Save $60 each term", badge: "SAVE 22%" },
  { name: "Yearly", due: "$359.88", cadence: "every year", effective: "$29.99/month", savings: "Save $180 each year", badge: "BEST DEAL" },
];

const included = [
  "100 creation credits available every 7 days",
  "Images, videos, cartoons, AI music, captions, and campaigns",
  "Website concepts and page drafts",
  "Adam-assisted creation and brand guidance",
  "Calendar, approvals, and scheduling workflow",
  "Private brand assets and workspace notes",
  "Facebook, Instagram, TikTok, and YouTube connection workflow",
  "WOVO support inbox and billing controls",
];

const packs = [
  { key: "small", price: "$5", credits: "50 credits", note: "For a small one-time project", badge: "" },
  { key: "growth", price: "$10", credits: "110 credits", note: "10 bonus credits", badge: "POPULAR" },
  { key: "studio", price: "$25", credits: "300 credits", note: "50 bonus credits", badge: "BEST CREDIT VALUE" },
];

const creationExamples = [
  { creation: "Caption + original AI image", credits: "2", weekly: "Up to 50", note: "OpenAI copy + fal Flux image" },
  { creation: "Short 720p AI video", credits: "12", weekly: "Up to 8", note: "fal Wan turbo text-to-video or image-to-video" },
  { creation: "Economy AI music · 1 minute", credits: "2", weekly: "Up to 50", note: "CassetteAI music generation through fal" },
  { creation: "Premium AI music track", credits: "13", weekly: "Up to 7", note: "Stable Audio 2.5 through fal" },
  { creation: "Caption revision or project guidance", credits: "Quoted before use", weekly: "Varies", note: "Text length and selected workflow determine the quote" },
  { creation: "Higher-cost motion, voice, or future models", credits: "Model-specific", weekly: "Varies", note: "Never silently charged; WOVO shows the exact estimate first" },
];

export default function PricingPage() {
  return <main>
    <DealCapture />
    <Link href="#plans" className="flex min-h-12 items-center justify-center bg-[#f2563d] px-5 text-center text-xs font-black uppercase tracking-[.14em] text-[#191714] hover:bg-[#df432d]">
      Best deal going on now — yearly saves $180 and includes every WOVO tool →
    </Link>
    <section className="border-b border-[#191714]/10 py-16 sm:py-24">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9341f]">One workspace · every tool included</p>
        <div className="mt-5 grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <h1 className="max-w-4xl text-[clamp(3rem,7vw,5.8rem)] font-medium leading-[0.93] tracking-[-0.055em]">Pay for credits—not confusing tiers.</h1>
          <p className="max-w-xl text-base leading-7 text-[#655f56]">Pick a billing rhythm for an ongoing workspace, or buy credits for a one-time project. The tools stay the same; credits determine how much you create.</p>
        </div>
      </div>
    </section>
    <section id="plans" className="scroll-mt-20 py-14 sm:py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="overflow-hidden rounded-[28px] border border-[#191714]/15 bg-[#fffdf8] shadow-[0_30px_90px_rgba(25,23,20,.09)]">
          <div className="grid border-b border-[#191714]/10 bg-[#191714] px-5 py-7 text-white sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff8c70]">WOVO Workspace</p><h2 className="mt-2 text-3xl font-medium tracking-[-.035em]">Everything included. Usage stays predictable.</h2></div>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/65 lg:mt-0">Each paid workspace receives 100 creation credits every seven days. Unused weekly subscription credits do not accumulate.</p>
          </div>
          <div className="grid lg:grid-cols-4">
            {periods.map((period, index) => <article key={period.name} className={`relative p-5 sm:p-7 ${index ? "border-t border-[#191714]/10 lg:border-l lg:border-t-0" : ""} ${period.badge === "BEST DEAL" ? "bg-[#f8eee5]" : ""}`}>
              {period.badge && <span className="absolute right-5 top-5 rounded-full bg-[#f2563d] px-3 py-1 text-[10px] font-black tracking-[.12em] text-[#191714]">{period.badge}</span>}
              <p className="pr-28 text-sm font-bold">{period.name}</p>
              <div className="mt-7 flex items-end justify-between gap-4"><strong className="text-5xl font-medium tracking-[-.055em]">{period.due}</strong><span className="pb-1 text-right text-xs leading-5 text-[#655f56]">due today<br />then {period.cadence}</span></div>
              <p className="mt-5 border-t border-[#191714]/10 pt-4 text-sm font-semibold">{period.effective}</p>
              <p className="mt-1 text-xs leading-5 text-[#5c554d]">{period.savings} · 100 credits every 7 days</p>
            </article>)}
          </div>
          <div className="grid gap-8 border-t border-[#191714]/10 p-5 sm:p-8 lg:grid-cols-[1.2fr_.8fr]">
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a9341f]">Included with every billing period</p><ul className="mt-4 grid gap-x-7 sm:grid-cols-2">{included.map((item) => <li key={item} className="flex min-h-12 items-center gap-3 border-b border-[#191714]/10 py-2 text-sm"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f2563d]" />{item}</li>)}</ul></div>
            <div className="rounded-2xl bg-[#f3efe6] p-5"><p className="text-sm font-bold">Build your workspace before paying.</p><p className="mt-2 text-xs leading-5 text-[#655f56]">Create an account, add your brand details, and preview the workspace first. Stripe shows the exact price and renewal cadence before payment.</p><Link href="/signup?next=/portal" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f2563d] px-5 text-sm font-bold text-[#191714] hover:bg-[#df432d]">Create free account</Link></div>
          </div>
        </div>
        <section className="mt-10 rounded-[28px] bg-[#191714] p-5 text-white sm:p-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff8c70]">No subscription required</p><h2 className="mt-2 text-3xl font-medium tracking-[-.04em]">Buy individual creation credits.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Use credits for eligible WOVO creation tools without starting recurring billing. Your balance stays attached to your verified private workspace.</p></div>
            <Link href="/signup?next=/portal" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f2563d] px-6 text-sm font-bold text-[#191714]">Open a free workspace</Link>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3">{packs.map((pack) => <article key={pack.price} className="relative rounded-2xl border border-white/15 bg-white/[.06] p-5">
            {pack.badge && <span className="absolute right-4 top-4 rounded-full bg-[#f2563d] px-2.5 py-1 text-[9px] font-black tracking-[.1em] text-[#191714]">{pack.badge}</span>}
            <strong className="text-4xl font-medium tracking-[-.04em]">{pack.price}</strong><p className="mt-4 text-lg font-bold">{pack.credits}</p><p className="mt-1 text-xs text-white/55">{pack.note}</p><Link href={`/signup?next=${encodeURIComponent(`/portal?buyCredits=${pack.key}#credit-packs`)}`} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold transition hover:border-[#f2563d] hover:bg-[#f2563d] hover:text-[#191714]">Choose {pack.credits}</Link>
          </article>)}</div>
          <p className="mt-5 text-xs leading-5 text-white/55">Creation costs vary by tool and are shown before a paid generation starts. Purchased credits do not unlock unsupported providers or bypass rights and safety checks.</p>
        </section>
        <section className="mt-10 overflow-hidden rounded-[28px] border border-[#191714]/15 bg-[#fffdf8] shadow-[0_24px_70px_rgba(25,23,20,.07)]">
          <div className="grid gap-4 border-b border-[#191714]/10 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a9341f]">What 100 weekly credits can make</p><h2 className="mt-2 text-3xl font-medium tracking-[-.04em]">See the cost before you create.</h2></div><p className="max-w-md text-xs leading-5 text-[#655f56]">Examples use WOVO&apos;s current default models. A different model, duration, resolution, or workflow can change the quote.</p></div>
          <div className="divide-y divide-[#191714]/10">{creationExamples.map((example) => <article key={example.creation} className="grid gap-3 p-5 sm:grid-cols-[1.25fr_.55fr_.55fr_1.3fr] sm:items-center sm:px-8"><div><h3 className="text-sm font-bold">{example.creation}</h3></div><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#5c554d]">Credits</p><p className="mt-1 text-sm font-bold">{example.credits}</p></div><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#5c554d]">Per 7 days</p><p className="mt-1 text-sm font-bold">{example.weekly}</p></div><p className="text-xs leading-5 text-[#655f56]">{example.note}</p></article>)}</div>
        </section>
        <div className="mt-10 grid gap-6 rounded-[26px] border border-[#191714]/15 bg-[#fffdf8] p-6 sm:p-8 lg:grid-cols-3">
          {[['Weekly allowance', 'Subscription usage refreshes every seven days, even when you pay quarterly or yearly.'], ['One tool set', 'There are no Basic or Premium feature tiers. Cartoons are part of the same WOVO creation system.'], ['Clear estimates', 'WOVO shows the credit estimate before eligible image, video, cartoon, website, or caption generation begins.']].map(([title, copy]) => <article key={title} className="border-t border-[#191714]/25 pt-4"><h2 className="text-lg font-medium">{title}</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">{copy}</p></article>)}
        </div>
      </div>
    </section>
    <section className="border-y border-[#191714]/10 bg-[#e9e2d6] py-12">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8"><p className="max-w-3xl text-sm leading-6 text-[#655f56]">Recurring plans renew until canceled. Credit packs are one-time purchases. Taxes may be added by Stripe where WOVO is registered and required to collect them. Review the final total before payment.</p><div className="mt-4 flex flex-wrap gap-x-6 text-sm font-bold text-[#5c554d]"><Link href="/cancellation-refund-policy" className="inline-flex min-h-11 items-center underline underline-offset-4">Cancellation & refund policy</Link><Link href="/terms-of-use" className="inline-flex min-h-11 items-center underline underline-offset-4">Terms</Link><Link href="/privacy-policy" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacy</Link></div></div>
    </section>
  </main>;
}
