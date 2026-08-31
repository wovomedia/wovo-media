import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Weekly Marketing Workspace for Independent Businesses",
  description: "Create videos, images, cartoons, websites, and campaigns in one WOVO workspace. Plans start at $44.99/month or use one-time credits.",
  alternates: { canonical: "/" },
};

const included = [
  ["Brand profile", "Business context, audience, offers, voice, and approved source material."],
  ["Weekly planning", "Ideas and caption drafts organized into a usable time-bounded queue."],
  ["Approval workflow", "Review, revise, copy, and mark work posted with a person in control."],
  ["Private library", "Keep business-owned photos and videos in a tenant-scoped workspace."],
  ["WOVO support", "Open private cases with the organization, not individual staff accounts."],
  ["Bookings & billing", "Manage service requests, meetings, subscription status, and cancellation."],
];

const creationTools = [
  ["AI Images", "Create campaign art, product images, and social graphics from a prompt or reference."],
  ["AI Video", "Generate vertical reels, cinematic ads, image-to-video concepts, and story sequences."],
  ["Cartoon Studio", "Build recurring characters, episode briefs, voice-ready scripts, and animated series."],
  ["Social Campaigns", "Create captions, hashtags, carousels, posting plans, and approval-ready schedules."],
  ["Website Builder", "Draft landing pages, storefronts, service sites, and editable section-based concepts."],
  ["AI Music & Music Video", "Create song concepts, lyrics, visual treatments, and synchronized music-video briefs."],
  ["Face-to-Motion", "Prepare consent-based face and body references for supported motion workflows."],
  ["Adam Project Chat", "Open any project, attach a logo, request revisions, and continue the same creative thread."],
];

const creationVisuals = [
  ["/wovo-product-scenes-2.png", "0% 0%"],
  ["/wovo-product-scenes-2.png", "100% 0%"],
  ["/wovo-product-scenes.png", "0% 0%"],
  ["/wovo-product-scenes.png", "100% 100%"],
  ["/wovo-product-scenes.png", "0% 100%"],
  ["/wovo-product-scenes.png", "100% 0%"],
  ["/wovo-product-scenes-2.png", "0% 100%"],
  ["/wovo-product-scenes-2.png", "100% 100%"],
] as const;

