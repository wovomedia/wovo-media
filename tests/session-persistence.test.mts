import assert from "node:assert/strict";
import test from "node:test";

import { accessTokenExpired, isDefinitiveAuthFailure } from "../lib/supabase/session-recovery.ts";

function tokenExpiringIn(seconds: number) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString("base64url");
  return `header.${payload}.signature`;
}

test("only an auth refusal signs the person out", () => {
  for (const status of [400, 401, 403, 422]) {
    assert.equal(isDefinitiveAuthFailure({ status }), true, `status ${status} should sign out`);
  }
});

test("a flaky connection never discards a working session", () => {
  // These are the cases that were signing people out: a dropped connection, a
  // sleeping laptop, a rate limit, or Supabase having a bad minute.
  for (const error of [
    { status: null },
    { status: undefined },
    { status: 408 },
    { status: 429 },
    { status: 500 },
    { status: 502 },
    { status: 503 },
    new Error("Failed to fetch"),
    null,
    undefined,
    "offline",
  ]) {
    assert.equal(isDefinitiveAuthFailure(error), false, `${JSON.stringify(error)} must not sign out`);
  }
});

test("tokens are refreshed early but not treated as dead before they expire", () => {
  const fresh = tokenExpiringIn(3600);
  assert.equal(accessTokenExpired(fresh, 60_000), false);
  assert.equal(accessTokenExpired(fresh, 0), false);

  const expiringWithinBuffer = tokenExpiringIn(30);
  assert.equal(accessTokenExpired(expiringWithinBuffer, 60_000), true, "should refresh early");
  assert.equal(accessTokenExpired(expiringWithinBuffer, 0), false, "but is still usable right now");

  assert.equal(accessTokenExpired(tokenExpiringIn(-10), 0), true);
});

test("an unreadable token is treated as expired rather than trusted", () => {
  assert.equal(accessTokenExpired("not-a-jwt", 0), true);
  assert.equal(accessTokenExpired("", 0), true);
  assert.equal(accessTokenExpired("a.!!!notbase64!!!.c", 0), true);
});
