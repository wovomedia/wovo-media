import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const policy = readFileSync("lib/wovo-ai/usage-policy.ts", "utf8");
const post = readFileSync("app/api/portal/generate-post/route.ts", "utf8");
const video = readFileSync("app/api/wovo/video/route.ts", "utf8");
const music = readFileSync("app/api/wovo/music/route.ts", "utf8");
const ownerCapMigration = readFileSync("supabase/migrations/20260831233000_wovo_owner_usage_policy_cap.sql", "utf8");
const privateSchemaMigration = readFileSync("supabase/migrations/20260831234000_wovo_private_schema_service_usage.sql", "utf8");
const portal = readFileSync("app/portal/page.tsx", "utf8");

test("all paid media tools initialize one canonical monthly usage policy", () => {
  assert.match(policy, /setUTCMonth\(periodEnd\.getUTCMonth\(\) \+ 1\)/);
  assert.match(policy, /subscribedPlan\?\.monthlyCredits \?\? 0/);
  assert.match(policy, /Credit-only workspaces receive no included units/);
  for (const source of [post, video, music]) assert.match(source, /ensureWorkspaceUsagePolicy/);
});

test("owner generation is exempt while customer policy stays provider-gated", () => {
  assert.match(policy, /owner \? 100000 : subscribedPlan\?\.monthlyCredits \?\? 0/);
  assert.match(policy, /provider_ready: Boolean\(getEnv\("OPENAI_API_KEY"\)/);
  assert.match(video, /!isWorkspacePreview && !ownerExempt/);
  assert.match(music, /if \(!ownerExempt\)/);
  assert.match(ownerCapMigration, /weekly_unit_limit between 1 and 1000000/);
  assert.match(ownerCapMigration, /provider cost and request-rate limits/);
  assert.match(privateSchemaMigration, /grant usage on schema private to service_role/);
  assert.match(privateSchemaMigration, /revoke usage on schema private from public, anon, authenticated/);
  assert.match(portal, /readJsonResponse/);
  assert.doesNotMatch(portal, /Unexpected token/);
});