export default function HomePage() {
  return (
    <main>
      <section className="overflow-hidden border-b border-[#191714]/10">
        <div className="mx-auto grid max-w-[1380px] gap-12 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:py-24">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">A weekly marketing operating system</p>
            <h1 className="mt-6 max-w-3xl text-[clamp(3rem,6vw,5.8rem)] font-medium leading-[0.92] tracking-[-0.055em] text-[#191714]">
              Create it. Approve it. Put it to work.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#655f56]">
              Build videos, images, campaigns, and a weekly publishing queue from one private workspace—then approve exactly what moves forward.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup?next=/portal" className="inline-flex min-h-13 items-center justify-center rounded-full bg-[#191714] px-7 text-sm font-bold text-white transition hover:bg-[#f05a3a]">
                Start free
              </Link>
              <Link href="/product" className="inline-flex min-h-13 items-center justify-center rounded-full border border-[#191714]/25 px-7 text-sm font-bold text-[#191714] transition hover:bg-white/55">
                See the workspace
              </Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#777067]">Choose monthly, every 3 months, every 6 months, or yearly billing—or buy one-time credits without a subscription. Human production services remain separate paid add-ons or quotes.</p>
          </div>

          <div id="product" className="relative scroll-mt-28">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#f05a3a]/20 blur-3xl" />
            <div className="relative min-h-[610px] overflow-hidden rounded-[34px] border border-black/15 bg-[#0d0c0b] text-white shadow-[0_38px_100px_rgba(25,23,20,.32)]">
              <Image src="/wovo-creator-hero.png" alt="WOVO creator suite showing animation, food advertising, real estate, music, and vertical video" fill priority sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover object-center opacity-95" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-black/40" />
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f05a3a]" />
                  <span className="text-[11px] font-black tracking-[-0.04em]">WOVO STUDIO</span>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-bold text-white/65">Private workspace</span>
              </div>
              <div className="absolute inset-x-4 bottom-4 z-10 rounded-[24px] border border-white/15 bg-[#171513]/90 p-3 shadow-2xl backdrop-blur-xl sm:inset-x-8 sm:bottom-7 sm:p-4">
                <p className="px-2 py-3 text-sm font-medium text-white/80">Describe the video, image, cartoon, song, or campaign you want to make…</p>
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  {["Video", "Image", "Cartoon", "Music"].map((item, index) => <span key={item} className={`rounded-xl px-3 py-2 text-[10px] font-bold ${index === 0 ? "bg-[#f05a3a] text-[#191714]" : "bg-white/[.07] text-white/65"}`}>{item}</span>)}
                  <span className="rounded-xl bg-white/[.07] px-3 py-2 text-[10px] font-bold text-white/65">9:16</span>
                  <span className="ml-auto inline-flex min-h-10 items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-xs font-black text-[#191714]">Generate →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 bg-[#191714] py-20 text-white sm:py-28">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ff8c70]">A visible workflow</p>
              <h2 className="mt-5 max-w-lg text-4xl font-medium leading-[1.03] tracking-[-0.04em] sm:text-6xl">From business context to a shippable week.</h2>
            </div>
            <div className="divide-y divide-white/15 border-y border-white/15">
              {[
                ["01", "Set the operating context", "Capture the audience, offers, voice, cadence, and approved assets."],
                ["02", "Build the week", "Draft ideas and captions into one visible calendar and review queue."],
                ["03", "Review and post", "Approve, revise, copy, and mark work posted with a human in the loop."],
              ].map(([step, title, copy]) => (
                <article key={step} className="grid gap-3 py-7 sm:grid-cols-[52px_1fr]">
                  <span className="text-xs font-bold text-[#ff8c70]">{step}</span>
                  <div>
                    <h3 className="text-2xl font-medium">{title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#191714]/10 bg-[#fffdf8] py-20 sm:py-28">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#d94326]">WOVO creation suite</p><h2 className="mt-4 max-w-3xl text-4xl font-medium leading-[.98] sm:text-6xl">One workspace. Every way your brand creates.</h2></div><Link href="/signup?next=/portal" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#191714] px-6 text-sm font-bold text-white">Open the studio</Link></div><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{creationTools.map(([title, copy], index) => { const visual = creationVisuals[index]; const moving = index === 1 || index === 5; return <article key={title} className="group overflow-hidden rounded-[24px] border border-[#191714]/12 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="relative h-44 overflow-hidden bg-[#171513]"><div className={`absolute -inset-3 bg-[length:200%_200%] transition duration-700 ${moving ? "wm-media-drift" : "group-hover:scale-110"}`} style={{backgroundImage: `url('${visual[0]}')`, backgroundPosition: visual[1]}} /><div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" /><span className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-[#f05a3a] text-xs font-black">{String(index + 1).padStart(2, "0")}</span>{moving ? <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-white backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-[#f05a3a]" /> Moving preview</span> : null}</div><div className="p-5"><h3 className="text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#655f56]">{copy}</p></div></article>})}</div></div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Inside the subscription</p>
            <h2 className="mt-5 text-4xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-6xl">The practical pieces, in one place.</h2>
          </div>
          <div className="mt-12 grid border-l border-t border-[#191714]/15 sm:grid-cols-2 lg:grid-cols-3">
            {included.map(([title, copy], index) => (
              <article key={title} className="min-h-56 border-b border-r border-[#191714]/15 p-6 sm:p-8">
                <span className="text-[10px] font-bold text-[#d94326]">0{index + 1}</span>
                <h3 className="mt-8 text-2xl font-medium tracking-[-0.02em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#6d665d]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#191714]/10 bg-[#fffdf8] py-20 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Clear service boundaries</p>
            <h2 className="mt-5 text-4xl font-medium leading-[1.04] tracking-[-0.04em] sm:text-5xl">Software first. Human craft when you need it.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#655f56]">The workspace subscription does not quietly bundle production labor. On-site shoots, commercial drone work, website projects, custom editing, and additional staff time are separately approved and priced.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["On-site production", "Commercial drone work", "Website projects", "Custom editing"].map((item) => (
              <div key={item} className="rounded-2xl border border-[#191714]/12 bg-[#f3efe6] p-5">
                <p className="font-semibold">{item}</p>
                <p className="mt-2 text-xs leading-5 text-[#756e64]">Separately scoped and quoted.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1280px] rounded-[34px] bg-[#f05a3a] px-6 py-14 text-center text-[#191714] sm:px-12 sm:py-20">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em]">A calmer way to run the week</p>
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-medium leading-[1] tracking-[-0.045em] sm:text-6xl">Give your marketing a place to go next.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-[#191714]/70">Create an account, verify your email, and subscribe securely through Stripe to open the private client workspace.</p>
          <Link href="/signup?next=/portal" className="mt-8 inline-flex min-h-13 items-center justify-center rounded-full bg-[#191714] px-7 text-sm font-bold text-white transition hover:bg-white hover:text-[#191714]">
            Start free
          </Link>
        </div>
      </section>
    </main>
  );
}
