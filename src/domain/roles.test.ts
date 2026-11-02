import { describe, expect, it } from "vitest";
import { isUserRole, landingPathForRole, roleLabels, signupRoles } from "./roles";

describe("roles", () => {
  it("gives every role its own landing page", () => {
    expect(landingPathForRole("business")).toBe("/business");
    expect(landingPathForRole("investor")).toBe("/investor");
    expect(landingPathForRole("donor")).toBe("/donor");
    expect(landingPathForRole("admin")).toBe("/admin");
  });

  it("never offers admin at sign-up", () => {
    expect(signupRoles).not.toContain("admin");
  });

  it("recognises only real roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("superuser")).toBe(false);
    expect(isUserRole("toString")).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
  });

  it("has a readable label for every role", () => {
    for (const role of ["business", "investor", "donor", "admin"] as const)
      expect(roleLabels[role].length).toBeGreaterThan(3);
  });
});
