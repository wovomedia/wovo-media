import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Custom Cartoon Episodes for Your Business — Included in WOVO",
  description: "Turn an original business character into three short vertical cartoon episode drafts each week with private review and rights-first production.",
  alternates: { canonical: "/cartoon-episodes" },
  openGraph: {
    title: "WOVO Cartoon Episodes — Three New Episodes Every Week",
    description: "An original recurring cartoon series for your business: Monday, Wednesday, and Friday drafts for private review.",
    url: "https://wovomedia.com/cartoon-episodes",
    type: "website",
  },
};

const steps = [
  ["01", "Create the character", "Name the original character, define its personality, audience, visual direction, and topics to avoid."],
  ["02", "WOVO builds the episode", "A new script, caption, and eight-second vertical cartoon are prepared every Monday, Wednesday, and Friday."],
  ["03", "Review before sharing", "The episode stays private until you open and approve it. Social publishing is not included unless a supported account connection is separately verified."],
];

export default async function CartoonEpisodesPage() {
  return <main>
    <section className="overflow-hidden border-b border-[#191714]/10">
      <div className="mx-auto grid max-w-[1280px] lg:grid-cols-[1.1fr_.9fr]">
        <div className="px-5 py-16 sm:px-8 sm:py-24 lg:pr-16">
          <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#d94326]">WOVO Cartoon Episodes</p>
          <h1 className="mt-6 max-w-4xl text-[clamp(3rem,7vw,6.3rem)] font-medium leading-[.91] tracking-[-.06em]">Make your business a series people remember.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#655f56]">Turn an original mascot or consented character into three short vertical cartoon episode drafts every week—built from your approved brief and delivered to a private review queue.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup?next=/portal" className="inline-flex min-h-13 items-center justify-center rounded-full bg-[#f05a3a] px-7 text-sm font-bold text-[#191714] hover:bg-[#d94326]">Create your workspace</Link>
            <Link href="/contact" className="inline-flex min-h-13 items-center justify-center rounded-full border border-[#191714]/20 px-7 text-sm font-bold">Ask a question</Link>
          </div>
        </div>
        <div className="relative min-h-[430px] overflow-hidden bg-[#191714] p-6 text-white sm:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[38px] border-[#f05a3a] opacity-95" />
          <div className="absolute bottom-10 left-10 h-36 w-36 rotate-12 rounded-[34px] bg-[#f3efe6]" />
          <div className="absolute bottom-24 right-12 h-32 w-32 -rotate-6 rounded-full bg-[#ff8c70]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff8c70]">Monday · Wednesday · Friday</p><p className="mt-3 max-w-sm text-3xl font-medium leading-tight">Three original episodes. One consistent character.</p></div>
            <div className="ml-auto w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"><p className="text-xs font-bold uppercase tracking-[.14em] text-white/55">Format</p><p className="mt-2 text-xl font-medium">8-second vertical video</p><p className="mt-2 text-sm leading-6 text-white/60">Script, caption, private video, and approval status in one workspace.</p></div>
          </div>
        </div>
      </div>
    </section>

    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr]">
          <aside className="border-t border-[#191714]/25 pt-5"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#d94326]">A simple recurring offer</p><h2 className="mt-4 text-4xl font-medium tracking-[-.04em]">Set the character once. Build the story every week.</h2></aside>
          <div className="grid sm:grid-cols-3">{steps.map(([number, title, copy], index) => <article key={number} className={`min-h-72 border-[#191714]/12 p-5 sm:p-6 ${index ? "border-t sm:border-l sm:border-t-0" : ""}`}><span className="text-xs font-bold text-[#d94326]">{number}</span><h3 className="mt-10 text-2xl font-medium tracking-[-.025em]">{title}</h3><p className="mt-4 text-sm leading-6 text-[#655f56]">{copy}</p></article>)}</div>
        </div>
      </div>
    </section>

    <section className="bg-[#e9e2d6] py-16 sm:py-20">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_.85fr] lg:items-center">
        <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#d94326]">What the subscription includes</p><h2 className="mt-4 text-4xl font-medium tracking-[-.04em]">A real production queue—not an unlimited-generation promise.</h2><ul className="mt-6 grid gap-x-7 sm:grid-cols-2">{["Three episode drafts per week", "Original character continuity", "Eight-second vertical video", "Caption with each episode", "Private tenant-scoped storage", "Human review before publishing", "Pause control", "Rights and likeness confirmation"].map((item) => <li key={item} className="flex min-h-12 items-center gap-3 border-b border-[#191714]/10 text-sm"><span className="h-1.5 w-1.5 rounded-full bg-[#f05a3a]" />{item}</li>)}</ul></div>
        <div className="rounded-[28px] bg-[#fffdf8] p-6 shadow-[0_24px_70px_rgba(25,23,20,.12)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">Included with WOVO</p><p className="mt-4 text-5xl font-medium tracking-[-.06em]">No separate cartoon plan.</p><p className="mt-6 border-t border-[#191714]/10 pt-5 text-sm leading-6 text-[#655f56]">Cartoons use the same creation credits as images and videos. Choose a recurring workspace or purchase one-time credits without a subscription.</p><Link href="/signup?next=/portal" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-sm font-bold text-[#191714]">Start free</Link><div className="mt-4 flex flex-wrap gap-x-4 text-xs font-bold text-[#655f56]"><Link href="/pricing" className="inline-flex min-h-10 items-center underline underline-offset-4">See pricing</Link><Link href="/terms-of-use" className="inline-flex min-h-10 items-center underline underline-offset-4">Terms</Link></div></div>
      </div>
    </section>
  </main>;
}
