import Link from "next/link";
import type { ReactNode } from "react";
import type { GoalFunding, GoalRecord, MilestonePayout } from "@/application/ports";
import { allocateFunding, progressPercent } from "@/domain/funding";
import { formatRand } from "@/domain/money";
import { milestoneLabel } from "./milestone-labels";

const kindLabels = {
  donation: "Donation (nothing expected back)",
  presale: "Pre-sale (supporters get goods or vouchers)",
} as const;

type Milestone = GoalRecord["milestones"][number];

type Props = {
  goal: GoalRecord;
  /** Money raised so far. Leave out to show the plain plan without progress. */
  funding?: GoalFunding;
  payouts?: MilestonePayout[];
  manageHref?: string;
  /** Extra content under a milestone, such as the founder's proof upload. */
  milestoneExtra?: (milestone: Milestone) => ReactNode;
  /** Content under the goal, such as the contribute form. */
  children?: ReactNode;
};

export function GoalCard({
  goal,
  funding,
  payouts = [],
  manageHref,
  milestoneExtra,
  children,
}: Props) {
  const raised = funding?.raisedCents ?? 0;
  const percent = progressPercent(raised, goal.targetCents);
  const allocation = allocateFunding(raised, goal.milestones);

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{goal.title}</h3>
          <p className="text-xs text-slate-500">
            {kindLabels[goal.kind]}
            {!goal.isOpen && " · Closed"}
          </p>
        </div>
        <p className="text-lg font-bold text-brand">{formatRand(goal.targetCents)}</p>
      </div>
      {goal.description && <p className="mt-2 text-sm text-slate-700">{goal.description}</p>}

      {funding && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${goal.title}: ${percent}% funded`}
            className="h-2.5 overflow-hidden rounded-full bg-slate-200"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {formatRand(raised)} raised of {formatRand(goal.targetCents)} · {funding.supporterCount}{" "}
            supporter{funding.supporterCount === 1 ? "" : "s"}
            {funding.paidOutCents > 0 &&
              ` · ${formatRand(funding.paidOutCents)} paid out to the business`}
          </p>
        </div>
      )}

      <ol className="mt-3 space-y-2 text-sm">
        {goal.milestones.map((m, index) => {
          const payout = payouts.find((p) => p.milestoneId === m.id)?.status ?? null;
          const funded = funding ? (allocation[index]?.state ?? null) : null;
          return (
            <li key={m.id} className="rounded bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {index + 1}. {m.title}
                </span>
                <span className="text-right text-slate-600">
                  {formatRand(m.amountCents)}{" "}
                  <span className="text-xs">
                    ({milestoneLabel({ status: m.status, funded, payout })})
                  </span>
                </span>
              </div>
              {milestoneExtra?.(m)}
            </li>
          );
        })}
      </ol>

      {children}
      {manageHref && (
        <Link href={manageHref} className="mt-3 inline-block text-sm text-brand underline">
          Manage milestones and proof
        </Link>
      )}
    </article>
  );
}
