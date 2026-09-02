// Session-recovery decisions, kept free of imports so both the browser client
// and the test runner can use them directly.

/**
 * Only a refusal from the auth server means the person is really signed out.
 * A network failure, timeout, rate limit or server error must never discard a
 * working refresh token: doing that is why sessions did not survive a flaky
 * connection, a sleeping laptop, or a second open tab.
 */
export function isDefinitiveAuthFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  if (typeof status !== "number") return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

/** True when the access token is past `bufferMs` before its own expiry. */
export function accessTokenExpired(accessToken: string, bufferMs: number): boolean {
  try {
    const segment = accessToken.split(".")[1];
    const padding = "=".repeat((4 - (segment.length % 4)) % 4);
    const payload = JSON.parse(
      atob((segment + padding).replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    return !payload.exp || payload.exp * 1000 <= Date.now() + bufferMs;
  } catch {
    return true;
  }
}
