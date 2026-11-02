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
