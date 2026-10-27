import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/application/discovery";
import { ContributeForm } from "@/components/ContributeForm";
import { GoalCard } from "@/components/GoalCard";
import { TrustTierBadge } from "@/components/TrustTierBadge";
import { requireUser } from "@/app/_lib/guard";
import { categoryLabels } from "@/domain/business-categories";
import { landingPathForRole } from "@/domain/roles";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createDiscoveryStore } from "@/infrastructure/supabase/discovery-store";
import { createFundingReads } from "@/infrastructure/supabase/funding-store";

export const metadata = { title: "Business | Kasi Kapital" };

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["investor", "donor", "admin"]);
  const result = await getPublicBusiness({ discovery: createDiscoveryStore() }, (await params).id);
  if (!result.ok) notFound();

  const business = result.value;
  const reads = createFundingReads();
  const [goals, funding, payouts] = await Promise.all([
    createBusinessStore().listGoals(business.id),
    reads.goalFunding(business.id),
    reads.milestonePayouts(business.id),
  ]);
  const canContribute = user.role === "investor" || user.role === "donor";
  const links = [
    { label: "Facebook", url: business.facebookUrl },
    { label: "YouTube", url: business.youtubeUrl },
    { label: "LinkedIn", url: business.linkedinUrl },
  ].flatMap((link) => (link.url ? [{ label: link.label, url: link.url }] : []));

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href={landingPathForRole(user.role)} className="text-sm text-slate-600 underline">
        Back to businesses
      </Link>

      <header className="mt-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{business.name}</h1>
            <p className="text-sm text-slate-600">
              {categoryLabels[business.category]}
              {business.suburb && ` · ${business.suburb}`}
            </p>
          </div>
          <TrustTierBadge tier={business.trustTier} />
        </div>
        {business.description && <p className="mt-3 text-slate-800">{business.description}</p>}
        {links.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-4 text-sm">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-brand underline"
              >
                {link.label}
              </a>
            ))}
          </p>
        )}
      </header>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Funding goals</h2>
        {goals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
            This business has not set a funding goal yet.
          </p>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const goalFunding = funding.find((f) => f.goalId === goal.id);
              return (
                <GoalCard key={goal.id} goal={goal} funding={goalFunding} payouts={payouts}>
                  {canContribute && goal.isOpen && (
                    <ContributeForm
                      goalId={goal.id}
                      goalTitle={goal.title}
                      remainingCents={goal.targetCents - (goalFunding?.raisedCents ?? 0)}
                    />
                  )}
                </GoalCard>
              );
            })}
          </div>
        )}
        <p role="note" className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          How your money is protected: it is held until the founder shows proof of spending (an
          invoice or quote). An administrator checks the proof, and only then is that
          milestone&apos;s money released to the business.
        </p>
      </section>
    </main>
  );
}
