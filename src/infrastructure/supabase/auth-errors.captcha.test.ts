import { describe, expect, it } from "vitest";
import { classifySignInError, classifySignUpError } from "./auth-errors";

describe("classifySignInError", () => {
  it("recognises a missing or failed robot check", () => {
    expect(classifySignInError({ status: 400, code: "captcha_failed" })).toBe("captcha_failed");
  });

  it("recognises too many attempts", () => {
    expect(classifySignInError({ status: 429 })).toBe("rate_limited");
    expect(classifySignInError({ status: 429, code: "over_request_rate_limit" })).toBe(
      "rate_limited",
    );
  });

  it("keeps wrong password, unknown email and unconfirmed email the same generic answer", () => {
    expect(classifySignInError({ status: 400, code: "invalid_credentials" })).toBe(
      "invalid_credentials",
    );
    expect(classifySignInError({ status: 400, code: "email_not_confirmed" })).toBe(
      "invalid_credentials",
    );
  });

  it("reports server trouble as unavailable", () => {
    expect(classifySignInError({ status: 500 })).toBe("unavailable");
    expect(classifySignInError({})).toBe("unavailable");
  });
});

describe("classifySignUpError and the robot check", () => {
  it("recognises a failed robot check before anything else", () => {
    expect(classifySignUpError({ status: 400, code: "captcha_failed" })).toBe("captcha_failed");
  });

  it("still classifies the other failures as before", () => {
    expect(classifySignUpError({ status: 429 })).toBe("rate_limited");
    expect(classifySignUpError({ code: "weak_password" })).toBe("weak_password");
    expect(classifySignUpError({ code: "user_already_exists" })).toBe("failed");
  });
});
