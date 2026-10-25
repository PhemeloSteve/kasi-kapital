import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Your business | Kasi Kapital" };

export default async function Page() {
  const user = await requireUser(["business" as const]);
  return (
    <DashboardShell title="Your business" roleLabel="Business account" name={user.fullName}>
      <p className="text-slate-700">
        Your business profile, funding goals and progress updates will appear here. Next: create
        your business profile.
      </p>
    </DashboardShell>
  );
}
