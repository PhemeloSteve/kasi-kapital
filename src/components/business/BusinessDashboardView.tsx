import { Pencil, PlusCircle } from "lucide-react";
import Link from "next/link";
import type {
  BusinessRecord,
  DocumentRecord,
  GoalFunding,
  GoalRecord,
  MilestonePayout,
} from "@/application/ports";
import { DashboardShell } from "@/components/DashboardShell";
import { GoalCard } from "@/components/GoalCard";
import { ProfilePanel } from "./ProfilePanel";
import { VerificationPanel } from "./VerificationPanel";

type Props = {
  name: string | null;
  business: BusinessRecord;
  goals: GoalRecord[];
  funding: GoalFunding[];
  payouts: MilestonePayout[];
  documents: DocumentRecord[];
};

/** The founder's home: their active goal and milestones, how verified they are, and their profile. */
export function BusinessDashboardView({
  name,
  business,
  goals,
  funding,
  payouts,
  documents,
}: Props) {
  const [main, ...others] = [...goals].sort((a, b) => Number(b.isOpen) - Number(a.isOpen));
  const verified = business.verification === "verified";

  return (
    <DashboardShell
      role="business"
      name={name}
      title={`Welcome back, ${business.name}`}
      subtitle="Manage your verification, funding goals and proof of spending."
      actions={
        <>
          <Link href="/business/profile" className="btn-secondary">
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Edit profile
          </Link>
          <Link href="/business/goals/new" className="btn-primary">
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            Add funding goal
          </Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {main ? (
            <GoalCard
              goal={main}
              featured
              funding={funding.find((f) => f.goalId === main.id)}
              payouts={payouts}
              manageHref={`/business/goals/${main.id}`}
              milestoneExtra={(m, { tone }) =>
                verified && (tone === "action" || tone === "attention") ? (
                  <Link
                    href={`/business/goals/${main.id}`}
                    className="mt-3 inline-block text-sm font-semibold text-brand underline"
                  >
                    {m.status === "rejected" ? "Send new proof" : "Upload invoice or quote"}
                  </Link>
                ) : null
              }
            />
          ) : (
            <section className="card border-dashed p-10 text-center">
              <h2 className="text-xl font-bold text-gray-900">No funding goal yet</h2>
              <p className="mx-auto mt-2 max-w-md text-gray-600">
                Add a goal to tell supporters what you need and how you will use it, one milestone
                at a time.
              </p>
              <Link href="/business/goals/new" className="btn-primary mt-6 px-6">
                Add a funding goal
              </Link>
            </section>
          )}

          {others.length > 0 && (
            <section aria-labelledby="other-goals">
              <h2 id="other-goals" className="mb-3 text-lg font-bold text-gray-900">
                Other goals
              </h2>
              <div className="space-y-4">
                {others.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    funding={funding.find((f) => f.goalId === goal.id)}
                    payouts={payouts}
                    manageHref={`/business/goals/${goal.id}`}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <VerificationPanel
            status={business.verification}
            tier={business.trustTier}
            documents={documents}
          />
          <ProfilePanel business={business} />
        </div>
      </div>
    </DashboardShell>
  );
}
