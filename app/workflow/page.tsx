import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WOVO Workflow | From Business Context to a Shippable Week",
  description: "See how WOVO organizes approved business context into a weekly plan, review queue, manual posting workflow, and simple results snapshot.",
  alternates: { canonical: "/workflow" },
};

const stages = [
  ["01", "Set the operating context", "Capture the business, audience, offers, voice, cadence, rights confirmations, and approved source assets."],
  ["02", "Build the week", "Use AI assistance to draft ideas and captions into a time-bounded calendar and approval queue."],
  ["03", "Review with control", "Clients or authorized staff approve, request revisions, and decide what is ready to move forward."],
  ["04", "Post with a person in the loop", "The WOVO team can copy the approved caption, publish manually, and mark the work complete."],
  ["05", "Read the month simply", "Use a practical snapshot of planned, approved, posted, and pending work—without invented performance claims."],
];

export default function WorkflowPage() {
  return (
    <main>
      <section className="bg-[#191714] px-5 py-16 text-white sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[.24em] text-[#ff8c70]">The WOVO workflow</p>
          <h1 className="mt-6 max-w-5xl text-[clamp(3rem,7vw,6.2rem)] font-medium leading-[.92] tracking-[-.055em]">From business context to a week that can ship.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/55">A clear sequence keeps generated work useful, rights-aware, reviewable, and honest about where human action still matters.</p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1100px]">
          <div className="border-y border-[#191714]/15">
            {stages.map(([step, title, copy]) => (
              <article key={step} className="grid gap-5 border-b border-[#191714]/15 py-8 last:border-b-0 sm:grid-cols-[76px_1fr] sm:py-10">
                <span className="text-sm font-black text-[#d94326]">{step}</span>
                <div className="grid gap-3 lg:grid-cols-[.8fr_1.2fr]">
                  <h2 className="text-2xl font-medium tracking-[-.025em] sm:text-3xl">{title}</h2>
                  <p className="text-sm leading-7 text-[#655f56]">{copy}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-[28px] bg-[#f05a3a] p-7 sm:flex-row sm:items-center sm:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em]">Keep the boundaries clear</p>
              <p className="mt-3 max-w-xl text-2xl font-medium">The subscription organizes the software workflow. Human production services remain separate paid add-ons or quotes.</p>
            </div>
            <Link href="/pricing" className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-[#191714] px-6 text-sm font-bold text-white">Review pricing</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
