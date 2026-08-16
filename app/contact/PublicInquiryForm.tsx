"use client";

import { FormEvent, useState } from "react";

const inputClass = "mt-1 min-h-12 w-full rounded-xl border border-[#191714]/15 bg-white/70 px-3.5 text-sm text-[#191714] outline-none transition focus:border-[#f05a3a] focus:ring-2 focus:ring-[#f05a3a]/15";

export function PublicInquiryForm() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [caseReference, setCaseReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/public-inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        subject: form.get("subject"),
        message: form.get("message"),
        company: form.get("company"),
        consentConfirmed: form.get("consent") === "on",
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; caseReference?: string };
    setSending(false);
    if (!response.ok) {
      setError(result.error ?? "The inquiry could not be sent. Please try again.");
      return;
    }
    if (result.caseReference) setCaseReference(result.caseReference);
    event.currentTarget.reset();
  }

  if (caseReference) {
    return (
      <div role="status" className="rounded-[28px] border border-[#f05a3a]/25 bg-[#fffdf8] p-7 sm:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#d94326]">Inquiry received</p>
        <h2 className="mt-5 text-4xl font-medium tracking-[-.04em]">The WOVO team has your message.</h2>
        <p className="mt-4 text-sm leading-6 text-[#655f56]">Keep this private case reference for follow-up:</p>
        <p className="mt-4 font-mono text-lg font-bold text-[#a9341f]">{caseReference}</p>
        <p className="mt-5 text-xs leading-5 text-[#7a7369]">A team member will review the inquiry. Sending this form does not create a client account or start billing.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-[#191714]/15 bg-[#fffdf8] p-7 sm:p-10">
      <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#d94326]">Public inquiry</p>
      <h2 className="mt-5 text-4xl font-medium tracking-[-.04em]">Message the WOVO team.</h2>
      <p className="mt-4 text-sm leading-6 text-[#655f56]">No WOVO account is required. Required fields are marked below.</p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Name *
          <input required name="name" minLength={2} maxLength={120} autoComplete="name" className={inputClass} />
        </label>
        <label className="text-sm font-semibold">Email *
          <input required name="email" type="email" maxLength={320} autoComplete="email" className={inputClass} />
        </label>
        <label className="text-sm font-semibold">Phone <span className="font-normal text-[#81796f]">(optional)</span>
          <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} />
        </label>
        <label className="text-sm font-semibold">Subject *
          <input required name="subject" minLength={3} maxLength={160} className={inputClass} />
        </label>
        <label className="hidden" aria-hidden="true">Company website
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">Message *
          <textarea required name="message" minLength={10} maxLength={5000} rows={7} className={`${inputClass} py-3`} />
        </label>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[#f05a3a]/20 bg-[#f05a3a]/8 p-4 text-sm leading-6 text-[#655f56]">
        <input required name="consent" type="checkbox" className="mt-1 h-4 w-4 accent-[#f05a3a]" />
        <span>I consent to WOVO Media using these details to respond to this inquiry. I will not include passwords, payment-card data, or highly sensitive personal information.</span>
      </label>
      <button disabled={sending} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#191714] px-6 text-sm font-bold text-white transition hover:bg-[#f05a3a] hover:text-[#191714] disabled:opacity-55">
        {sending ? "Sending securely…" : "Send inquiry"}
      </button>
      <p className="mt-4 text-xs leading-5 text-[#81796f]">The form is rate-limited and routed to WOVO’s private team inbox. Response timing depends on request volume.</p>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-700/15 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    </form>
  );
}
