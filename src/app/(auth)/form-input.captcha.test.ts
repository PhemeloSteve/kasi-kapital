import { describe, expect, it } from "vitest";
import { readLogInForm, readSignUpForm } from "./form-input";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("the robot check code in the forms", () => {
  it("is read from the sign-in form", () => {
    const result = readLogInForm(
      form({ email: "a@b.co", password: "pw", "cf-turnstile-response": "token-123" }),
    );
    expect(result.captchaToken).toBe("token-123");
  });

  it("is left out when the form has none or an empty one", () => {
    expect(readLogInForm(form({ email: "a@b.co", password: "pw" })).captchaToken).toBeUndefined();
    expect(
      readLogInForm(form({ email: "a@b.co", password: "pw", "cf-turnstile-response": "" }))
        .captchaToken,
    ).toBeUndefined();
  });

  it("is read from the sign-up form, and never sent back to the page", () => {
    const { values, input } = readSignUpForm(
      form({ fullName: "Thandi", email: "t@x.co", password: "pw", "cf-turnstile-response": "tok" }),
    );
    expect(input.captchaToken).toBe("tok");
    expect(JSON.stringify(values)).not.toContain("tok");
    expect(JSON.stringify(values)).not.toContain("pw");
  });
});
