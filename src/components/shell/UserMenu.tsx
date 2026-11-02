import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { logOutAction } from "@/app/(auth)/actions";
import { roleLabels, type UserRole } from "@/domain/roles";

/** The person's name in the top bar, with a small menu. Uses a plain <details>, so it needs no scripting. */
export function UserMenu({ name, role }: { name: string | null; role: UserRole }) {
  const display = name?.trim() || roleLabels[role];
  const initial = display.charAt(0).toUpperCase();

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/20 py-1 pl-1 pr-3 text-sm text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-cream text-sm font-bold text-brand"
        >
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium sm:block">{display}</span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 text-white/70 transition-transform group-open:rotate-180"
        />
        <span className="sr-only">Account menu</span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-brand-border bg-white p-1.5 text-gray-800 shadow-lg">
        <p className="px-3 py-2 text-xs text-gray-500">
          Signed in as{" "}
          <span className="block truncate text-sm font-medium text-gray-800">{display}</span>
          <span className="text-xs text-gray-500">{roleLabels[role]}</span>
        </p>
        {(role === "investor" || role === "donor") && (
          <Link
            href="/verify-identity"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand" />
            Verify identity
          </Link>
        )}
        <form action={logOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            <LogOut aria-hidden="true" className="h-4 w-4 text-gray-500" />
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}
