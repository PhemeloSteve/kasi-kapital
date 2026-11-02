import { ArrowLeft, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/application/discovery";
import { CategoryChip } from "@/components/CategoryChip";
import { ContributeForm } from "@/components/ContributeForm";
import { DashboardShell } from "@/components/DashboardShell";
import { GoalCard } from "@/components/GoalCard";
import { TrustTierBadge } from "@/components/TrustTierBadge";
import { requireUser } from "@/app/_lib/guard";
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
    <DashboardShell
      role={user.role}
      name={user.fullName}
      title={business.name}
      subtitle={business.suburb ?? undefined}
    >
      <Link
        href={landingPathForRole(user.role)}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to businesses
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="goals-heading">
            <h2 id="goals-heading" className="mb-4 text-xl font-bold text-gray-900">
              Funding goals
            </h2>
            {goals.length === 0 ? (
              <p className="card border-dashed p-8 text-center text-sm text-gray-600">
                This business has not set a funding goal yet.
              </p>
            ) : (
              <div className="space-y-5">
                {goals.map((goal) => {
                  const goalFunding = funding.find((f) => f.goalId === goal.id);
                  return (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      featured
                      funding={goalFunding}
                      payouts={payouts}
                    >
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
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6" aria-label="About this business">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip category={business.category} />
              <TrustTierBadge tier={business.trustTier} />
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-gray-600">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {business.suburb ?? "South Africa"}
            </p>
            {business.description && <p className="mt-3 text-gray-800">{business.description}</p>}
            {links.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-brand-border pt-4 text-sm">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 font-medium text-brand underline"
                    >
                      {link.label}
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card bg-brand-light p-6" aria-label="How your money is protected">
            <h2 className="flex items-center gap-2 font-bold text-brand">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              How your money is protected
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              Your contribution is held until the founder shows proof of spending, an invoice or
              quote. An administrator checks the proof, and only then is that milestone&apos;s money
              released to the business.
            </p>
          </section>
        </aside>
      </div>
    </DashboardShell>
  );
}
