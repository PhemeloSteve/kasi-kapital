import { describe, expect, it } from "vitest";
import { isCurrent, navForRole } from "./nav";

describe("navForRole", () => {
  it("gives each kind of account its own links", () => {
    expect(navForRole("investor").map((l) => l.href)).toEqual(["/investor", "/contributions"]);
    expect(navForRole("donor")[0]?.href).toBe("/donor");
    expect(navForRole("business").map((l) => l.label)).toEqual([
      "Dashboard",
      "Verification",
      "New goal",
    ]);
    expect(navForRole("admin")).toEqual([{ href: "/admin", label: "Review queue" }]);
  });
});

describe("isCurrent", () => {
  const links = navForRole("business");
  it("matches a page and the pages beneath it", () => {
    expect(isCurrent("/business", "/business", links)).toBe(true);
    expect(isCurrent("/business/documents", "/business/documents", links)).toBe(true);
    expect(isCurrent("/business/goals/new", "/business/goals/new", links)).toBe(true);
  });
  it("does not light up the dashboard on pages that have their own link", () => {
    expect(isCurrent("/business/documents", "/business", links)).toBe(false);
    expect(isCurrent("/business/goals/new", "/business", links)).toBe(false);
  });
  it("still lights up the dashboard on its other sub-pages", () => {
    expect(isCurrent("/business/profile", "/business", links)).toBe(true);
    expect(isCurrent("/business/goals/abc", "/business", links)).toBe(true);
  });
  it("does not match unrelated pages", () => {
    expect(isCurrent("/businesses/1", "/business", links)).toBe(false);
    expect(isCurrent("/contributions", "/investor", navForRole("investor"))).toBe(false);
  });
});
