import { describe, expect, it } from "vitest";
import {
  isDemoKycEnabled,
  isServiceKeyConfigured,
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
