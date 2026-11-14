const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** The answer to the robot check, which Cloudflare's script puts in a hidden field. Empty means none. */
const captchaToken = (formData: FormData): string | undefined =>
  text(formData, "cf-turnstile-response") || undefined;

/**
 * Reads the sign-up form. `values` is safe to send back to the page to re-fill the form;
 * `input` additionally holds the password and goes only to the use case.
 */
export function readSignUpForm(formData: FormData) {
  const values = {
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    role: text(formData, "role"),
    // A ticked checkbox is submitted as "on"; an unticked one is not submitted at all.
    consent: formData.get("consent") === "on",
  };
  return {
    values,
    input: {
      ...values,
      password: text(formData, "password"),
      captchaToken: captchaToken(formData),
    },
  };
}

export function readLogInForm(formData: FormData) {
  return {
    email: text(formData, "email"),
    password: text(formData, "password"),
    // A ticked checkbox is submitted as "on"; an unticked one is not submitted at all.
    keep: formData.get("keep") === "on",
    captchaToken: captchaToken(formData),
  };
}
