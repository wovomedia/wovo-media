import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260831003000_wovo_music_jobs.sql", "utf8");
const createRoute = readFileSync("app/api/wovo/music/route.ts", "utf8");
const jobRoute = readFileSync("app/api/wovo/music/[jobId]/route.ts", "utf8");
const reconciler = readFileSync("lib/wovo-ai/music-reconciler.ts", "utf8");
const mediaCron = readFileSync("app/api/cron/video-jobs/route.ts", "utf8");

test("music jobs reserve canonical usage before fal and refund failures", () => {
  assert.match(migration, /p_account_id, p_actor_user_id, 'music'/);
  assert.match(migration, /perform private\.wovo_ai_release_usage\(v_job\.usage_request_id/);
  assert.match(migration, /perform private\.wovo_ai_finalize_usage\(v_job\.usage_request_id/);
  assert.match(migration, /revoke all on table public\.wovo_music_jobs from public, anon, authenticated/);
  const reserveIndex = createRoute.indexOf("/rest/v1/rpc/wovo_music_create_reserved_job");
  const providerIndex = createRoute.indexOf("const provider = await createFalMusicJob");
  assert.ok(reserveIndex >= 0 && providerIndex > reserveIndex, "the durable reservation must exist before fal is called");
  assert.match(createRoute, /wovo_music_fail_job/);
  assert.match(createRoute, /ownerExempt/);
  assert.match(createRoute, /Missing bearer token/);
  assert.match(createRoute, /status === 401/);
});

test("music output is persisted privately and exposed through signed WOVO media URLs", () => {
  assert.match(reconciler, /storage\.from\("wovo-portal-assets"\)\.upload/);
  assert.match(reconciler, /wovo_music_complete_job/);
  assert.match(jobRoute, /verifyMediaAccess/);
  assert.match(jobRoute, /Content-Disposition/);
  assert.match(createRoute, /signedMediaUrl/);
});

test("authenticated media cron reconciles both video and music jobs", () => {
  assert.match(mediaCron, /reconcileRecentVideoJobs/);
  assert.match(mediaCron, /reconcileRecentMusicJobs/);
  assert.match(mediaCron, /Promise\.all/);
  assert.match(mediaCron, /MEDIA_RECONCILER_FAILED/);
});
