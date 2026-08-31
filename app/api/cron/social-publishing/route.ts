import { NextResponse } from "next/server";
import { authorizedCronRequest } from "@/lib/cron/scheduler-auth";
import { processScheduledSocialJobs, reconcileSocialPublishJobs, reconcileStaleSocialPublishJobs } from "@/lib/publishing/service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await authorizedCronRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [scheduled, processing, stale] = await Promise.all([
      processScheduledSocialJobs(6),
      reconcileSocialPublishJobs(12),
      reconcileStaleSocialPublishJobs(4),
    ]);
    const failed = [...scheduled.results, ...processing.results, ...stale.results].filter((item) => item.state === "failed" || item.state === "check_failed");
    return NextResponse.json({ scheduled, processing, stale, failed }, { status: failed.length ? 207 : 200 });
  } catch (error) {
    const code = (error instanceof Error ? error.message : "SOCIAL_PUBLISHING_WORKER_FAILED").split(":")[0].replace(/[^A-Z0-9_]/gi, "_").slice(0, 80);
    return NextResponse.json({ error: code }, { status: 503 });
  }
}
