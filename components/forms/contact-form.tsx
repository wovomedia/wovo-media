"use client";

import { FormEvent, useState } from "react";
import { brand } from "@/data/site-content";
import { Button } from "@/components/ui/button";

type FormStatus = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? ""),
      business: String(formData.get("business") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      state: String(formData.get("state") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      needs: String(formData.get("message") ?? ""),
      source: "wovomedia.com-redesign",
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Submission failed");
      }

      setStatus("success");
      form.reset();
      window.setTimeout(() => setStatus("idle"), 5000);
    } catch (submitError) {
      setStatus("error");
      const message =
        submitError instanceof Error ? submitError.message : "Something went wrong while submitting.";
      setError(message);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="name">
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[var(--wm-accent)]/25"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[var(--wm-accent)]/25"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="business">
          Business
        </label>
        <input
          id="business"
          name="business"
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[var(--wm-accent)]/25"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          required
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[var(--wm-accent)]/25"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="state">
          State
        </label>
        <input
          id="state"
          name="state"
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[var(--wm-accent)]/25"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="industry">
          Industry
        </label>
        <input
          id="industry"
          name="industry"
          placeholder="Restaurant, home services, retail..."
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[var(--wm-accent)]/25"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="Tell us what growth goal you want to hit in the next 90 days."
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[var(--wm-accent)]/25"
        />
      </div>

      <div className="md:col-span-2">
        <Button className="w-full sm:w-auto" size="lg" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Submitting..." : "Send request"}
        </Button>
      </div>

      {status === "success" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 md:col-span-2">
          Thanks, we received your request. For urgent questions, call or text{" "}
          <a className="font-semibold underline" href={`sms:${brand.phone}`}>
            {brand.phoneDisplay}
          </a>
          .
        </p>
      ) : null}

      {status === "error" ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 md:col-span-2">
          Submission failed: {error}. You can also email{" "}
          <a className="font-semibold underline" href={`mailto:${brand.email}`}>
            {brand.email}
          </a>
          .
        </p>
      ) : null}
    </form>
  );
}
