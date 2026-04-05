export type MappedAuthError = { message: string; debugCode?: string };
const FALLBACK = "Something went wrong. Please try again.";

type AuthErrorLike = { code?: string; error_code?: string; error?: string; msg?: string; message?: string; status?: number };

function getErrorDetails(error: unknown): { code: string; message: string } {
  if (!error) return { code: "", message: "" };
  if (typeof error === "string") return { code: "", message: error };
  if (error instanceof Error) return { code: "", message: error.message };
  const e = error as AuthErrorLike;
  const code = [e.error_code, e.code, e.error].find((v) => typeof v === "string") ?? "";
  const message = [e.message, e.msg, e.error].find((v) => typeof v === "string") ?? "";
  return { code, message };
}

export function mapSupabaseAuthError(error: unknown): MappedAuthError {
  const { code, message } = getErrorDetails(error);
  const hay = `${code} ${message}`.toLowerCase();
  if (hay.includes("redirect") && (hay.includes("mismatch") || hay.includes("invalid redirect"))) return { message: "Invalid sign-in redirect. Please retry from this page.", debugCode: code || "redirect_mismatch" };
  if (hay.includes("email not confirmed") || hay.includes("user not confirmed")) return { message: "Please confirm your email before signing in.", debugCode: code || "email_not_confirmed" };
  if (hay.includes("invalid login credentials") || hay.includes("bad password") || hay.includes("invalid_credentials")) return { message: "Invalid email or password.", debugCode: code || "invalid_login_credentials" };
  if (code || message) return { message: FALLBACK, debugCode: code || undefined };
  return { message: FALLBACK };
}
