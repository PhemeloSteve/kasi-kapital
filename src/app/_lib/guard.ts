import { redirect } from "next/navigation";
import type { CurrentUser } from "@/application/ports";
import { landingPathForRole, type UserRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

/**
 * Server-side page guard. The middleware only checks that someone is signed in;
 * this checks consent and role, so the browser is never trusted for access decisions.
 */
export async function requireUser(allowed?: readonly UserRole[]): Promise<CurrentUser> {
  const user = await createAuthGateway().getCurrentUser();
  if (!user) redirect("/login");
  if (!user.consented) redirect("/consent");
  if (allowed && !allowed.includes(user.role)) redirect(landingPathForRole(user.role));
  return user;
}
