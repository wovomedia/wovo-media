import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Weekly Marketing Workspace for Independent Businesses",
  description: "Turn your business context into a clear weekly content plan, approval queue, private asset library, and organized WOVO support. Plans start at $15/month.",
  alternates: { canonical: "/" },
};

const productSections = ["This week", "Content", "Calendar", "Support", "Bookings"];

const queue = [
  { day: "Tue", title: "Weekend offer", channel: "Social post", status: "Needs approval" },
  { day: "Thu", title: "Project update", channel: "Social post", status: "Ready to post" },
  { day: "Sat", title: "Behind the scenes", channel: "Story idea", status: "Draft" },
];

const included = [
  ["Brand profile", "Business context, audience, offers, voice, and approved source material."],
  ["Weekly planning", "Ideas and caption drafts organized into a usable time-bounded queue."],
  ["Approval workflow", "Review, revise, copy, and mark work posted with a person in control."],
  ["Private library", "Keep business-owned photos and videos in a tenant-scoped workspace."],
  ["WOVO support", "Open private cases with the organization, not individual staff accounts."],
  ["Bookings & billing", "Manage service requests, meetings, subscription status, and cancellation."],
];

export default function HomePage() {
  return (
    <main>
      <section className="overflow-hidden border-b border-[#191714]/10">
        <div className="mx-auto grid max-w-[1280px] gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-28">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">A weekly marketing operating system</p>
            <h1 className="mt-6 max-w-3xl text-[clamp(3rem,7vw,6.4rem)] font-medium leading-[0.9] tracking-[-0.055em] text-[#191714]">
              Make the week make sense.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#655f56]">
              Turn your business context into a focused content plan, approval queue, private asset library, and organized WOVO support—without pretending marketing runs itself.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup?next=/portal" className="inline-flex min-h-13 items-center justify-center rounded-full bg-[#191714] px-7 text-sm font-bold text-white transition hover:bg-[#f05a3a]">
                Start for $15/month
              </Link>
              <Link href="/product" className="inline-flex min-h-13 items-center justify-center rounded-full border border-[#191714]/25 px-7 text-sm font-bold text-[#191714] transition hover:bg-white/55">
                See the workspace
              </Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#777067]">Choose monthly, every-three-months, or yearly billing. Human production services are separate paid add-ons or quotes.</p>
          </div>

          <div id="product" className="relative scroll-mt-28">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#f05a3a]/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[30px] border border-[#191714]/15 bg-[#fffdf8] shadow-[0_38px_90px_rgba(25,23,20,.17)]">
              <div className="flex items-center justify-between border-b border-[#191714]/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f05a3a]" />
                  <span className="text-[11px] font-black tracking-[-0.04em]">WOVO</span>
                </div>
                <span className="rounded-full bg-[#eee8dc] px-3 py-1.5 text-[10px] font-bold text-[#655f56]">Client workspace</span>
              </div>
              <div className="grid min-h-[460px] sm:grid-cols-[145px_1fr]">
                <aside className="hidden border-r border-[#191714]/10 bg-[#f8f4ec] p-4 sm:block">
                  <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8b8378]">Workspace</p>
                  {productSections.map((item, index) => (
                    <div key={item} className={`mb-1 rounded-xl px-3 py-2.5 text-xs font-semibold ${index === 0 ? "bg-[#191714] text-white" : "text-[#716a60]"}`}>
                      {item}
                    </div>
                  ))}
                </aside>
                <div className="p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d94326]">This week</p>
                      <h2 className="mt-2 text-3xl font-medium tracking-[-0.035em]">Your plan at a glance</h2>
                    </div>
                    <span className="rounded-full border border-[#191714]/10 px-3 py-2 text-[10px] font-semibold text-[#655f56]">3 items</span>
                  </div>
                  <div className="mt-7 grid grid-cols-3 gap-2">
                    {[["3", "Planned"], ["1", "Review"], ["1", "Ready"]].map(([value, label]) => (
                      <div key={label} className="rounded-2xl bg-[#f3efe6] p-3">
                        <p className="text-2xl font-medium">{value}</p>
                        <p className="mt-1 text-[10px] font-semibold text-[#777067]">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 space-y-2">
                    {queue.map((item) => (
                      <div key={item.title} className="grid grid-cols-[38px_1fr] gap-3 rounded-2xl border border-[#191714]/10 bg-white/70 p-3 sm:grid-cols-[38px_1fr_auto] sm:items-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#191714] text-[10px] font-bold text-white">{item.day}</div>
                        <div>
                          <p className="text-xs font-bold">{item.title}</p>
                          <p className="mt-1 text-[10px] text-[#81796f]">{item.channel}</p>
                        </div>
                        <span className="col-start-2 w-fit rounded-full bg-[#f6ded6] px-2.5 py-1 text-[9px] font-bold text-[#a9341f] sm:col-auto">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7e776d]">Product preview based on the live WOVO workspace</p>
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
            Start for $15/month
          </Link>
        </div>
      </section>
    </main>
  );
}
