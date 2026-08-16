import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WOVO Workspace Pricing — Monthly, Quarterly, or Yearly",
  description: "Choose $15 monthly, $36 every three months, or $120 yearly for the private WOVO marketing workspace. Human production stays separately scoped.",
  alternates: { canonical: "/pricing" },
};

const periods = [
  { name: "Monthly", due: "$15", cadence: "every month", effective: "$15/month", savings: "Flexible monthly billing" },
  { name: "Every 3 months", due: "$36", cadence: "every 3 months", effective: "$12/month", savings: "Save $9 each quarter · 20%" },
  { name: "Yearly", due: "$120", cadence: "every year", effective: "$10/month", savings: "Save $60 each year · 33%" },
];

const included = [
  "Business and brand profile",
  "Content ideas and caption drafts",
  "Weekly calendar and approval queue",
  "Private business-owned asset library",
  "Team-level WOVO support inbox",
  "Service and consultation requests",
  "Stripe billing and cancellation controls",
];

const separate = [
  "In-person photo and video shoots",
  "Commercial drone projects and travel",
  "Bespoke website creation",
  "Custom editing and specialist time",
  "Additional consultation participants",
  "External publishing-provider setup",
];

export default function PricingPage() {
  return <main>
    <section className="border-b border-[#191714]/10 py-16 sm:py-24">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d94326]">One workspace · three billing periods</p>
        <div className="mt-5 grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <h1 className="max-w-4xl text-[clamp(3rem,7vw,5.8rem)] font-medium leading-[0.93] tracking-[-0.055em]">Choose the rhythm that fits.</h1>
          <p className="max-w-xl text-base leading-7 text-[#655f56]">Every option opens the same WOVO workspace. Longer billing periods reduce the effective monthly cost; they do not change the feature set.</p>
        </div>
      </div>
    </section>

    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="overflow-hidden rounded-[26px] border border-[#191714]/15 bg-[#fffdf8]">
          <div className="grid border-b border-[#191714]/10 bg-[#191714] px-5 py-6 text-white sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff8c70]">WOVO Workspace</p><h2 className="mt-2 text-3xl font-medium tracking-[-.035em]">A practical marketing operating system.</h2></div>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/60 lg:mt-0">Verify your email, finish private setup, then choose one billing period before Stripe checkout.</p>
          </div>
          <div className="grid lg:grid-cols-3">
            {periods.map((period, index) => <article key={period.name} className={`p-5 sm:p-7 ${index ? "border-t border-[#191714]/10 lg:border-l lg:border-t-0" : ""}`}>
              <p className="text-sm font-bold">{period.name}</p>
              <div className="mt-5 flex items-end justify-between gap-4"><strong className="text-5xl font-medium tracking-[-.055em]">{period.due}</strong><span className="pb-1 text-right text-xs leading-5 text-[#655f56]">due today<br />then {period.cadence}</span></div>
              <p className="mt-5 border-t border-[#191714]/10 pt-4 text-sm font-semibold">{period.effective}</p>
              <p className="mt-1 text-xs leading-5 text-[#756e64]">{period.savings}</p>
            </article>)}
          </div>
          <div className="grid gap-8 border-t border-[#191714]/10 p-5 sm:p-7 lg:grid-cols-[1.2fr_.8fr]">
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#d94326]">Included in every period</p><ul className="mt-4 grid gap-x-7 sm:grid-cols-2">{included.map((item) => <li key={item} className="flex min-h-11 items-center gap-3 border-b border-[#191714]/10 py-2 text-sm"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f05a3a]" />{item}</li>)}</ul></div>
            <div className="rounded-2xl bg-[#f3efe6] p-5"><p className="text-sm font-bold">Ready to set up your workspace?</p><p className="mt-2 text-xs leading-5 text-[#655f56]">Account creation is free. No paid option is preselected. Stripe shows the total and renewal cadence again before payment.</p><Link href="/signup?next=/portal" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-sm font-bold text-[#191714] hover:bg-[#d94326]">Create account</Link></div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <aside className="border-t border-[#191714]/25 pt-5"><h2 className="text-2xl font-medium">Human work stays separate.</h2><p className="mt-3 text-sm leading-6 text-[#655f56]">Production labor, variable travel, and specialist projects are never silently bundled into the workspace price.</p></aside>
          <ul className="grid gap-x-6 sm:grid-cols-2">{separate.map((item) => <li key={item} className="flex min-h-12 items-center border-b border-[#191714]/10 text-sm font-semibold text-[#514c45]">{item}</li>)}</ul>
        </div>
        <div className="mt-8 grid gap-6 rounded-[26px] border border-[#191714]/15 bg-[#191714] p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff8c70]">Optional recurring production</p><h2 className="mt-3 text-3xl font-medium tracking-[-.035em]">Cartoon Episodes · $39.99/month</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Three original eight-second vertical cartoon drafts each week, with a consistent approved character and private review. Requires an active WOVO Workspace; the combined total is shown before checkout.</p></div>
          <Link href="/cartoon-episodes" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f05a3a] px-6 text-sm font-bold text-[#191714]">See Cartoon Episodes</Link>
        </div>
      </div>
    </section>

    <section className="border-y border-[#191714]/10 bg-[#e9e2d6] py-14">
      <div className="mx-auto grid max-w-[1180px] gap-7 px-5 sm:px-8 lg:grid-cols-3">{[
        ["Recurring billing", "Your selected total renews at the stated monthly, three-month, or yearly interval until canceled."],
        ["Easy cancellation", "Use Manage billing in the workspace to open Stripe's customer portal and stop renewal at the end of the paid period."],
        ["No automatic refund promise", "Stopping renewal does not itself create a refund. Review the posted policy before purchase."],
      ].map(([title, copy]) => <article key={title} className="border-t border-[#191714]/30 pt-4"><h2 className="text-lg font-medium">{title}</h2><p className="mt-2 text-sm leading-6 text-[#655f56]">{copy}</p></article>)}</div>
      <div className="mx-auto mt-8 flex max-w-[1180px] flex-wrap gap-x-6 px-5 text-sm font-bold text-[#5c554d] sm:px-8"><Link href="/cancellation-refund-policy" className="inline-flex min-h-11 items-center underline underline-offset-4">Cancellation & refund policy</Link><Link href="/terms-of-use" className="inline-flex min-h-11 items-center underline underline-offset-4">Terms of service</Link><Link href="/privacy-policy" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacy policy</Link></div>
    </section>
  </main>;
}
