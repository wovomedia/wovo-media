import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const portal = readFileSync("app/portal/page.tsx", "utf8");

test("creation-tool shortcuts open their matching workbench modes", () => {
  const expectedModes = [
    ["AI Images", "post"],
    ["AI Video", "video"],
    ["Cartoon Studio", "episode"],
    ["Social Campaigns", "campaign"],
    ["Website Builder", "website"],
    ["AI Music", "music"],
  ] as const;

  for (const [label, mode] of expectedModes) {
    assert.match(
      portal,
      new RegExp(`label: "${label}"[^\\n]+target: "queue"[^\\n]+mode: "${mode}"`),
    );
  }
});

test("the workbench mode is controlled by portal navigation", () => {
  assert.match(portal, /creatorMode=\{creatorMode\}/);
  assert.match(portal, /onCreatorModeChange=\{setCreatorMode\}/);
  assert.match(portal, /mode=\{creatorMode\}/);
  assert.match(portal, /onModeChange=\{onCreatorModeChange\}/);
  assert.doesNotMatch(portal, /const \[mode, setMode\] = useState<CreatorMode>/);
});
