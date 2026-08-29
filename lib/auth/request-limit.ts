import { createHash } from "node:crypto";

const attempts = new Map<string, number[]>();

export function authRequestAllowed(request: Request, action: "signup" | "recovery" | "inquiry" | "pricing-deal"): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const key = createHash("sha256").update(`${action}:${ip}`).digest("hex");
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  const limit = action === "inquiry" ? 4 : 5;
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
