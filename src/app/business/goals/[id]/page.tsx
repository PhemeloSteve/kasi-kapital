import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/DashboardShell";
import { GoalCard } from "@/components/GoalCard";
import { MilestoneProofForm } from "@/components/MilestoneProofForm";
import { requireUser } from "@/app/_lib/guard";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createFundingReads } from "@/infrastructure/supabase/funding-store";

export const metadata = { title: "Goal | Kasi Kapital" };

const notices: Record<string, string> = {
  proof_sent:
    "Proof sent. An administrator will review it, and any money that is ready is released once it is approved.",
};

export default async function ManageGoalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await requireUser(["business"]);
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const { notice } = await searchParams;

  const store = createBusinessStore();
  const business = await store.getMyBusiness(user.userId);
  if (!business) redirect("/business/profile");

  const goal = (await store.listGoals(business.id)).find((g) => g.id === id.data);
  if (!goal) notFound();

  const reads = createFundingReads();
  const [funding, payouts] = await Promise.all([
    reads.goalFunding(business.id),
    reads.milestonePayouts(business.id),
  ]);
  const canSendProof = business.verification === "verified";

  return (
    <DashboardShell
      role="business"
      name={user.fullName}
      title={goal.title}
      subtitle="Upload proof for each milestone to release its money."
    >
      <Link href="/business" className="text-sm text-gray-600 underline">
        Back to your business
      </Link>

      {notice && notices[notice] && (
        <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">
          {notices[notice]}
        </p>
      )}

      <p className="mt-4 text-sm text-gray-700">
        For each step, upload an invoice or quote that shows what the money is for. An administrator
        checks it, and the money for that step is released to you once it is approved and the goal
        has raised enough.
      </p>

      <div className="mt-4">
        <GoalCard
          goal={goal}
          funding={funding.find((f) => f.goalId === goal.id)}
          payouts={payouts}
          milestoneExtra={(m) => (
            <>
              {m.status === "rejected" && m.reviewNote && (
                <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-900">
                  <span className="font-medium">Why it was rejected:</span> {m.reviewNote}
                </p>
              )}
              {canSendProof && (m.status === "pending" || m.status === "rejected") && (
                <MilestoneProofForm
                  milestoneId={m.id}
                  goalId={goal.id}
                  label={
                    m.status === "rejected"
                      ? "Send new proof (invoice or quote)"
                      : "Proof of spending (invoice or quote)"
                  }
                />
              )}
            </>
          )}
        />
        {!canSendProof && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            You can send proof once your business is verified.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
