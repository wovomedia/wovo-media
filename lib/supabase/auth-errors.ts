export type MappedAuthError = {
  message: string;
  debugCode?: string;
};

const SAFE_FALLBACK_MESSAGE = "Something went wrong. Please try again.";

type AuthErrorLike = {
  code?: string;
  error_code?: string;
  error?: string;
  msg?: string;
  message?: string;
  status?: number;
};

function getErrorDetails(error: unknown): { code: string; message: string } {
  if (!error) return { code: "", message: "" };

  if (typeof error === "string") {
    return { code: "", message: error };
  }

  if (error instanceof Error) {
    return {
      code: "",
      message: error.message,
    };
  }

  const e = error as AuthErrorLike;
  const code = [e.error_code, e.code, e.error].find((value) => typeof value === "string") ?? "";
  const message = [e.message, e.msg, e.error].find((value) => typeof value === "string") ?? "";

  return { code, message };
}

export function mapSupabaseAuthError(error: unknown): MappedAuthError {
  const { code, message } = getErrorDetails(error);
  const haystack = `${code} ${message}`.toLowerCase();

  if (
    haystack.includes("redirect") &&
    (haystack.includes("mismatch") || haystack.includes("invalid redirect") || haystack.includes("invalid_redirect_url"))
  ) {
    return {
      message: "Invalid sign-in redirect. Please retry from this page.",
      debugCode: code || "redirect_mismatch",
    };
  }

  if (haystack.includes("email not confirmed") || haystack.includes("user not confirmed")) {
    return {
      message: "Please confirm your email before signing in.",
      debugCode: code || "email_not_confirmed",
    };
  }

  if (
    haystack.includes("invalid login credentials") ||
    haystack.includes("bad password") ||
    haystack.includes("invalid_credentials")
  ) {
    return {
      message: "Invalid email or password.",
      debugCode: code || "invalid_login_credentials",
    };
  }

  if (code || message) {
    return {
      message: SAFE_FALLBACK_MESSAGE,
      debugCode: code || undefined,
    };
  }

  return { message: SAFE_FALLBACK_MESSAGE };
}
