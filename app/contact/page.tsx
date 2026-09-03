import type { Metadata } from "next";
import Link from "next/link";
import { PublicInquiryForm } from "./PublicInquiryForm";

export const metadata: Metadata = {
  title: "Contact WOVO Media Support",
  description: "Contact WOVO Media through the private client support workspace or support@wovomedia.com.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main>
      <section className="border-b border-[#191714]/10 py-16 sm:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Help & contact</p>
          <h1 className="mt-6 max-w-4xl text-[clamp(3rem,7vw,6.2rem)] font-medium leading-[.92] tracking-[-0.055em]">Reach WOVO, not a personal inbox.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#655f56]">Clients can open private cases inside their workspace. Anyone can send a general inquiry here without creating an account or exposing a personal staff inbox.</p>
        </div>
      </section>
      <section className="py-16 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-5 sm:px-8 lg:grid-cols-[.75fr_1.25fr]">
          <article className="rounded-[28px] bg-[#191714] p-7 text-white sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#ff8c70]">Existing clients</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em]">Use the private support inbox.</h2>
            <p className="mt-4 text-sm leading-6 text-white/60">Create a case, keep its reference, and receive replies from WOVO Media without exposing individual staff contact details.</p>
            <Link href="/portal" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#f05a3a] px-6 text-sm font-bold text-[#191714]">Open your workspace</Link>
          </article>
          <PublicInquiryForm />
        </div>
      </section>
    </main>
  );
}
