import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Separately Scoped Production Services",
  description: "Review optional WOVO website, editing, on-site video, and commercial drone services, each separately scoped and priced.",
  alternates: { canonical: "/services" },
};

const services = [
  ["On-site production", "Photo and video shoots are scheduled, scoped, and priced separately from the software subscription."],
  ["Commercial drone work", "Requests require staff approval for date, location, travel, weather, airspace, and operating compliance before fulfillment."],
  ["Website projects", "Bespoke websites and online-ordering requests receive a defined scope and quote before work begins."],
  ["Custom editing", "Additional editing and specialist time are approved and billed as separate project work."],
];

export default function ServicesPage() {
  return (
    <main>
      <section className="border-b border-[#191714]/10 py-16 sm:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Optional human services</p>
          <h1 className="mt-6 max-w-5xl text-[clamp(3rem,7vw,6.2rem)] font-medium leading-[.92] tracking-[-0.055em]">Production when the work calls for it.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#655f56]">WOVO's workspace organizes the marketing week. Human production is never implied to be included: every project is separately scoped, approved, and priced.</p>
        </div>
      </section>
      <section className="py-16 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] border-l border-t border-[#191714]/15 px-0 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(([title, copy], index) => (
            <article key={title} className="min-h-72 border-b border-r border-[#191714]/15 p-6 sm:p-8">
              <span className="text-[10px] font-bold text-[#d94326]">0{index + 1}</span>
              <h2 className="mt-10 text-3xl font-medium leading-tight tracking-[-0.03em]">{title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#655f56]">{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-[#191714] py-16 text-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-7 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-4xl font-medium tracking-[-0.035em]">Start with the workspace.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Request optional services later from the private booking area or contact WOVO for a scoped project.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/signup?next=/portal" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f05a3a] px-6 text-sm font-bold text-[#191714]">Start free</Link>
            <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-bold">Contact WOVO</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
