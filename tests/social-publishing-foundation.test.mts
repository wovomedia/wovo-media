import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260830233000_wovo_normalized_social_publishing.sql",
  import.meta.url,
);
const serviceUrl = new URL("../lib/publishing/service.ts", import.meta.url);
const tiktokUrl = new URL("../lib/publishing/providers/tiktok.ts", import.meta.url);
const youtubeUrl = new URL("../lib/publishing/providers/youtube.ts", import.meta.url);
const youtubeConnectUrl = new URL("../app/api/integrations/youtube/connect/route.ts", import.meta.url);
const connectionRouteUrl = new URL("../app/api/integrations/social/connections/route.ts", import.meta.url);
const cronUrl = new URL("../app/api/cron/social-publishing/route.ts", import.meta.url);

test("normalized connection schema keeps all providers server-only", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /provider in \('facebook','instagram','tiktok','youtube'\)/);
  assert.match(sql, /access_token_ciphertext text not null/);
  assert.match(sql, /refresh_token_ciphertext text/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.wovo_social_oauth_states, public\.wovo_social_connections, public\.wovo_social_publish_jobs[\s\S]*from public, anon, authenticated/);
});

test("published social jobs require durable provider proof", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /provider_publish_id text/);
  assert.match(sql, /provider_post_id text/);
  assert.match(sql, /status <> 'published' or \(published_at is not null and provider_post_id is not null\)/);
});

test("legacy Meta destinations are shadowed without changing publish state", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /legacy_meta_connection_id/);
  assert.match(sql, /from public\.wovo_meta_connections/);
  assert.match(sql, /on conflict \(workspace_id, owner_scope, provider, provider_account_id\) do nothing/);
  assert.doesNotMatch(sql, /update public\.wovo_meta_publish_jobs/);
});

test("scheduler selects only the current delivery window and never stale backlog", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /SOCIAL_DELIVERY_WINDOW_MS = 75 \* 60 \* 1000/);
  assert.match(source, /status=eq\.queued&scheduled_for=gte\./);
  assert.match(source, /scheduled_for=lte\./);
  assert.equal(source.match(/status=eq\.queued/g)?.length, 1);
});

test("async publishing requires provider proof and times out without proof", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /status: "published", provider_post_id: result\.providerPostId/);
  assert.match(source, /reconcileStaleSocialPublishJobs/);
  assert.match(source, /PROVIDER_PROCESSING_TIMEOUT/);
  assert.match(source, /Review the provider before retrying/);
});

test("TikTok queries creator options before official Direct Post initialization", async () => {
  const source = await readFile(tiktokUrl, "utf8");
  const creatorQuery = source.indexOf("const creator = await queryCreatorInfo");
  const directPost = source.indexOf('"/v2/post/publish/video/init/"');
  assert.ok(creatorQuery > 0 && directPost > creatorQuery);
  assert.match(source, /privacy_level_options/);
  assert.match(source, /PULL_FROM_URL/);
  assert.match(source, /TIKTOK_PRODUCTION_AUDIT_REQUIRED/);
  assert.match(source, /"SELF_ONLY"/);
});

test("YouTube requests offline upload consent and fails closed before audit", async () => {
  const connect = await readFile(youtubeConnectUrl, "utf8");
  const provider = await readFile(youtubeUrl, "utf8");
  assert.match(connect, /set\("access_type", "offline"\)/);
  assert.match(connect, /set\("prompt", "consent"\)/);
  assert.match(connect, /youtube\.upload/);
  assert.match(provider, /YOUTUBE_REFRESH_TOKEN_MISSING/);
  assert.match(provider, /YOUTUBE_API_AUDIT_REQUIRED_FOR_PUBLIC_UPLOAD/);
  assert.match(provider, /uploadType=resumable/);
});

test("connection disconnect decrypts only providers using the generic token key", async () => {
  const source = await readFile(connectionRouteUrl, "utf8");
  const revokeStart = source.indexOf("async function revokeProvider");
  const tiktokBranch = source.indexOf('connection.provider === "tiktok"', revokeStart);
  const firstDecrypt = source.indexOf("decryptSocialToken", tiktokBranch);
  assert.ok(revokeStart >= 0 && tiktokBranch > revokeStart && firstDecrypt > tiktokBranch);
});

test("cron is authenticated and reconciles current plus stale provider jobs", async () => {
  const source = await readFile(cronUrl, "utf8");
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /reconcileSocialPublishJobs/);
  assert.match(source, /reconcileStaleSocialPublishJobs/);
  assert.match(source, /status: 503/);
});
