export function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://wovomedia.com";
}
