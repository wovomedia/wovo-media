import type { Metadata } from "next";
import { verifyUnsubscribeToken } from "@/lib/adam/outreach";

export const metadata: Metadata = { title: "Email preferences | WOVO Media", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = (() => { try { return Boolean(verifyUnsubscribeToken(token)); } catch { return false; } })();
  return <main className="min-h-screen bg-[#f3efe6] px-5 py-20 text-[#191714]"><section className="mx-auto max-w-xl rounded-[24px] border border-[#191714]/10 bg-[#fffdf8] p-7 shadow-[0_18px_60px_rgba(25,23,20,.08)] sm:p-10"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94326]">WOVO email preferences</p><h1 className="mt-3 text-3xl font-medium">Stop outreach emails</h1>{valid ? <><p className="mt-4 text-sm leading-6 text-[#655f56]">This stops future WOVO marketing outreach to the address associated with this private link. It does not affect account, billing, security, or requested support messages.</p><form action={`/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`} method="post" className="mt-6"><button className="min-h-12 rounded-xl bg-[#191714] px-5 text-sm font-bold text-white">Unsubscribe</button></form></> : <p className="mt-4 text-sm leading-6 text-[#655f56]">This preference link is invalid or expired. No account information was disclosed.</p>}</section></main>;
}
