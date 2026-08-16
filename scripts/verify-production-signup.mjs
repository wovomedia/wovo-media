import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const APP_URL = "https://wovomedia.com";
const MAIL_API = "https://api.mail.tm";

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")];
  }));
}

async function json(url, init) {
  const response = await fetch(url, init);
  const body = await response.text();
  let value = null;
  try { value = body ? JSON.parse(body) : null; } catch { value = body; }
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned ${response.status}: ${typeof value === "string" ? value.slice(0, 160) : value?.message ?? value?.error ?? "request failed"}`);
  return { response, value };
}

async function waitForMail(token, afterId = null, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await json(`${MAIL_API}/messages?page=1`, { headers: { Authorization: `Bearer ${token}` } });
    const message = value?.["hydra:member"]?.find((item) => item.id !== afterId);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Transactional email was not delivered to the disposable inbox within two minutes.");
}

async function followAuthLink(url) {
  let current = url;
  for (let count = 0; count < 8; count += 1) {
    const response = await fetch(current, { redirect: "manual" });
    const location = response.headers.get("location");
    if (!location) return current;
    current = new URL(location, current).toString();
    if (current.startsWith(APP_URL)) return current;
  }
  throw new Error("Verification link exceeded the redirect limit.");
}

async function main() {
  const keepForBrowser = process.argv.includes("--keep-for-browser");
  const env = parseEnv(await readFile(new URL("../.env.production.local", import.meta.url), "utf8"));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY.length > 20
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : null;
  if (!supabaseUrl || !anonKey) throw new Error("Local production verification environment is incomplete.");

  const suffix = randomBytes(8).toString("hex");
  const password = `Wv!${randomBytes(18).toString("base64url")}`;
  const { value: domains } = await json(`${MAIL_API}/domains?page=1`);
  const domain = domains?.["hydra:member"]?.find((item) => item.isActive)?.domain;
  if (!domain) throw new Error("No disposable test domain is available.");
  const address = `wovo-e2e-${suffix}@${domain}`;
  const mailPassword = randomBytes(24).toString("base64url");

  let userId = null;
  let accountId = null;
  let mailToken = null;
  try {
    await json(`${MAIL_API}/accounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, password: mailPassword }) });
    const { value: mailAuth } = await json(`${MAIL_API}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, password: mailPassword }) });
    mailToken = mailAuth.token;

    const { value: signup } = await json(`${APP_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "WOVO-production-verifier/1.0" },
      body: JSON.stringify({ email: address, password, options: { email_redirect_to: `${APP_URL}/auth/callback?next=%2Fportal` } }),
    });
    userId = signup?.user?.id ?? null;
    console.log("PASS signup accepted without exposing account existence details");

    const verificationMessage = await waitForMail(mailToken);
    const { value: verificationBody } = await json(`${MAIL_API}/messages/${verificationMessage.id}`, { headers: { Authorization: `Bearer ${mailToken}` } });
    const emailHtml = verificationBody?.html?.join?.("\n") ?? verificationBody?.html ?? "";
    const emailText = `${verificationBody?.text ?? ""}\n${emailHtml}`;
    const htmlAuthLink = [...String(emailHtml).matchAll(/href=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .find((href) => href.includes("/auth/v1/verify?"));
    const authLink = (htmlAuthLink ?? emailText.match(/https:\/\/[^\s"'<>\]]+\/auth\/v1\/verify\?[^\s"'<>\]]+/)?.[0])?.replace(/&amp;/g, "&");
    if (!authLink) throw new Error("Confirmation email arrived but did not contain a Supabase verification link.");
    const callbackUrl = await followAuthLink(authLink);
    const callback = new URL(callbackUrl);
    if (callback.origin !== APP_URL || callback.pathname !== "/auth/callback") {
      console.log(`FAIL confirmation returned to ${callback.origin}${callback.pathname} instead of the canonical WOVO callback`);
    } else {
      console.log("PASS confirmation email delivered and returned to canonical callback");
    }

    const { value: login } = await json(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email: address, password }),
    });
    const accessToken = login.access_token;
    userId = login.user?.id ?? userId;
    if (!accessToken) throw new Error("Confirmed account did not receive a password session.");
    console.log("PASS verified password login issued a session");

    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const initial = await json(`${APP_URL}/api/portal`, { headers: authHeaders });
    if (initial.value?.mode !== "client" || !Array.isArray(initial.value?.accounts) || initial.value.accounts.length !== 0) throw new Error("Fresh verified user did not receive the onboarding state.");
    if (!Array.isArray(initial.value?.setup?.billingOptions) || initial.value.setup.billingOptions.length !== 3) throw new Error("Fresh onboarding did not receive the three verified billing choices.");
    console.log("PASS fresh account received onboarding and three billing choices");

    if (keepForBrowser) {
      await writeFile(new URL("../.env.e2e-browser.local", import.meta.url), JSON.stringify({ email: address, password, userId }), { mode: 0o600 });
      console.log("PASS browser test identity retained in a local ignored file");
      return;
    }

    const { value: onboarded } = await json(`${APP_URL}/api/portal`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "onboard",
        billingFrequency: "monthly",
        businessName: `WOVO E2E ${suffix.slice(0, 6)}`,
        businessType: "local_business",
        websiteUrl: "",
        location: "Remote test workspace",
        brandVoice: "Clear, factual, and helpful",
        audience: "Release-gate test only\nAge range: not_sure",
        goals: "Verify onboarding without publishing or contacting anyone",
        cadence: 1,
        platforms: [],
        rightsConfirmed: true,
        timezone: "America/Chicago",
        onboardingPlan: { coreModules: [], recurringAddons: [], quoteServices: [], logoStatus: "needs_help", brandColors: ["#f05a3a", "#191714"], websiteInterest: false, websiteBrief: {}, employeeInviteDrafts: [] },
      }),
    });
    accountId = onboarded?.account?.id;
    if (!accountId) throw new Error("Onboarding did not create a private workspace.");
    console.log("PASS onboarding created a private unpaid workspace");

    const { value: checkout } = await json(`${APP_URL}/api/portal`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_checkout", accountId, purchaseType: "subscription", planConfirmed: true, billingFrequency: "monthly" }),
    });
    if (!checkout?.url) throw new Error(`Plan confirmation returned an unexpected response (${Object.keys(checkout ?? {}).sort().join(",") || "empty"}).`);
    const checkoutOrigin = new URL(checkout.url).origin;
    if (!["https://checkout.stripe.com", "https://pay.wovomedia.com"].includes(checkoutOrigin)) throw new Error(`Plan confirmation returned checkout host ${checkoutOrigin}.`);
    const checkoutPage = await fetch(checkout.url, { redirect: "follow" });
    if (!checkoutPage.ok) throw new Error(`Stripe Checkout returned ${checkoutPage.status}.`);
    console.log("PASS server-allowlisted monthly plan opened Stripe Checkout without a charge");

    const afterOnboarding = await json(`${APP_URL}/api/portal`, { headers: authHeaders });
    if (afterOnboarding.value?.accounts?.[0]?.id !== accountId) throw new Error("Created workspace was not returned after onboarding.");
    if (afterOnboarding.value?.subscriptions?.some((item) => ["active", "trialing"].includes(item.status))) throw new Error("Unpaid workspace was activated without a verified payment.");
    console.log("PASS unpaid account remained gated while billing access stayed available");

    const recovery = await fetch(`${APP_URL}/api/auth/recovery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address, redirectTo: `${APP_URL}/auth/callback?next=%2Freset-password` }) });
    if (!recovery.ok) throw new Error(`Password recovery returned ${recovery.status}.`);
    await waitForMail(mailToken, verificationMessage.id);
    console.log("PASS password-recovery email delivered");
  } finally {
    if (process.argv.includes("--keep-for-browser")) {
      // The browser verification pass owns cleanup for this explicitly retained
      // disposable identity.
    } else if (serviceKey) {
      const adminHeaders = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
      if (accountId) await fetch(`${supabaseUrl}/rest/v1/wovo_portal_accounts?id=eq.${encodeURIComponent(accountId)}`, { method: "DELETE", headers: adminHeaders }).catch(() => null);
      if (userId) await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE", headers: adminHeaders }).catch(() => null);
    } else if (userId) {
      console.log(`CLEANUP user=${userId}${accountId ? ` account=${accountId}` : ""}`);
    }
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : "production signup verification failed"}`);
  process.exitCode = 1;
});
