import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = "https://wovomedia.com";

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")];
  }));
}

async function request(url, init) {
  const response = await fetch(url, init);
  const raw = await response.text();
  let value = null;
  try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
  return { response, value };
}

async function main() {
  const env = parseEnv(await readFile(new URL("../.env.production.local", import.meta.url), "utf8"));
  const test = JSON.parse(await readFile(new URL("../.env.e2e-browser.local", import.meta.url), "utf8"));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !test.email || !test.password) throw new Error("Production upload verifier is not configured.");

  const login = await request(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email: test.email, password: test.password }),
  });
  if (!login.response.ok || !login.value?.access_token) throw new Error("Test login failed.");
  const authorization = `Bearer ${login.value.access_token}`;

  const snapshot = await request(`${APP_URL}/api/portal`, { headers: { Authorization: authorization } });
  const account = snapshot.value?.accounts?.find((item) => item.business_name === "WOVO browser release test");
  if (!snapshot.response.ok || !account?.id) throw new Error("Test workspace was not available.");

  const invalid = await request(`${APP_URL}/api/portal/assets`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "prepare", accountId: account.id, fileName: "unsafe.svg", mimeType: "image/svg+xml", sizeBytes: 10, assetKind: "brand", rightsConfirmed: true, peopleConsentConfirmed: true }),
  });
  if (invalid.response.status !== 400) throw new Error("Disallowed upload type was not rejected.");

  const bytes = await readFile(new URL("../app/apple-icon.png", import.meta.url));
  const meta = { accountId: account.id, fileName: "release-gate-brand.png", mimeType: "image/png", sizeBytes: bytes.byteLength, assetKind: "brand", rightsConfirmed: true, peopleConsentConfirmed: true };
  const prepared = await request(`${APP_URL}/api/portal/assets`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "prepare", ...meta }),
  });
  if (!prepared.response.ok || !prepared.value?.path || !prepared.value?.token) throw new Error(`Private upload preparation failed (${prepared.response.status}).`);

  const storage = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const uploaded = await storage.storage.from(prepared.value.bucket).uploadToSignedUrl(prepared.value.path, prepared.value.token, bytes, { contentType: "image/png" });
  if (uploaded.error) throw new Error(`Private upload failed: ${uploaded.error.message}`);

  const finalized = await request(`${APP_URL}/api/portal/assets`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "finalize", path: prepared.value.path, ...meta }),
  });
  if (finalized.response.status !== 201 || finalized.value?.asset?.storage_path !== prepared.value.path) throw new Error(`Private upload finalization failed (${finalized.response.status}).`);

  const publicAttempt = await fetch(`${supabaseUrl}/storage/v1/object/public/${prepared.value.bucket}/${prepared.value.path}`, { redirect: "manual" });
  if (publicAttempt.ok) throw new Error("Private asset was unexpectedly accessible through a public URL.");

  const verified = await request(`${APP_URL}/api/portal`, { headers: { Authorization: authorization } });
  if (!verified.response.ok || !verified.value?.assets?.some((item) => item.id === finalized.value.asset.id && item.account_id === account.id)) throw new Error("Finalized asset did not appear in the tenant snapshot.");

  console.log("PASS upload type allowlist rejected unsupported content");
  console.log("PASS signed private upload finalized with server-validated metadata and consent");
  console.log("PASS finalized asset remained tenant-scoped and unavailable through the public bucket URL");
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : "Production upload verification failed."}`);
  process.exitCode = 1;
});
