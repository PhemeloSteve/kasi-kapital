import { redirect } from "next/navigation";
import { GoalForm } from "@/components/GoalForm";
import { requireUser } from "@/app/_lib/guard";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";

export const metadata = { title: "New funding goal | Kasi Kapital" };

export default async function NewGoalPage() {
  const user = await requireUser(["business"]);
  const business = await createBusinessStore().getMyBusiness(user.userId);
  if (!business) redirect("/business/profile");

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold text-brand">New funding goal</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Say what you need and break it into steps. Supporters see exactly how their money will be
        used.
      </p>
      <GoalForm />
    </main>
  );
}
