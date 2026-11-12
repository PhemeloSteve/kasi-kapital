import { describe, expect, it } from "vitest";
import {
  isDemoKycEnabled,
  isServiceKeyConfigured,
  parseNotifyEnv,
  parsePaymentEnv,
  parsePublicEnv,
  parseServiceEnv,
} from "./env";

describe("env", () => {
  it("defaults payments to the demo provider and demo identity to off", () => {
    expect(parsePaymentEnv({})).toEqual({ PAYMENT_PROVIDER: "mock" });
    expect(isDemoKycEnabled({})).toBe(false);
  });
  it("only turns demo identity on for exactly 'true'", () => {
    expect(isDemoKycEnabled({ ALLOW_DEMO_KYC: "true" })).toBe(true);
    expect(() => isDemoKycEnabled({ ALLOW_DEMO_KYC: "yes" })).toThrow();
  });
  it("rejects an unknown payment provider", () => {
    expect(() => parsePaymentEnv({ PAYMENT_PROVIDER: "cash" })).toThrow();
  });
  it("needs a real service key only when it is actually used", () => {
    expect(isServiceKeyConfigured({ SUPABASE_SERVICE_ROLE_KEY: "" })).toBe(false);
    expect(isServiceKeyConfigured({ SUPABASE_SERVICE_ROLE_KEY: "abc" })).toBe(true);
    expect(() => parseServiceEnv({})).toThrow();
  });
  it("requires the public Supabase settings", () => {
    expect(() => parsePublicEnv({})).toThrow();
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      }).NEXT_PUBLIC_APP_URL,
    ).toBe("http://localhost:3000");
  });
});

describe("notification env", () => {
  it("is all optional, with a default sender", () => {
    const env = parseNotifyEnv({});
    expect(env.WEBHOOK_SECRET).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.NOTIFY_FROM_EMAIL).toContain("Kasi Kapital");
  });
  it("treats blank values as not set", () => {
    const env = parseNotifyEnv({ WEBHOOK_SECRET: "", RESEND_API_KEY: "  " });
    expect(env.WEBHOOK_SECRET).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });
  it("rejects a short secret and a bad recipient", () => {
    expect(() => parseNotifyEnv({ WEBHOOK_SECRET: "short" })).toThrow();
    expect(() => parseNotifyEnv({ ADMIN_NOTIFY_EMAIL: "not-an-email" })).toThrow();
  });
});
