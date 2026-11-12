import { afterEach, describe, expect, it, vi } from "vitest";
import { cookiesAreSecure, sessionCookieOptions } from "./cookie-policy";

describe("sessionCookieOptions: lifetime", () => {
  const longLived = { path: "/", maxAge: 34_560_000 };

  it("leaves the cookie long-lived when the person chose to stay signed in", () => {
    expect(sessionCookieOptions("token", longLived, true).maxAge).toBe(34_560_000);
  });

  it("turns it into a session cookie otherwise, keeping the other settings", () => {
    const result = sessionCookieOptions("token", longLived, false);
    expect(result.maxAge).toBeUndefined();
    expect(result.expires).toBeUndefined();
    expect(result.path).toBe("/");
    expect(sessionCookieOptions("token", { expires: new Date() }, false).expires).toBeUndefined();
  });

  it("never shortens a cookie that is being deleted, so signing out still works", () => {
    expect(sessionCookieOptions("", { maxAge: 0 }, false).maxAge).toBe(0);
    expect(sessionCookieOptions("anything", { maxAge: 0 }, false).maxAge).toBe(0);
  });
});

describe("sessionCookieOptions: protection", () => {
  it("always hides the cookie from scripts, even when Supabase asks otherwise", () => {
    expect(sessionCookieOptions("t", { httpOnly: false }, true).httpOnly).toBe(true);
    expect(sessionCookieOptions("t", {}, false).httpOnly).toBe(true);
    expect(sessionCookieOptions("", { maxAge: 0 }, false).httpOnly).toBe(true);
  });

  it("marks the cookie secure only when asked (a live site)", () => {
    expect(sessionCookieOptions("t", {}, true, true).secure).toBe(true);
    expect(sessionCookieOptions("t", {}, true, false).secure).toBe(false);
    expect(sessionCookieOptions("t", { secure: true }, true, false).secure).toBe(true);
  });

  it("uses SameSite=Lax, never none, and keeps strict if it was asked for", () => {
    expect(sessionCookieOptions("t", {}, true).sameSite).toBe("lax");
    expect(sessionCookieOptions("t", { sameSite: "none" }, true).sameSite).toBe("lax");
    expect(sessionCookieOptions("t", { sameSite: false }, true).sameSite).toBe("lax");
    expect(sessionCookieOptions("t", { sameSite: "strict" }, true).sameSite).toBe("strict");
  });
});

describe("cookiesAreSecure", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is on for a live site and off for local development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(cookiesAreSecure()).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(cookiesAreSecure()).toBe(false);
  });
});
