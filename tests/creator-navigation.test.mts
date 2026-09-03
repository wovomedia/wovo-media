import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const portal = readFileSync("app/portal/page.tsx", "utf8");

// The signed-in workspace used to open on an agency-style dashboard with a
// "WOVO creation tools" sidebar of product tiles. That shell is gone: the
// composer is the landing surface, and these guards exist so it does not come
// back the next time someone reaches for a familiar-looking pattern.
test("the workspace opens on the composer, not the old dashboard", () => {
  assert.match(portal, /const \[tab, setTab\] = useState<Tab>\("queue"\)/);
});

test("the legacy creation-tool tile strip stays deleted", () => {
  assert.doesNotMatch(portal, /WOVO creation tools/i);
  assert.doesNotMatch(portal, /const WOVO_PRODUCTS/);
  for (const label of ["Cartoon Studio", "Social Campaigns", "Website Builder"]) {
    assert.doesNotMatch(
      portal,
      new RegExp(`label: "${label}"`),
      `${label} tile is back in the portal sidebar`,
    );
  }
});

test("the workbench mode is still controlled by portal navigation", () => {
  assert.match(portal, /creatorMode=\{creatorMode\}/);
  assert.match(portal, /onCreatorModeChange=\{setCreatorMode\}/);
  assert.match(portal, /mode=\{creatorMode\}/);
  assert.match(portal, /onModeChange=\{onCreatorModeChange\}/);
  assert.doesNotMatch(portal, /const \[mode, setMode\] = useState<CreatorMode>/);
});
