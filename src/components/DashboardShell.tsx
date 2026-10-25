import type { ReactNode } from "react";
import { logOutAction } from "@/app/(auth)/actions";

type Props = { title: string; roleLabel: string; name: string | null; children: ReactNode };

export function DashboardShell({ title, roleLabel, name, children }: Props) {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">{roleLabel}</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          {name && <p className="text-sm text-slate-600">Signed in as {name}</p>}
        </div>
        <form action={logOutAction}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Log out
          </button>
        </form>
      </header>
      <main className="py-6">{children}</main>
    </div>
  );
}
