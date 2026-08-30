import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260830164549_wovo_user_signup_credit_grant.sql",
  import.meta.url,
);

test("signup grants are unique per authenticated user and fixed at 10 credits", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /user_id uuid primary key references auth\.users\(id\)/);
  assert.match(sql, /credits_granted integer not null default 10 check \(credits_granted = 10\)/);
  assert.match(sql, /'signup-credit:' \|\| p_user_id::text/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /private\.wovo_portal_apply_credit_entry\(/);
  assert.match(sql, /'applied', false,[\s\S]*'credits', 0/);
  assert.match(sql, /'applied', true,[\s\S]*'credits', 10/);
});

test("signup grant cannot be called from a browser role", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /revoke all on function public\.wovo_grant_signup_credits\(uuid, uuid\)[\s\S]*from public, anon, authenticated;/,
  );
  assert.match(
    sql,
    /grant execute on function public\.wovo_grant_signup_credits\(uuid, uuid\)[\s\S]*to service_role;/,
  );
  assert.match(sql, /alter table public\.wovo_signup_credit_grants enable row level security;/);
});

test("onboarding applies the grant only after workspace membership is created", async () => {
  const source = await readFile(
    new URL("../app/api/portal/route.ts", import.meta.url),
    "utf8",
  );
  const onboardStart = source.indexOf("async function onboard(");
  const onboardEnd = source.indexOf("async function assertPaid(", onboardStart);
  const onboard = source.slice(onboardStart, onboardEnd);

  const membershipIndex = onboard.indexOf('supabaseServiceRoleRequest("/rest/v1/wovo_portal_members"');
  const grantIndex = onboard.indexOf('"/rest/v1/rpc/wovo_grant_signup_credits"');
  assert.ok(membershipIndex >= 0, "onboarding must create a membership");
  assert.ok(grantIndex > membershipIndex, "the grant must run after membership exists");
  assert.match(onboard, /signupCreditGrant\.credits !== 0 && signupCreditGrant\.credits !== 10/);
  assert.match(onboard, /signupCreditGrant\.applied !== \(signupCreditGrant\.credits === 10\)/);
  assert.match(onboard, /signupCreditGrant\.applied \? "applied" : "already_used"/);
});
