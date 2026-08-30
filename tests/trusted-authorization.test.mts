import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  resolveEffectiveRole,
  resolveTrustedAuthRole,
  resolveUserEmail,
} from "../lib/wovo-ai/admin.ts";

test("user-editable metadata cannot grant an admin role", () => {
  const user = {
    app_metadata: {},
    user_metadata: { role: "admin" },
  };

  assert.equal(resolveTrustedAuthRole(user), "user");
});

test("trusted app metadata can grant an admin role", () => {
  const user = {
    app_metadata: { role: " ADMIN " },
    user_metadata: { role: "user" },
  };

  assert.equal(resolveTrustedAuthRole(user), "admin");
});

test("user-editable metadata email cannot activate an owner allowlist", () => {
  const previous = process.env.WOVO_OWNER_EMAIL;
  process.env.WOVO_OWNER_EMAIL = "owner@example.com";
  try {
    const user = {
      email: null,
      app_metadata: {},
      user_metadata: { email: "owner@example.com", role: "admin" },
    };

    assert.equal(resolveUserEmail(user), null);
    assert.equal(
      resolveEffectiveRole({
        role: resolveTrustedAuthRole(user),
        email: resolveUserEmail(user),
      }),
      "user",
    );
  } finally {
    if (previous === undefined) delete process.env.WOVO_OWNER_EMAIL;
    else process.env.WOVO_OWNER_EMAIL = previous;
  }
});

test("privileged metadata is never written to user_metadata", async () => {
  const privilegedWriters = [
    "app/api/admin/credits/route.ts",
    "app/api/admin/moderation/route.ts",
    "app/api/admin/subscriptions/route.ts",
    "app/api/admin/users/role/route.ts",
    "app/api/admin/verified/route.ts",
  ];

  for (const file of privilegedWriters) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /user_metadata\s*:/, file);
  }
});

test("legacy profile roles use the authenticated email instead of editable profile email", async () => {
  const source = await readFile(
    new URL("../app/api/wovo-ai/profile/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /email:\s*resolvedUserEmail/);
  assert.match(source, /resolveRoleForEmail\(resolvedUserEmail\)/);
  assert.doesNotMatch(source, /resolveRoleForEmail\(resolvedEmail\)/);
});
