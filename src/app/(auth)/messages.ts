import type { LogInError, SignUpError } from "@/application/auth";

export const RATE_LIMITED_MESSAGE = "Too many attempts. Please wait a few minutes and try again.";
export const CAPTCHA_MESSAGE = "Please complete the security check, then try again.";

/** What to tell someone whose sign-in failed. Wrong password and unknown email share one answer. */
export function logInErrorMessage(error: LogInError): string {
  switch (error) {
    case "unavailable":
      return "The service is temporarily unavailable. Please try again shortly.";
    case "rate_limited":
      return RATE_LIMITED_MESSAGE;
    case "captcha_failed":
      return CAPTCHA_MESSAGE;
    default:
      return "Incorrect email or password.";
  }
}

/** What to tell someone whose sign-up failed for a reason other than a field they can fix. */
export function signUpErrorMessage(code: Exclude<SignUpError["code"], "invalid_input">): string {
  switch (code) {
    case "rate_limited":
      return RATE_LIMITED_MESSAGE;
    case "captcha_failed":
      return CAPTCHA_MESSAGE;
    default:
      return "We couldn't create your account. If you already have one, try logging in.";
  }
}
