import { describe, expect, it } from "vitest";
import { err, ok } from "@/domain/result";
import { logIn, signUp } from "./auth";
import type { AuthGateway, CurrentUser } from "./ports";

const user: CurrentUser = {
  userId: "u1",
  role: "investor",
  fullName: "T",
  consented: true,
  adminLevel: null,
};

function makeGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signUp: async () => ok({ hasSession: false }),
    signIn: async () => ok(user),
    signOut: async () => {},
    getCurrentUser: async () => null,
    acceptConsent: async () => ok(true as const),
    ...overrides,
  };
}

const signUpForm = {
  fullName: "Thandi Nkosi",
  email: "thandi@example.com",
  password: "a-long-enough-password",
  role: "investor",
  consent: true,
};

describe("logIn and the robot check", () => {
  it("hands the code to the gateway", async () => {
    const seen: unknown[] = [];
    const auth = makeGateway({
      signIn: async (input) => {
        seen.push(input);
        return ok(user);
      },
    });
    await logIn({ auth }, { email: "a@b.co", password: "pw", captchaToken: "tok" });
    expect(seen).toEqual([
      { email: "a@b.co", password: "pw", keepSignedIn: false, captchaToken: "tok" },
    ]);
  });

  it("still works when no code is sent (the check is switched off)", async () => {
    const result = await logIn({ auth: makeGateway() }, { email: "a@b.co", password: "pw" });
    expect(result.ok).toBe(true);
  });

  it("passes on a failed check and a rate limit as their own outcomes", async () => {
    const captcha = await logIn(
      { auth: makeGateway({ signIn: async () => err("captcha_failed") }) },
      { email: "a@b.co", password: "pw" },
    );
    expect(captcha).toEqual(err("captcha_failed"));
    const limited = await logIn(
      { auth: makeGateway({ signIn: async () => err("rate_limited") }) },
      { email: "a@b.co", password: "pw" },
    );
    expect(limited).toEqual(err("rate_limited"));
  });

  it("refuses a code that is far too long without calling the gateway", async () => {
    let called = false;
    const auth = makeGateway({
      signIn: async () => {
        called = true;
        return ok(user);
      },
    });
    const result = await logIn(
      { auth },
      { email: "a@b.co", password: "pw", captchaToken: "x".repeat(3000) },
    );
    expect(result).toEqual(err("invalid_input"));
    expect(called).toBe(false);
  });
});

describe("signUp and the robot check", () => {
  it("hands the code to the gateway", async () => {
    const seen: Array<{ captchaToken?: string }> = [];
    const auth = makeGateway({
      signUp: async (input) => {
        seen.push(input);
        return ok({ hasSession: false });
      },
    });
    await signUp({ auth }, { ...signUpForm, captchaToken: "tok" });
    expect(seen[0]?.captchaToken).toBe("tok");
  });

  it("reports a failed check as its own outcome", async () => {
    const result = await signUp(
      { auth: makeGateway({ signUp: async () => err("captcha_failed") }) },
      signUpForm,
    );
    expect(result).toEqual(err({ code: "captcha_failed" }));
  });
});
