import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Discover businesses | Kasi Kapital" };

export default async function Page() {
  const user = await requireUser(["investor" as const]);
  return (
    <DashboardShell title="Discover businesses" roleLabel="Investor account" name={user.fullName}>
      <p className="text-slate-700">
        Verified local businesses near you will appear here. Complete identity verification to start
        backing them.
      </p>
    </DashboardShell>
  );
}
