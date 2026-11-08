import { redirect } from "next/navigation";
import type { CurrentUser } from "@/application/ports";
import { landingPathForRole, type UserRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";
import { createMfaGateway } from "@/infrastructure/supabase/mfa-gateway";

/**
 * Server-side page guard. The middleware only checks that someone is signed in; this checks consent, role
 * and, for administrators, that they have passed two-factor login. The browser is never trusted for access
 * decisions. (The database enforces the same rule for administrator powers, as a second line of defence.)
 *
 * `skipMfa` is only for the two-factor setup page itself, which an administrator must be able to reach
 * before they have a second factor.
 */
export async function requireUser(
  allowed?: readonly UserRole[],
  options?: { skipMfa?: boolean },
): Promise<CurrentUser> {
  const user = await createAuthGateway().getCurrentUser();
  if (!user) redirect("/login");
  if (!user.consented) redirect("/consent");
  if (allowed && !allowed.includes(user.role)) redirect(landingPathForRole(user.role));
  if (
    user.role === "admin" &&
    !options?.skipMfa &&
    (await createMfaGateway().getLevel()) !== "aal2"
  ) {
    redirect("/admin/mfa");
  }
  return user;
}

/**
 * For pages and actions only super administrators may use (audit log, users, businesses, payouts).
 * Reviewers are sent back to the review queue. The database refuses reviewers as well.
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser(["admin"]);
  if (user.adminLevel !== "super_admin") redirect("/admin");
  return user;
}
