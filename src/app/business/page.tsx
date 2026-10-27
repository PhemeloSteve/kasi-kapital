import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { GoalCard } from "@/components/GoalCard";
import { VerificationBadge } from "@/components/VerificationBadge";
import { requireUser } from "@/app/_lib/guard";
import { categoryLabels } from "@/domain/business-categories";
import { trustTierLabels } from "@/domain/documents";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createFundingReads } from "@/infrastructure/supabase/funding-store";

export const metadata = { title: "Your business | Kasi Kapital" };

export default async function BusinessPage() {
  const user = await requireUser(["business"]);
  const store = createBusinessStore();
  const business = await store.getMyBusiness(user.userId);
  const goals = business ? await store.listGoals(business.id) : [];
  const reads = createFundingReads();
  const [funding, payouts] =
    business && goals.length > 0
      ? await Promise.all([reads.goalFunding(business.id), reads.milestonePayouts(business.id)])
      : [[], []];

  return (
    <DashboardShell title="Your business" roleLabel="Business account" name={user.fullName}>
      {!business ? (
        <section className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
          <h2 className="text-lg font-semibold">Set up your business profile</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Tell supporters who you are and what you do. It takes about two minutes.
          </p>
          <Link
            href="/business/profile"
            className="mt-4 inline-block rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
          >
            Create business profile
          </Link>
        </section>
      ) : (
        <div className="space-y-8">
          <section className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{business.name}</h2>
                <p className="text-sm text-slate-600">
                  {categoryLabels[business.category]} · {business.suburb}
                  {business.hasLocation && " · on the map"}
                </p>
                <p className="text-xs text-slate-500">
                  Trust level: {trustTierLabels[business.trustTier]}
                </p>
              </div>
              <VerificationBadge status={business.verification} />
            </div>
            {business.description && (
              <p className="mt-3 text-sm text-slate-700">{business.description}</p>
            )}
            {!business.hasLocation && (
              <p className="mt-3 text-sm text-slate-600">
                No map location yet.{" "}
                <Link href="/business/profile" className="text-brand underline">
                  Add your area
                </Link>{" "}
                so nearby supporters can find you.
              </p>
            )}
            {business.verification !== "verified" && (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                {business.verification === "pending" &&
                  "Your documents are being reviewed. Your business becomes visible to supporters once it is verified."}
                {business.verification === "rejected" &&
                  "Some of your documents need attention before your business can be verified."}
                {business.verification === "unverified" &&
                  "Your business isn't visible to supporters yet. Upload your documents to get verified."}
                {business.verification === "suspended" &&
                  "Your business is suspended. Please contact support."}{" "}
                {business.verification !== "suspended" && (
                  <Link href="/business/documents" className="font-medium underline">
                    {business.verification === "pending"
                      ? "View your documents"
                      : "Verify your business"}
                  </Link>
                )}
              </div>
            )}
            <Link
              href="/business/profile"
              className="mt-3 inline-block text-sm text-brand underline"
            >
              Edit profile
            </Link>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Funding goals</h2>
              <Link
                href="/business/goals/new"
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Add a funding goal
              </Link>
            </div>
            {goals.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
                No goals yet. Add one to tell supporters what you need and how you will use it.
              </p>
            ) : (
              <div className="space-y-4">
                {goals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    funding={funding.find((f) => f.goalId === goal.id)}
                    payouts={payouts}
                    manageHref={`/business/goals/${goal.id}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
