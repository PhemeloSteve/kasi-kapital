import { describe, expect, it } from "vitest";
import {
  CAPTCHA_MESSAGE,
  logInErrorMessage,
  RATE_LIMITED_MESSAGE,
  signUpErrorMessage,
} from "./messages";

describe("logInErrorMessage", () => {
  it("asks for the security check when it was missing or failed", () => {
    expect(logInErrorMessage("captcha_failed")).toBe(CAPTCHA_MESSAGE);
  });

  it("tells people to wait when there were too many attempts", () => {
    expect(logInErrorMessage("rate_limited")).toBe(RATE_LIMITED_MESSAGE);
  });

  it("reports a service problem as one", () => {
    expect(logInErrorMessage("unavailable")).toContain("temporarily unavailable");
  });

  it("gives wrong passwords and invalid input the same generic answer", () => {
    expect(logInErrorMessage("invalid_credentials")).toBe("Incorrect email or password.");
    expect(logInErrorMessage("invalid_input")).toBe("Incorrect email or password.");
  });
});

describe("signUpErrorMessage", () => {
  it("covers the security check, rate limits and everything else", () => {
    expect(signUpErrorMessage("captcha_failed")).toBe(CAPTCHA_MESSAGE);
    expect(signUpErrorMessage("rate_limited")).toBe(RATE_LIMITED_MESSAGE);
    expect(signUpErrorMessage("signup_failed")).toContain("couldn't create your account");
  });

  it("never reveals whether an email already has an account", () => {
    expect(signUpErrorMessage("signup_failed")).not.toMatch(/already (registered|exists)/i);
  });
});
