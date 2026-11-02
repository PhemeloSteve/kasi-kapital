import Link from "next/link";
import type { ReactNode } from "react";
import { landingPathForRole, type UserRole } from "@/domain/roles";
import { Wordmark } from "./brand/Logo";
import { navForRole } from "./shell/nav";
import { NavLinks } from "./shell/NavLinks";
import { UserMenu } from "./shell/UserMenu";

type Props = {
  role: UserRole;
  name: string | null;
  title: string;
  subtitle?: string;
  /** Buttons shown on the right of the page title. */
  actions?: ReactNode;
  /** Use a narrower page for forms. */
  narrow?: boolean;
  children: ReactNode;
};

/** The frame around every signed-in page: green top bar (from the dashboard designs), page title and footer. */
export function DashboardShell({ role, name, title, subtitle, actions, narrow, children }: Props) {
  const items = navForRole(role);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-brand focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="auth-sheet sticky top-0 z-30 bg-brand text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link
              href={landingPathForRole(role)}
              aria-label="Kasi Kapital home"
              className="text-brand-cream"
            >
              <Wordmark className="text-3xl" />
            </Link>
            <NavLinks items={items} className="hidden md:block" />
          </div>
          <UserMenu name={name} role={role} />
        </div>
        <NavLinks
          items={items}
          className="overflow-x-auto border-t border-white/10 px-3 py-1.5 md:hidden"
        />
      </header>

      <main
        id="main"
        className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 ${narrow ? "max-w-2xl" : "max-w-7xl"}`}
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand">{title}</h1>
            {subtitle && <p className="mt-1.5 max-w-2xl text-gray-600">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
        {children}
      </main>

      <footer className="border-t border-brand-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500 sm:flex-row sm:px-6">
          <Wordmark className="text-2xl text-brand" />
          <p>© 2026 Kasi Kapital. Empowering local communities.</p>
          <Link href="/privacy" className="underline hover:text-gray-800">
            Privacy notice
          </Link>
        </div>
      </footer>
    </div>
  );
}
