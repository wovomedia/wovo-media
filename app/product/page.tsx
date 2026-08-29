import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WOVO Product | Weekly Marketing Workspace",
  description: "Explore WOVO's private brand profile, weekly content queue, calendar, asset library, bookings, billing, and shared team support.",
  alternates: { canonical: "/product" },
};

const workspaceSections = [
  ["This week", "A focused operating view of planned, in-review, and ready-to-post work."],
  ["Content queue", "Draft, revise, approve, copy, and mark work posted with human control."],
  ["Calendar", "See post timing, consultations, shoots, and content deadlines together."],
  ["Private assets", "Store business-owned photos and videos in a tenant-scoped library."],
  ["WOVO support", "Open private organization-level cases without exposing personal staff accounts."],
  ["Bookings & billing", "Manage recurring access, cancellation, and separately priced service requests."],
];

export default function ProductPage() {
  return (
    <main>
      <section className="border-b border-[#191714]/10 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.24em] text-[#d94326]">The WOVO product</p>
            <h1 className="mt-6 text-[clamp(3rem,7vw,6.1rem)] font-medium leading-[.92] tracking-[-.055em]">Give the week one operating view.</h1>
          </div>
          <div>
            <p className="max-w-2xl text-lg leading-8 text-[#655f56]">WOVO turns approved business context into an organized marketing week: a visible plan, a review queue, private assets, bookings, billing, and a shared support path.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup?next=/portal" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#191714] px-6 text-sm font-bold text-white transition hover:bg-[#f05a3a] hover:text-[#191714]">Start free</Link>
              <Link href="/workflow" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#191714]/25 px-6 text-sm font-bold">See the workflow</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid border-l border-t border-[#191714]/15 sm:grid-cols-2 lg:grid-cols-3">
            {workspaceSections.map(([title, copy], index) => (
              <article key={title} className="min-h-60 border-b border-r border-[#191714]/15 p-6 sm:p-8">
                <span className="text-xs font-bold text-[#d94326]">0{index + 1}</span>
                <h2 className="mt-8 text-2xl font-medium tracking-[-.025em]">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#6d665d]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#191714]/10 bg-[#fffdf8] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-2">
          <article className="rounded-[28px] bg-[#191714] p-7 text-white sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#ff8c70]">Live foundation</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-.04em]">Private and human-controlled.</h2>
            <p className="mt-4 text-sm leading-6 text-white/60">Client access requires a verified account and active subscription. Generated work stays reviewable; native social publishing is not claimed without compliant platform connections.</p>
          </article>
          <article className="rounded-[28px] border border-[#f05a3a]/25 bg-[#f05a3a]/8 p-7 sm:p-10">
            <div className="inline-flex rounded-full bg-[#f05a3a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em]">Included workspace</div>
            <h2 className="mt-5 text-4xl font-medium tracking-[-.04em]">One private WOVO channel.</h2>
            <p className="mt-4 text-sm leading-6 text-[#655f56]">Clients can open a case, keep the full conversation together, and see status without exposing individual staff accounts. WOVO handles internal assignment behind the shared organization identity.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
