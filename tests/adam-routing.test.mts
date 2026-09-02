import assert from "node:assert/strict";
import test from "node:test";

import { routeAdamPrompt } from "../lib/ai/public-model-catalog.ts";

test("Adam routes the owner's own example prompts to the right surface", () => {
  assert.deepEqual(routeAdamPrompt("Help me make a video ad.").kind, "create");
  assert.equal((routeAdamPrompt("Help me make a video ad.") as { type: string }).type, "video");
  assert.equal((routeAdamPrompt("Make an image for this event.") as { type: string }).type, "image");
  assert.equal((routeAdamPrompt("Create a square image of a cheeseburger with flames behind it.") as { type: string }).type, "image");
  assert.equal((routeAdamPrompt("Make a funny upbeat country song about our 72 oz steak challenge with a catchy chorus and male vocals.") as { type: string }).type, "audio");
  assert.equal((routeAdamPrompt("Turn me into a cartoon restaurant owner.") as { type: string }).type, "cartoon");
});

test("retrieval prompts never start a billable generation", () => {
  for (const prompt of [
    "Pull up my steak project.",
    "Find the chat where we talked about pricing.",
    "Show me yesterday's generations.",
    "Where is the flyer we made last month?",
  ]) {
    assert.equal(routeAdamPrompt(prompt).kind, "find", prompt);
  }
});

test("planning and business prompts route to assistance, not a generation", () => {
  for (const prompt of [
    "Plan next week's content.",
    "Research businesses I should contact.",
    "Draft follow-up emails.",
    "Prepare me for tomorrow's meetings.",
  ]) {
    assert.equal(routeAdamPrompt(prompt).kind, "assist", prompt);
  }
});

test("an empty prompt never claims a creation type or a credit cost", () => {
  assert.equal(routeAdamPrompt("").kind, "assist");
  assert.equal(routeAdamPrompt("   ").kind, "assist");
});

test("an unrecognised creative prompt still resolves to a real creation type", () => {
  const routed = routeAdamPrompt("something eye-catching for the front window");
  assert.equal(routed.kind, "create");
  assert.ok(["image", "video", "audio", "social", "cartoon"].includes((routed as { type: string }).type));
});
