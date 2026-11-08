import { landingPathForRole, type AdminLevel, type UserRole } from "@/domain/roles";

export type NavItem = { href: string; label: string };

/**
 * The links in the top bar for each kind of account. Administrators get the extra links only when they are
 * super admins; a reviewer (or an administrator with no level recorded) sees just the review queue.
 */
export function navForRole(role: UserRole, adminLevel?: AdminLevel | null): NavItem[] {
  switch (role) {
    case "investor":
    case "donor":
      return [
        { href: landingPathForRole(role), label: "Discover" },
        { href: "/contributions", label: "My contributions" },
      ];
    case "business":
      return [
        { href: "/business", label: "Dashboard" },
        { href: "/business/documents", label: "Verification" },
        { href: "/business/goals/new", label: "New goal" },
      ];
    case "admin":
      return adminLevel === "super_admin"
        ? [
            { href: "/admin", label: "Review queue" },
            { href: "/admin/audit", label: "Audit log" },
            { href: "/admin/businesses", label: "Businesses" },
            { href: "/admin/users", label: "Users" },
          ]
        : [{ href: "/admin", label: "Review queue" }];
  }
}

/** A link is "current" on its own page and on pages beneath it (except the dashboard, which would match everything). */
export function isCurrent(pathname: string, href: string, siblings: NavItem[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // "/business" is a prefix of its siblings, so only the most specific matching link counts
  return !siblings.some(
    (s) =>
      s.href !== href &&
      s.href.length > href.length &&
      (pathname === s.href || pathname.startsWith(`${s.href}/`)),
  );
}
