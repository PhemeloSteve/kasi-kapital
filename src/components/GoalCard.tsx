import Link from "next/link";
import type { ReactNode } from "react";
import type { GoalFunding, GoalRecord, MilestonePayout } from "@/application/ports";
import { allocateFunding, progressPercent } from "@/domain/funding";
import { formatRand } from "@/domain/money";
import { MilestoneRow } from "./MilestoneRow";
import { milestoneLabel, milestoneTone, type MilestoneTone } from "./milestone-labels";
import { ProgressBar } from "./ui/ProgressBar";

const kindLabels = {
  donation: "Donation: nothing expected back",
  presale: "Pre-sale: supporters get goods or vouchers",
} as const;

type Milestone = GoalRecord["milestones"][number];

type Props = {
  goal: GoalRecord;
  /** Money raised so far. Leave out to show the plain plan without progress. */
  funding?: GoalFunding;
  payouts?: MilestonePayout[];
  manageHref?: string;
  /** A bigger version for the goal a page is mainly about. */
  featured?: boolean;
  /** Extra content under a milestone, such as the founder's proof upload. */
  milestoneExtra?: (milestone: Milestone, context: { tone: MilestoneTone }) => ReactNode;
  /** Content under the goal, such as the contribute form. */
  children?: ReactNode;
};

export function GoalCard({
  goal,
  funding,
  payouts = [],
  manageHref,
  featured,
  milestoneExtra,
  children,
}: Props) {
  const raised = funding?.raisedCents ?? 0;
  const percent = progressPercent(raised, goal.targetCents);
  const allocation = allocateFunding(raised, goal.milestones);

  return (
    <article id={`goal-${goal.id}`} className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`font-bold text-gray-900 ${featured ? "text-xl" : "text-lg"}`}>
            {goal.title}
          </h3>
          <p className="text-sm text-gray-500">{kindLabels[goal.kind]}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${goal.isOpen ? "bg-brand-light text-brand" : "bg-gray-100 text-gray-600"}`}
        >
          {goal.isOpen ? "Funding open" : "Closed"}
        </span>
      </div>
      {goal.description && <p className="mt-3 text-sm text-gray-700">{goal.description}</p>}

      <div className="mt-5">
        {funding ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className={`font-bold text-gray-900 ${featured ? "text-4xl" : "text-2xl"}`}>
                {formatRand(raised)}{" "}
                <span className="text-base font-medium text-gray-500">raised</span>
              </p>
              <p className="text-sm font-medium text-gray-500">
                Target: {formatRand(goal.targetCents)}
              </p>
            </div>
            <div className="mt-3">
              <ProgressBar
                percent={percent}
                label={`${goal.title}: ${percent}% funded`}
                large={featured}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-semibold text-brand">{percent}% funded</span> ·{" "}
              {funding.supporterCount} supporter{funding.supporterCount === 1 ? "" : "s"}
              {funding.paidOutCents > 0 &&
                ` · ${formatRand(funding.paidOutCents)} paid out to the business`}
            </p>
          </>
        ) : (
          <p className="text-2xl font-bold text-gray-900">{formatRand(goal.targetCents)}</p>
        )}
      </div>

      <h4 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Milestones and payouts
      </h4>
      <ol className="space-y-2.5">
        {goal.milestones.map((m, index) => {
          const payout = payouts.find((p) => p.milestoneId === m.id)?.status ?? null;
          const funded = funding ? (allocation[index]?.state ?? null) : null;
          const input = { status: m.status, funded, payout };
          return (
            <MilestoneRow
              key={m.id}
              index={index + 1}
              title={m.title}
              amountCents={m.amountCents}
              label={milestoneLabel(input)}
              tone={milestoneTone(input)}
            >
              {milestoneExtra?.(m, { tone: milestoneTone(input) })}
            </MilestoneRow>
          );
        })}
      </ol>

      {children}
      {manageHref && (
        <Link href={manageHref} className="btn-secondary mt-5">
          Manage milestones and proof
        </Link>
      )}
    </article>
  );
}
