"use client";

import { useState } from "react";

const TIME_SLOTS = [
  { label: "12:00 PM – 1:00 PM", value: "12:00 PM" },
  { label: "1:00 PM – 2:00 PM",  value: "1:00 PM"  },
  { label: "2:00 PM – 3:00 PM",  value: "2:00 PM"  },
  { label: "3:00 PM – 4:00 PM",  value: "3:00 PM"  },
  { label: "4:00 PM – 5:00 PM",  value: "4:00 PM"  },
  { label: "5:00 PM – 6:00 PM",  value: "5:00 PM"  },
  { label: "6:00 PM – 7:00 PM",  value: "6:00 PM"  },
  { label: "7:00 PM – 8:00 PM",  value: "7:00 PM"  },
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW    = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function buildCalendar(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDow, daysInMonth };
}

export default function BookingWidget() {
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDay,   setSelDay]   = useState<number | null>(null);
  const [selTime,  setSelTime]  = useState<string | null>(null);
  const [meetType, setMeetType] = useState<"video" | "phone">("video");
  const [form, setForm] = useState({ fname:"", lname:"", email:"", phone:"", biz:"", goal:"" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const changeMonth = (dir: number) => {
    let m = calMonth + dir, y = calYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setCalMonth(m); setCalYear(y); setSelDay(null);
  };

  const { firstDow, daysInMonth } = buildCalendar(calYear, calMonth);

  const isDayDisabled = (d: number) => {
    const date = new Date(calYear, calMonth, d);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date < todayMidnight) return true;        // past
    if (date.getDay() === 0)  return true;        // Sunday
    return false;
  };

  const handleSubmit = async () => {
    if (!form.fname || !form.email || !selDay || !selTime) return;
    setSending(true);
    const dateStr = `${MONTHS[calMonth]} ${selDay}, ${calYear}`;
    const payload = {
      ...form,
      date: dateStr,
      time: `${selTime} – (1 hour) CST`,
      meetingType: meetType === "video" ? "Google Meet" : "Phone Call",
      source: "wovomedia.com-booking",
    };
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch { /* still show success */ }
    setSending(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section id="book" className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Meeting Request Sent!</h2>
            <p className="text-slate-600">
              Thanks, {form.fname}! We received your request for{" "}
              <strong>{MONTHS[calMonth]} {selDay}, {calYear}</strong> at <strong>{selTime} CST</strong>.
            </p>
            <p className="mt-3 text-slate-600">
              Check <strong>{form.email}</strong> — you'll receive a Google Meet link or phone call confirmation shortly.
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Questions? Call/text <a className="font-semibold underline" href="tel:9314583255">(931) 458-3255</a> or email{" "}
              <a className="font-semibold underline" href="mailto:Payton@wovomedia.com">Payton@wovomedia.com</a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="book" className="py-16 sm:py-20 bg-[var(--wm-muted)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-10 grid gap-6 lg:grid-cols-2 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">Free Strategy Session</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Book a 1-Hour Meeting</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Talk directly with Payton Cody, founder of Wovo Media. We'll review your social presence, map out a growth plan, and figure out the best path forward — no obligation.
            </p>
            <div className="mt-5 space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2"><span className="text-emerald-600">✓</span> 1 hour free — no sales pressure</div>
              <div className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Available Mon–Sat, 12 PM–8 PM CST</div>
              <div className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Google Meet video or phone — your choice</div>
              <div className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Get a custom plan before we hang up</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {[["🍽️","Restaurants"],["🏥","Healthcare"],["🔨","Contractors"],["🌾","Farms"],["🏛️","Government"],["🏪","Retail"],["💡","Specialty"],["🏠","Real Estate"]].map(([icon, label]) => (
              <span key={label} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">{icon} {label}</span>
            ))}
          </div>
        </div>

        {/* Booking card */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,36,0.08)] overflow-hidden">
          {/* Green header */}
          <div className="bg-[var(--wm-accent)] px-6 py-5">
            <h3 className="text-xl font-semibold text-slate-900">📅 Schedule Your Google Meet</h3>
            <p className="text-sm text-slate-800 mt-1">1-hour sessions · Mon–Sat · 12 PM–8 PM CST · Free, no obligation</p>
          </div>

          <div className="grid gap-0 lg:grid-cols-2">
            {/* Left — calendar + time */}
            <div className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">
              {/* Calendar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => changeMonth(-1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-slate-400 transition">‹</button>
                  <span className="font-semibold text-slate-900">{MONTHS[calMonth]} {calYear}</span>
                  <button onClick={() => changeMonth(1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-slate-400 transition">›</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {DOW.map(d => <div key={d} className="text-[10px] font-semibold text-slate-400 py-1">{d}</div>)}
                  {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const disabled = isDayDisabled(d);
                    const selected = selDay === d;
                    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    return (
                      <button key={d} disabled={disabled} onClick={() => { setSelDay(d); setSelTime(null); }}
                        className={`aspect-square rounded-lg text-xs font-medium transition
                          ${disabled ? "text-slate-300 cursor-not-allowed" : ""}
                          ${!disabled && !selected ? "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" : ""}
                          ${selected ? "bg-[var(--wm-accent)] text-slate-900 font-bold" : ""}
                          ${isToday && !selected ? "ring-2 ring-[var(--wm-accent)]" : ""}
                        `}>
                        {d}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-400 text-center">Sundays unavailable · All times in CST</p>
              </div>

              {/* Time slots */}
              {selDay && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Available times — {MONTHS[calMonth]} {selDay}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_SLOTS.map(slot => (
                      <button key={slot.value} onClick={() => setSelTime(slot.value)}
                        className={`rounded-xl border py-2.5 text-xs font-medium transition
                          ${selTime === slot.value
                            ? "border-[var(--wm-accent)] bg-emerald-50 text-emerald-800 font-bold"
                            : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                          }`}>
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!selDay && (
                <p className="text-sm text-slate-400 text-center py-4">← Select a date to see available times</p>
              )}
            </div>

            {/* Right — form */}
            <div className="p-6">
              {/* Meeting type */}
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Meeting type</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: "video" as const, icon: "📹", label: "Google Meet" },
                    { type: "phone" as const, icon: "📞", label: "Phone Call" },
                  ].map(opt => (
                    <button key={opt.type} onClick={() => setMeetType(opt.type)}
                      className={`rounded-xl border p-3 text-center transition
                        ${meetType === opt.type ? "border-[var(--wm-accent)] bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className="text-xl mb-1">{opt.icon}</div>
                      <div className="text-xs font-semibold text-slate-700">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form fields */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "fname", label: "First Name *", ph: "Jane" },
                    { key: "lname", label: "Last Name",    ph: "Smith" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                      <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph}
                        className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-[var(--wm-accent)] focus:ring-2 focus:ring-[var(--wm-accent)]/20" />
                    </div>
                  ))}
                </div>
                {[
                  { key: "email", label: "Email *",       ph: "jane@yourbusiness.com", type: "email" },
                  { key: "phone", label: "Phone",         ph: "(555) 000-0000",         type: "tel"   },
                  { key: "biz",   label: "Business Name & Industry", ph: "Jane's BBQ · Restaurant", type: "text" },
                  { key: "goal",  label: "What's your #1 goal?",     ph: "More customers, better social...", type: "text" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <input type={f.type} value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-[var(--wm-accent)] focus:ring-2 focus:ring-[var(--wm-accent)]/20" />
                  </div>
                ))}
              </div>

              {/* Summary */}
              {selDay && selTime && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-slate-800">📅 {MONTHS[calMonth]} {selDay}, {calYear}</p>
                  <p className="text-slate-600">{selTime} – 1 hour · {meetType === "video" ? "Google Meet" : "Phone Call"} · CST</p>
                </div>
              )}

              <button onClick={handleSubmit} disabled={sending || !form.fname || !form.email || !selDay || !selTime}
                className="mt-4 w-full rounded-xl bg-[var(--wm-accent)] py-3 font-semibold text-slate-900 shadow-[0_8px_24px_rgba(0,233,145,0.3)] transition hover:-translate-y-0.5 hover:bg-[var(--wm-accent-strong)] disabled:pointer-events-none disabled:opacity-50">
                {sending ? "Sending..." : "✓ Confirm Meeting Request"}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">
                You'll receive a confirmation email with your meeting link.{" "}
                Questions? <a className="underline" href="tel:9314583255">(931) 458-3255</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
