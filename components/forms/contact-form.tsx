"use client";
import { FormEvent, useState } from "react";
import { brand } from "@/data/site-content";
import { Button } from "@/components/ui/button";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending"); setError("");
    const fd = new FormData(e.currentTarget);
    const payload = { name: String(fd.get("name") ?? ""), business: String(fd.get("business") ?? ""), email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? ""), state: String(fd.get("state") ?? ""), industry: String(fd.get("industry") ?? ""), needs: String(fd.get("message") ?? ""), source: "wovomedia.com-contact", createdAt: new Date().toISOString() };
    try {
      const r = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(typeof (d as Record<string,unknown>).error === "string" ? String((d as Record<string,unknown>).error) : "Submission failed"); }
      setStatus("success"); (e.target as HTMLFormElement).reset(); window.setTimeout(() => setStatus("idle"), 5000);
    } catch (err) { setStatus("error"); setError(err instanceof Error ? err.message : "Something went wrong."); }
  }

  const field = (id: string, label: string, type = "text", ph = "") => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>{label}</label>
      <input id={id} name={id} type={type} placeholder={ph} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[var(--wm-accent)] focus:ring-2 focus:ring-[var(--wm-accent)]/20" />
    </div>
  );

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
      {field("name",     "Full name *",         "text",  "Jane Smith")}
      {field("email",    "Email *",             "email", "jane@business.com")}
      {field("business", "Business name",       "text",  "Jane's BBQ")}
      {field("phone",    "Phone *",             "tel",   "(555) 000-0000")}
      {field("state",    "State",               "text",  "Tennessee")}
      {field("industry", "Industry",            "text",  "Restaurant, healthcare, farm...")}
      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="message">What's your #1 goal? *</label>
        <textarea id="message" name="message" rows={4} placeholder="Tell us what growth goal you want to hit in the next 90 days." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--wm-accent)] focus:ring-2 focus:ring-[var(--wm-accent)]/20" />
      </div>
      <div className="md:col-span-2">
        <Button className="w-full sm:w-auto" size="lg" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending..." : "Send request →"}</Button>
      </div>
      {status === "success" && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 md:col-span-2">
          ✅ Thanks! We received your message. Call or text <a className="font-semibold underline" href={`tel:${brand.phone}`}>{brand.phoneDisplay}</a> for urgent questions.
        </p>
      )}
      {status === "error" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 md:col-span-2">
          ❌ {error} — Email us at <a className="font-semibold underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
        </p>
      )}
    </form>
  );
}
