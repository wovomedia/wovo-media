import { unsubscribeOutreach } from "@/lib/adam/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  await unsubscribeOutreach(token).catch(() => false);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
}
