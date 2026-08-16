import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy",
  description: "How WOVO clients manage subscription renewal, cancellation, and billing questions.",
  alternates: { canonical: "/cancellation-refund-policy" },
};

export default function CancellationRefundPolicyPage() {
  return (
    <main className="py-14 sm:py-20">
      <article className="mx-auto max-w-4xl px-5 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Billing information</p>
        <h1 className="mt-5 text-5xl font-medium tracking-[-0.045em] sm:text-6xl">Cancellation & refund policy</h1>
        <p className="mt-4 text-sm text-[#756e64]">Last updated July 30, 2026</p>
        <div className="mt-10 divide-y divide-[#191714]/15 border-y border-[#191714]/15">
          <section className="py-7"><h2 className="text-2xl font-medium">Subscription renewal</h2><p className="mt-3 text-sm leading-7 text-[#5f5951]">The selected total and monthly, three-month, or yearly renewal cadence are shown in Stripe Checkout before payment. Stripe provides the authoritative receipt and billing record for a completed purchase.</p></section>
          <section className="py-7"><h2 className="text-2xl font-medium">How to cancel renewal</h2><p className="mt-3 text-sm leading-7 text-[#5f5951]">Signed-in clients can choose <strong>Manage billing & cancellation</strong> in the workspace to open Stripe's customer portal directly. Cancellation is not hidden behind a support request. Stripe shows the effective timing and remaining paid access.</p></section>
          <section className="py-7"><h2 className="text-2xl font-medium">Paid-period access and refunds</h2><p className="mt-3 text-sm leading-7 text-[#5f5951]">Stopping renewal normally leaves access available through the already-paid period and does not automatically create a refund. Refund rights required by applicable law still apply. Separately scoped services may carry additional terms shown before payment or in a written order.</p></section>
          <section className="py-7"><h2 className="text-2xl font-medium">Billing or access issue</h2><p className="mt-3 text-sm leading-7 text-[#5f5951]">Use the private WOVO support inbox or contact <a href={`mailto:${brand.supportEmail}`} className="font-bold text-[#d94326] underline underline-offset-4">{brand.supportEmail}</a>. Support can investigate an issue but is not required merely to turn off subscription renewal.</p></section>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/portal" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#191714] px-6 text-sm font-bold text-white">Open client workspace</Link>
          <Link href="/terms-of-use" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#191714]/20 px-6 text-sm font-bold">Terms of Use</Link>
          <Link href="/privacy-policy" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#191714]/20 px-6 text-sm font-bold">Privacy Policy</Link>
        </div>
      </article>
    </main>
  );
}
