import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { logIn, signUp } from "./auth";
import type { AuthGateway, CurrentUser } from "./ports";

const valid = {
  fullName: "Thandi Mokoena",
  email: "  Thandi@Example.com ",
  password: "correct-horse-battery",
  role: "business",
  consent: true,
};

function makeAuth(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signUp: async () => ok({ hasSession: true }),
    signIn: async () =>
      ok({ userId: "u1", role: "investor", fullName: "T", consented: true, adminLevel: null }),
    signOut: async () => {},
    getCurrentUser: async () => null,
    acceptConsent: async () => ok(true as const),
    ...overrides,
  };
}

describe("signUp", () => {
  it("normalises the email and sends the user to their landing page", async () => {
    const signUpSpy = vi.fn(async () => ok({ hasSession: true }));
    const result = await signUp({ auth: makeAuth({ signUp: signUpSpy }) }, valid);
    expect(result).toEqual({ ok: true, value: { status: "signed_in", landingPath: "/business" } });
    expect(signUpSpy).toHaveBeenCalledWith({
      email: "thandi@example.com",
      password: valid.password,
      fullName: valid.fullName,
      role: "business",
    });
  });

  it("asks the user to confirm their email when no session is returned", async () => {
    const auth = makeAuth({ signUp: async () => ok({ hasSession: false }) });
    expect(await signUp({ auth }, valid)).toEqual({ ok: true, value: { status: "confirm_email" } });
  });

  it("refuses to create an admin, whatever the form says", async () => {
    const spy = vi.fn();
    const result = await signUp({ auth: makeAuth({ signUp: spy }) }, { ...valid, role: "admin" });
    expect(result.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("requires explicit POPIA consent", async () => {
    const spy = vi.fn();
    const result = await signUp({ auth: makeAuth({ signUp: spy }) }, { ...valid, consent: false });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_input", fields: { consent: expect.any(String) } },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ["short password", { password: "short" }, "password"],
    ["over-long password", { password: "x".repeat(73) }, "password"],
    ["bad email", { email: "not-an-email" }, "email"],
    ["empty name", { fullName: " " }, "fullName"],
  ])("reports field errors for %s", async (_label, change, field) => {
    const result = await signUp({ auth: makeAuth() }, { ...valid, ...change });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    if (!result.ok && result.error.code === "invalid_input") {
      expect(Object.keys(result.error.fields)).toContain(field);
    }
  });

  it("gives a generic failure that does not reveal whether the email exists", async () => {
    const auth = makeAuth({ signUp: async () => err("failed" as const) });
    expect(await signUp({ auth }, valid)).toEqual({ ok: false, error: { code: "signup_failed" } });
  });

  it("shows weak-password and bad-email problems on the right field", async () => {
    const weak = makeAuth({ signUp: async () => err("weak_password" as const) });
    expect(await signUp({ auth: weak }, valid)).toMatchObject({
      ok: false,
      error: { code: "invalid_input", fields: { password: expect.any(String) } },
    });
    const bad = makeAuth({ signUp: async () => err("invalid_email" as const) });
    expect(await signUp({ auth: bad }, valid)).toMatchObject({
      ok: false,
      error: { code: "invalid_input", fields: { email: expect.any(String) } },
    });
  });

  it("surfaces rate limiting", async () => {
    const auth = makeAuth({ signUp: async () => err("rate_limited" as const) });
    expect(await signUp({ auth }, valid)).toEqual({ ok: false, error: { code: "rate_limited" } });
  });
});

describe("logIn", () => {
  const creds = { email: "a@b.co", password: "whatever-pass" };

  it.each([
    ["business", "/business"],
    ["investor", "/investor"],
    ["donor", "/donor"],
    ["admin", "/admin"],
  ] as const)("sends a %s to %s", async (role, path) => {
    const user: CurrentUser = {
      userId: "u",
      role,
      fullName: null,
      consented: true,
      adminLevel: null,
    };
    const result = await logIn({ auth: makeAuth({ signIn: async () => ok(user) }) }, creds);
    expect(result).toEqual({ ok: true, value: { landingPath: path } });
  });

  it("sends users without consent to the consent page first", async () => {
    const user: CurrentUser = {
      userId: "u",
      role: "donor",
      fullName: null,
      consented: false,
      adminLevel: null,
    };
    const result = await logIn({ auth: makeAuth({ signIn: async () => ok(user) }) }, creds);
    expect(result).toEqual({ ok: true, value: { landingPath: "/consent" } });
  });

  it("passes the Keep me logged in choice to the sign-in, off by default", async () => {
    const signIn = vi.fn(async () =>
      ok({
        userId: "u",
        role: "donor" as const,
        fullName: null,
        consented: true,
        adminLevel: null,
      }),
    );
    await logIn({ auth: makeAuth({ signIn }) }, creds);
    expect(signIn).toHaveBeenLastCalledWith({
      email: "a@b.co",
      password: "whatever-pass",
      keepSignedIn: false,
    });
    await logIn({ auth: makeAuth({ signIn }) }, { ...creds, keep: true });
    expect(signIn).toHaveBeenLastCalledWith({
      email: "a@b.co",
      password: "whatever-pass",
      keepSignedIn: true,
    });
  });

  it("returns one generic error for wrong credentials", async () => {
    const auth = makeAuth({ signIn: async () => err("invalid_credentials" as const) });
    expect(await logIn({ auth }, creds)).toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("rejects malformed input without calling the gateway", async () => {
    const spy = vi.fn();
    expect(
      await logIn({ auth: makeAuth({ signIn: spy }) }, { email: "nope", password: "" }),
    ).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
