import { describe, expect, it } from "vitest";
import { classifySignUpError } from "./auth-errors";

describe("classifySignUpError", () => {
  it.each([
    [{ status: 429 }, "rate_limited"],
    [{ code: "over_email_send_rate_limit" }, "rate_limited"],
    [{ code: "weak_password" }, "weak_password"],
    [{ code: "email_address_invalid" }, "invalid_email"],
    [{ code: "email_address_not_authorized" }, "invalid_email"],
  ] as const)("classifies %j as %s", (error, expected) => {
    expect(classifySignUpError(error)).toBe(expected);
  });

  it.each([
    { code: "user_already_exists" },
    { code: "email_exists" },
    { code: "unexpected_failure" },
    {},
  ])("keeps %j generic so existing accounts are never revealed", (error) => {
    expect(classifySignUpError(error)).toBe("failed");
  });
});
