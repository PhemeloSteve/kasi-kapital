export const signupRoles = ["business", "investor", "donor"] as const;
export type SignupRole = (typeof signupRoles)[number];

/** Admin exists as a role but can never be chosen at sign-up. */
export type UserRole = SignupRole | "admin";

const landingPaths: Record<UserRole, string> = {
  business: "/business",
  investor: "/investor",
  donor: "/donor",
  admin: "/admin",
};

export function landingPathForRole(role: UserRole): string {
  return landingPaths[role];
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && Object.hasOwn(landingPaths, value);
}

export const roleLabels: Record<UserRole, string> = {
  business: "Business account",
  investor: "Investor",
  donor: "Donor",
  admin: "Administrator",
};

/** Administrators come in two levels. Reviewers handle documents and proof; super admins can do everything. */
export const adminLevels = ["reviewer", "super_admin"] as const;
export type AdminLevel = (typeof adminLevels)[number];

export function isAdminLevel(value: unknown): value is AdminLevel {
  return typeof value === "string" && (adminLevels as readonly string[]).includes(value);
}

/**
 * The level an account effectively has. An administrator with no level recorded is a reviewer (least
 * privilege, the same as the database), and nobody else has a level at all.
 */
export function effectiveAdminLevel(role: UserRole, stored: unknown): AdminLevel | null {
  if (role !== "admin") return null;
  return isAdminLevel(stored) ? stored : "reviewer";
}
