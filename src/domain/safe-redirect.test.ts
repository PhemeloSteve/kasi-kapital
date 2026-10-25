import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows same-site paths, with query strings", () => {
    expect(safeRedirectPath("/business")).toBe("/business");
    expect(safeRedirectPath("/donor?tab=history")).toBe("/donor?tab=history");
  });

  it.each([
    "//evil.example",
    "https://evil.example",
    "http://evil.example/path",
    "javascript:alert(1)",
    "/\\evil.example",
    "evil.example",
    "/ok\r\nSet-Cookie: x=1",
    "",
  ])("rejects %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/");
  });

  it("falls back for non-strings and uses a custom fallback", () => {
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath(null, "/login")).toBe("/login");
    expect(safeRedirectPath("//evil.example", "/investor")).toBe("/investor");
  });

  it("rejects absurdly long input", () => {
    expect(safeRedirectPath("/" + "a".repeat(600))).toBe("/");
  });
});
