export type SignUpFailure =
  "failed" | "rate_limited" | "weak_password" | "invalid_email" | "captcha_failed";

type AuthError = { status?: number; code?: string };

const isRateLimited = ({ status, code }: AuthError) =>
  status === 429 || code === "over_email_send_rate_limit" || code === "over_request_rate_limit";

/** Supabase answers this when the robot check was missing, expired, already used, or wrong. */
const isCaptchaFailure = ({ code }: AuthError) => code === "captcha_failed";

/** Maps a Supabase auth error to a failure the user can safely be told about. */
export function classifySignUpError(error: AuthError): SignUpFailure {
  if (isCaptchaFailure(error)) return "captcha_failed";
  if (isRateLimited(error)) return "rate_limited";
  if (error.code === "weak_password") return "weak_password";
  if (error.code === "email_address_invalid" || error.code === "email_address_not_authorized")
    return "invalid_email";
  // Everything else (including "already registered") stays generic so we never reveal which emails exist.
  return "failed";
}

export type SignInFailure =
  "invalid_credentials" | "unavailable" | "rate_limited" | "captcha_failed";

/**
 * Maps a failed sign-in to something the person can act on. A missing robot check and too many attempts
 * get their own message; wrong password, unknown email and unconfirmed email all stay the same generic
 * answer, so the page never reveals which emails have accounts.
 */
export function classifySignInError(error: AuthError): SignInFailure {
  if (isCaptchaFailure(error)) return "captcha_failed";
  if (isRateLimited(error)) return "rate_limited";
  // 4xx = wrong credentials or unconfirmed email; anything else = service trouble.
  return (error.status ?? 500) >= 500 ? "unavailable" : "invalid_credentials";
}
