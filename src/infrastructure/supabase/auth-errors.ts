export type SignUpFailure = "failed" | "rate_limited" | "weak_password" | "invalid_email";

/** Maps a Supabase auth error to a failure the user can safely be told about. */
export function classifySignUpError(error: { status?: number; code?: string }): SignUpFailure {
  const { status, code } = error;
  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return "rate_limited";
  }
  if (code === "weak_password") return "weak_password";
  if (code === "email_address_invalid" || code === "email_address_not_authorized")
    return "invalid_email";
  // Everything else (including "already registered") stays generic so we never reveal which emails exist.
  return "failed";
}
