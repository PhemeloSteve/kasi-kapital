import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Admin console | Kasi Kapital" };

export default async function Page() {
  const user = await requireUser(["admin" as const]);
  return (
    <DashboardShell title="Admin console" roleLabel="Administrator" name={user.fullName}>
      <p className="text-slate-700">The verification queue and reports will appear here.</p>
    </DashboardShell>
  );
}
