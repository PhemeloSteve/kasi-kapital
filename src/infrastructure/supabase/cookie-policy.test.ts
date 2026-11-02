import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "./cookie-policy";

describe("sessionCookieOptions", () => {
  const longLived = { path: "/", maxAge: 34_560_000, httpOnly: false };

  it("leaves the cookie long-lived when the person chose to stay signed in", () => {
    expect(sessionCookieOptions("token", longLived, true)).toEqual(longLived);
  });

  it("turns it into a session cookie otherwise, keeping every other setting", () => {
    expect(sessionCookieOptions("token", longLived, false)).toEqual({
      path: "/",
      maxAge: undefined,
      expires: undefined,
      httpOnly: false,
    });
    expect(sessionCookieOptions("token", { expires: new Date() }, false).expires).toBeUndefined();
  });

  it("never touches a cookie that is being deleted, so signing out still works", () => {
    expect(sessionCookieOptions("", { maxAge: 0 }, false)).toEqual({ maxAge: 0 });
    expect(sessionCookieOptions("anything", { maxAge: 0 }, false)).toEqual({ maxAge: 0 });
  });
});
