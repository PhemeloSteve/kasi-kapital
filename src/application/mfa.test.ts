import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { beginMfaEnrollment, verifyMfaCode } from "./mfa";
import type { MfaGateway } from "./ports";

const FACTOR = "11111111-1111-4111-8111-111111111111";
const EXISTING = "22222222-2222-4222-8222-222222222222";

function makeMfa(overrides: Partial<MfaGateway> = {}): MfaGateway {
  return {
    getLevel: async () => "aal1",
    getStatus: async () => ({ level: "aal1", verifiedFactorId: null }),
    beginEnrollment: async () =>
      ok({ factorId: FACTOR, qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "ABCDEF" }),
    verify: async () => ok(true as const),
    ...overrides,
  };
}

describe("beginMfaEnrollment", () => {
  it("starts enrollment for someone with no authenticator yet", async () => {
    expect(await beginMfaEnrollment({ mfa: makeMfa() })).toMatchObject({
      ok: true,
      value: { factorId: FACTOR },
    });
  });

  it("refuses when an authenticator already exists, so a stolen password cannot add a new one", async () => {
    const beginEnrollment = vi.fn();
    const mfa = makeMfa({
      getStatus: async () => ({ level: "aal1", verifiedFactorId: EXISTING }),
      beginEnrollment,
    });
    expect(await beginMfaEnrollment({ mfa })).toEqual({ ok: false, error: "already_enrolled" });
    expect(beginEnrollment).not.toHaveBeenCalled();
  });

  it("reports a failure from the provider", async () => {
    const mfa = makeMfa({ beginEnrollment: async () => err("failed" as const) });
    expect(await beginMfaEnrollment({ mfa })).toEqual({ ok: false, error: "failed" });
  });
});

describe("verifyMfaCode", () => {
  it("accepts a code with or without a space in the middle", async () => {
    const verify = vi.fn(async () => ok(true as const));
    const mfa = makeMfa({ verify });
    await verifyMfaCode({ mfa }, { factorId: FACTOR, code: "123 456" });
    await verifyMfaCode({ mfa }, { factorId: FACTOR, code: "654321" });
    expect(verify).toHaveBeenNthCalledWith(1, { factorId: FACTOR, code: "123456" });
    expect(verify).toHaveBeenNthCalledWith(2, { factorId: FACTOR, code: "654321" });
  });

  it("always checks against the existing authenticator, ignoring the id the browser sent", async () => {
    const verify = vi.fn(async () => ok(true as const));
    const mfa = makeMfa({
      getStatus: async () => ({ level: "aal1", verifiedFactorId: EXISTING }),
      verify,
    });
    await verifyMfaCode({ mfa }, { factorId: FACTOR, code: "123456" });
    expect(verify).toHaveBeenCalledWith({ factorId: EXISTING, code: "123456" });
  });

  it.each([
    ["a short code", { factorId: FACTOR, code: "12345" }],
    ["letters", { factorId: FACTOR, code: "abcdef" }],
    ["an over-long code", { factorId: FACTOR, code: "1234567" }],
    ["a bad factor id", { factorId: "x", code: "123456" }],
    ["nothing", {}],
  ])("rejects %s without asking the provider", async (_label, input) => {
    const verify = vi.fn();
    expect(await verifyMfaCode({ mfa: makeMfa({ verify }) }, input)).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("reports a wrong code", async () => {
    const mfa = makeMfa({ verify: async () => err("invalid_code" as const) });
    expect(await verifyMfaCode({ mfa }, { factorId: FACTOR, code: "000000" })).toEqual({
      ok: false,
      error: "invalid_code",
    });
  });
});
