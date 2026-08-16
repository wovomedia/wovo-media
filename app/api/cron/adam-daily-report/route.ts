import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runEnabledDailyReports } from "@/lib/adam/daily-report";
import { processCartoonProduction } from "@/lib/cartoon/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = getEnv("CRON_SECRET");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const [results, cartoon] = await Promise.all([
    runEnabledDailyReports(),
    processCartoonProduction({ limit: 6 }).catch((error) => ({
      error: error instanceof Error ? error.message.slice(0, 120) : "Cartoon production failed safely.",
      enqueued: 0,
      submitted: 0,
      completed: 0,
    })),
  ]);
  const counts = results.reduce<Record<string, number>>((totals, result) => {
    totals[result.status] = (totals[result.status] ?? 0) + 1;
    return totals;
  }, {});
  return NextResponse.json({ processed: results.length, statusCounts: counts, cartoon }, { headers: { "Cache-Control": "private, no-store" } });
}
