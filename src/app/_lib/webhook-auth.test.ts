import { describe, expect, it } from "vitest";
import { extractWebhookSecret, isValidWebhookSecret } from "./webhook-auth";

const SECRET = "a-long-enough-secret-value";

describe("isValidWebhookSecret", () => {
  it("accepts only the exact secret", () => {
    expect(isValidWebhookSecret(SECRET, SECRET)).toBe(true);
    expect(isValidWebhookSecret("wrong", SECRET)).toBe(false);
    expect(isValidWebhookSecret(`${SECRET}x`, SECRET)).toBe(false);
    expect(isValidWebhookSecret(SECRET.slice(0, -1), SECRET)).toBe(false);
  });

  it("refuses everyone when no secret is configured", () => {
    expect(isValidWebhookSecret("anything", undefined)).toBe(false);
    expect(isValidWebhookSecret("", "")).toBe(false);
    expect(isValidWebhookSecret(null, undefined)).toBe(false);
  });

  it("refuses a call that sent no secret", () => {
    expect(isValidWebhookSecret(null, SECRET)).toBe(false);
  });
});

describe("extractWebhookSecret", () => {
  it("reads a bearer token", () => {
    expect(extractWebhookSecret(new Headers({ authorization: `Bearer ${SECRET}` }))).toBe(SECRET);
  });

  it("falls back to the x-webhook-secret header", () => {
    expect(extractWebhookSecret(new Headers({ "x-webhook-secret": SECRET }))).toBe(SECRET);
  });

  it("returns null when neither is present", () => {
    expect(extractWebhookSecret(new Headers())).toBeNull();
  });
});
