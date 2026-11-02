import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { GoalForm } from "@/components/GoalForm";
import { requireUser } from "@/app/_lib/guard";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";

export const metadata = { title: "New funding goal | Kasi Kapital" };

export default async function NewGoalPage() {
  const user = await requireUser(["business"]);
  const business = await createBusinessStore().getMyBusiness(user.userId);
  if (!business) redirect("/business/profile");

  return (
    <DashboardShell
      role="business"
      name={user.fullName}
      title="New funding goal"
      subtitle="Say what you need and break it into steps. Supporters see exactly how their money will be used."
      narrow
    >
      <div className="card p-6 sm:p-8">
        <GoalForm />
      </div>
    </DashboardShell>
  );
}
