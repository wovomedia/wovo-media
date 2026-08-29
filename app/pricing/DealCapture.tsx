"use client";

import { FormEvent, useEffect, useState } from "react";

export default function DealCapture() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("wovo-deal-popup-seen")) return;
    const timer = window.setTimeout(() => setOpen(true), 6500);
    return () => window.clearTimeout(timer);
  }, []);

  function close() {
    sessionStorage.setItem("wovo-deal-popup-seen", "1");
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/pricing-deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent, source: "pricing_popup", company: "" }) });
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    setBusy(false);
    setMessage(response.ok ? (payload.message ?? "You’re on the list.") : (payload.error ?? "Please try again."));
    if (response.ok) window.setTimeout(close, 1200);
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 rounded-full bg-[#191714] px-5 py-3 text-sm font-bold text-white shadow-2xl ring-1 ring-white/10 hover:bg-[#d94326]">Get exclusive deals</button>;
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="deal-title">
    <section className="w-full max-w-md rounded-[26px] border border-[#191714]/15 bg-[#fffdf8] p-6 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#d94326]">WOVO deal alerts</p><h2 id="deal-title" className="mt-2 text-3xl font-medium tracking-[-.04em]">Get the best offer—not more noise.</h2></div><button type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#191714]/15" aria-label="Close">×</button></div>
      <p className="mt-3 text-sm leading-6 text-[#655f56]">Be first to hear about verified plan discounts and credit bonuses. No purchase is required.</p>
      <form className="mt-5" onSubmit={submit}><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" className="h-12 w-full rounded-xl border border-[#191714]/20 bg-white px-4 text-sm outline-none focus:border-[#d94326]" /><label className="mt-3 flex gap-3 text-xs leading-5 text-[#655f56]"><input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" /><span>I agree to receive WOVO pricing and product deal emails. I can unsubscribe at any time.</span></label><button disabled={busy} className="mt-5 h-12 w-full rounded-xl bg-[#f2563d] text-sm font-bold text-[#191714] hover:bg-[#d94326] disabled:opacity-60">{busy ? "Saving…" : "Send me exclusive deals"}</button></form>
      {message ? <p className="mt-3 text-center text-xs font-semibold">{message}</p> : null}
    </section>
  </div>;
}
