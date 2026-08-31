import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260830213324_wovo_video_canonical_usage.sql",
  import.meta.url,
);

test("paid video atomically binds a durable job to canonical usage", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /add column if not exists account_id uuid references public\.wovo_portal_accounts/);
  assert.match(sql, /add column if not exists usage_request_id uuid references public\.wovo_ai_usage_requests/);
  assert.match(sql, /private\.wovo_ai_reserve_usage\([\s\S]*'video',[\s\S]*'balanced'/);
  assert.match(sql, /'video-job:' \|\| p_job_id::text/);
  assert.match(sql, /insert into public\.video_jobs\([\s\S]*usage_request_id/);
  assert.match(sql, /status <> 'failed'/);
  assert.match(sql, /account\.archived_at is null/);
});

test("video completion finalizes and failure releases the same reservation", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /function public\.wovo_video_fail_job[\s\S]*private\.wovo_ai_release_usage\(/);
  assert.match(sql, /function public\.wovo_video_complete_job[\s\S]*private\.wovo_ai_finalize_usage\(/);
  assert.match(sql, /if v_job\.status = 'completed' then return v_job; end if;/);
  assert.match(sql, /if v_job\.status = 'failed' then raise exception 'Failed video job cannot be completed'; end if;/);
});

test("video metering RPCs are service-only", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const signature of [
    "wovo_video_create_reserved_job\\(uuid, uuid, uuid, text, integer, bigint, jsonb\\)",
    "wovo_video_fail_job\\(uuid, uuid, text\\)",
    "wovo_video_complete_job\\(uuid, uuid, text, jsonb\\)",
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*?to service_role;`));
  }
});

test("the paid endpoint reserves before calling fal and no longer requires a subscription", async () => {
  const source = await readFile(
    new URL("../app/api/wovo/video/route.ts", import.meta.url),
    "utf8",
  );

  const reserveIndex = source.indexOf('"/rest/v1/rpc/wovo_video_create_reserved_job"');
  const providerIndex = source.indexOf("await createFalVideoJob(");
  assert.ok(reserveIndex >= 0 && providerIndex > reserveIndex);
  assert.match(source, /Select a valid workspace before creating video/);
  assert.match(source, /prompt\.length < 3 \|\| prompt\.length > 6000/);
  assert.match(source, /reserved_credits: isWorkspacePreview \|\| ownerExempt \? 0 : quote\.customerCredits/);
  assert.match(source, /context\.mode === "staff" && context\.staffRole === "owner"/);
  assert.match(source, /job\.status !== "failed"/);
  assert.doesNotMatch(source, /getSubscriptionStatus|guardAiRequest|Pro features/);
});

test("provider polling persists output before finalizing or releases on failure", async () => {
  const source = await readFile(
    new URL("../app/api/wovo/video/[jobId]/route.ts", import.meta.url),
    "utf8",
  );

  const uploadIndex = source.indexOf('.storage.from("wovo-portal-assets").upload(');
  const completeIndex = source.indexOf('"/rest/v1/rpc/wovo_video_complete_job"');
  assert.ok(uploadIndex >= 0 && completeIndex > uploadIndex);
  assert.match(source, /"\/rest\/v1\/rpc\/wovo_video_fail_job"/);
});

test("video cron is secret-protected and only reconciles recent submitted jobs", async () => {
  const [route, worker, config] = await Promise.all([
    readFile(new URL("../app/api/cron/video-jobs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/wovo-ai/video-reconciler.ts", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  const schedulerAuth = await readFile(new URL("../lib/cron/scheduler-auth.ts", import.meta.url), "utf8");
  const supabaseCron = await readFile(new URL("../supabase/migrations/20260831190000_wovo_media_social_supabase_hourly_triggers.sql", import.meta.url), "utf8");
  assert.match(route, /authorizedCronRequest/);
  assert.match(schedulerAuth, /CRON_SECRET/);
  assert.match(schedulerAuth, /timingSafeEqual/);
  assert.match(schedulerAuth, /wovo-scheduler:\$\{pathname\}/);
  assert.match(worker, /provider=eq\.fal/);
  assert.match(worker, /provider_job_id=not\.is\.null/);
  assert.match(worker, /created_at=gte\./);
  assert.match(worker, /created_at=lt\./);
  assert.match(worker, /video_reconciliation_window_expired/);
  assert.match(worker, /6 \* 60 \* 60 \* 1000/);
  assert.match(worker, /wovo_video_complete_job/);
  assert.match(worker, /wovo_video_fail_job/);
  assert.doesNotMatch(worker, /createFalVideoJob/);
  assert.equal(JSON.parse(config).crons.some((cron: { path: string }) => cron.path === "/api/cron/video-jobs"), false);
  assert.match(supabaseCron, /wovo-media-reconciliation-hourly/);
  assert.match(supabaseCron, /5 \* \* \* \*/);
  assert.match(supabaseCron, /\/api\/cron\/video-jobs/);
});
