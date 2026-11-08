import { describe, expect, it } from "vitest";
import {
  effectiveAdminLevel,
  isAdminLevel,
  isUserRole,
  landingPathForRole,
  roleLabels,
  signupRoles,
} from "./roles";

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

describe("admin levels", () => {
  it("recognises only the two real levels", () => {
    expect(isAdminLevel("reviewer")).toBe(true);
    expect(isAdminLevel("super_admin")).toBe(true);
    expect(isAdminLevel("admin")).toBe(false);
    expect(isAdminLevel("toString")).toBe(false);
    expect(isAdminLevel(null)).toBe(false);
  });

  it("gives administrators their stored level", () => {
    expect(effectiveAdminLevel("admin", "super_admin")).toBe("super_admin");
    expect(effectiveAdminLevel("admin", "reviewer")).toBe("reviewer");
  });

  it("treats an administrator with no (or an unknown) level as a reviewer", () => {
    expect(effectiveAdminLevel("admin", null)).toBe("reviewer");
    expect(effectiveAdminLevel("admin", "root")).toBe("reviewer");
  });

  it("gives everyone else no level, whatever is stored", () => {
    expect(effectiveAdminLevel("investor", "super_admin")).toBeNull();
    expect(effectiveAdminLevel("business", null)).toBeNull();
  });
});
