import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inside the WOVO Client Workspace",
  description: "See how WOVO organizes a weekly marketing plan, approval queue, calendar, private assets, bookings, billing, and shared team support.",
  alternates: { canonical: "/workspace" },
};

const sections = [
  ["This week", "See planned, review-ready, and ready-to-post work without hunting across tools."],
  ["Content", "Draft, review, revise, approve, copy, and mark posts complete with a person in control."],
  ["Calendar", "Keep post timing, consultations, shoots, and deadlines in one client-scoped view."],
  ["Support", "Open private cases with WOVO Media as an organization. Staff assignment stays internal."],
  ["Bookings", "Request consultations and separately priced on-site, drone, editing, or website services."],
];

export default function WorkspacePage() {
  return (
    <main>
      <section className="border-b border-[#191714]/10 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.24em] text-[#d94326]">The client workspace</p>
            <h1 className="mt-6 text-[clamp(3rem,7vw,6rem)] font-medium leading-[.93] tracking-[-.055em]">One place for the marketing week.</h1>
          </div>
          <div>
            <p className="max-w-2xl text-lg leading-8 text-[#655f56]">WOVO combines business context, a usable weekly queue, private assets, bookings, and a shared team inbox. The subscription is automation-first; human production remains a clearly priced add-on.</p>
            <Link href="/signup?next=/portal" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-[#191714] px-6 text-sm font-bold text-white transition hover:bg-[#f05a3a] hover:text-[#191714]">Create a verified account</Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid border-l border-t border-[#191714]/15 md:grid-cols-2 lg:grid-cols-5">
            {sections.map(([title, copy], index) => (
              <article key={title} className="min-h-64 border-b border-r border-[#191714]/15 p-6">
                <span className="text-xs font-bold text-[#d94326]">0{index + 1}</span>
                <h2 className="mt-10 text-2xl font-medium">{title}</h2>
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
            <p className="mt-4 text-sm leading-6 text-white/60">Client access requires a verified account and active subscription. AI can assist with ideas and captions, but external publishing stays reviewable and manual until compliant platform connections are configured.</p>
          </article>
          <article className="rounded-[28px] border border-[#f05a3a]/25 bg-[#f05a3a]/8 p-7 sm:p-10">
            <div className="inline-flex rounded-full bg-[#f05a3a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#191714]">Included workspace</div>
            <h2 className="mt-5 text-4xl font-medium tracking-[-.04em]">Requests stay organized.</h2>
            <p className="mt-4 text-sm leading-6 text-[#655f56]">The private inbox keeps client messages, case status, replies, and WOVO assignment history in one place. Clients see WOVO Media, not personal employee accounts.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
