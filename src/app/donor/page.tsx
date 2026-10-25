import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Your giving | Kasi Kapital" };

export default async function Page() {
  const user = await requireUser(["donor" as const]);
  return (
    <DashboardShell title="Your giving" roleLabel="Donor account" name={user.fullName}>
      <p className="text-slate-700">
        Browse verified businesses and see the impact of your donations here.
      </p>
    </DashboardShell>
  );
}
