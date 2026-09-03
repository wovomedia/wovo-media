import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { customerSafeMessage, internalErrorCode } from "../lib/errors/customer-safe.ts";

test("a provider error never reaches the customer", () => {
  const leaks = [
    "Incorrect API key provided: sk-abc123. You can find your API key at https://platform.openai.com/account/api-keys",
    "fal.ai request failed with status 429",
    "queue.fal.run returned 502",
    "OpenAI rate limit exceeded for requests",
    "connect ECONNREFUSED db.dadbukxeayosvkqcrzfm.supabase.co:5432",
    "TypeError: Cannot read properties of undefined\n    at handler (/var/task/route.js:12:9)",
    "Bearer token rejected by upstream",
  ];
  for (const message of leaks) {
    assert.equal(
      customerSafeMessage(new Error(message), "Unable to generate image."),
      "Unable to generate image.",
      message.slice(0, 40),
    );
  }
});

test("a curated product message is still shown to the customer", () => {
  assert.equal(
    customerSafeMessage(new Error("This workspace needs credits before generating."), "fallback"),
    "This workspace needs credits before generating.",
  );
  assert.equal(customerSafeMessage(new Error(""), "fallback"), "fallback");
  assert.equal(customerSafeMessage(null, "fallback"), "fallback");
  assert.equal(customerSafeMessage(new Error("x".repeat(400)), "fallback"), "fallback");
});

test("internal log codes stay short and machine readable", () => {
  assert.equal(internalErrorCode(new Error("VIDEO_CREATE_FAILED: upstream 500"), "FALLBACK"), "VIDEO_CREATE_FAILED");
  assert.equal(internalErrorCode(new Error("some prose about a failure"), "FALLBACK"), "FALLBACK");
});

test("the legacy generation routes no longer return raw provider text", () => {
  for (const route of [
    "app/api/wovo/image/route.ts",
    "app/api/wovo/caption-image/route.ts",
    "app/api/wovo/chat/route.ts",
  ]) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /customerSafeMessage/, route);
    assert.doesNotMatch(
      source,
      /error: error instanceof Error \? error\.message/,
      `${route} still returns the raw error message`,
    );
  }
});

test("every media route sends customer-facing errors through the safe filter", () => {
  // Video, music and cartoon used to return `error.message` straight to the
  // browser. A provider outage message therefore reached the customer with the
  // provider's name in it, which breaks the rule that WOVO never names its
  // suppliers.
  for (const route of [
    "app/api/wovo/video/route.ts",
    "app/api/wovo/music/route.ts",
    "app/api/wovo/video/[jobId]/route.ts",
    "app/api/portal/cartoon/route.ts",
  ]) {
    const source = readFileSync(route, "utf8");
    assert.match(
      source,
      /customerSafeMessage/,
      `${route} does not use customerSafeMessage`,
    );
    assert.doesNotMatch(
      source,
      /error:\s*error instanceof Error \? error\.message/,
      `${route} still returns a raw provider message to the customer`,
    );
    assert.doesNotMatch(
      source,
      /error:\s*error\.message\s*\}/,
      `${route} still returns a raw error message to the customer`,
    );
  }
});
