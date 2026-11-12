import { Building2, HandCoins, Lock, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { VerificationBadge } from "@/components/VerificationBadge";
import { requireUser } from "@/app/_lib/guard";
import { categoryLabels, isBusinessCategory } from "@/domain/business-categories";
import { documentInfo, isUploadableType, trustTierLabels } from "@/domain/documents";
import { formatRand } from "@/domain/money";
import { createAdminDirectory } from "@/infrastructure/supabase/admin-store";
import { createMilestoneStore } from "@/infrastructure/supabase/milestone-store";
import type { ReviewQueueItem } from "@/application/ports";
import { processPayoutsAction, reviewDocumentAction, reviewMilestoneAction } from "./actions";
import { getProofQueue, getReviewQueue } from "./_queues";

/** The browser tab shows how many items are waiting, e.g. "Review queue (3) | Kasi Kapital". */
export async function generateMetadata() {
  // The page does its own sign-in and role checks. This only needs the counts, and the database
  // returns empty lists to anyone who is not a fully signed-in administrator.
  let total = 0;
  try {
    const [proofs, docs] = await Promise.all([getProofQueue(), getReviewQueue()]);
    total = proofs.length + docs.length;
  } catch {
    // A failed count must never break the page; fall back to the plain title.
  }
  return {
    title: total > 0 ? `Review queue (${total}) | Kasi Kapital` : "Review queue | Kasi Kapital",
  };
}

const notices: Record<string, string> = {
  approved: "Document approved.",
  rejected: "Document rejected. The founder can see your reason and upload a replacement.",
  proof_rejected: "Proof rejected. The founder can see your reason and send new proof.",
  proof_approved_paid: "Proof approved and the money for that milestone was paid out.",
  proof_approved_waiting:
    "Proof approved. The goal hasn't raised enough yet, so the payout will be created automatically when more money arrives.",
  payments_off: "Payments are switched off on this server, so nothing was paid out.",
  proof_approved_payments_off:
    "Proof approved. Payments are switched off on this server, so the payout is waiting.",
  proof_approved_payout_pending:
    "Proof approved. The payout is waiting for a super admin to release it.",
  proof_approved_payout_failed:
    "Proof approved, but the payout did not go through. It is waiting below; use “Pay out now” to retry.",
};
const errors: Record<string, string> = {
  note_required: "Please give a reason when rejecting.",
  already_reviewed: "Someone has already reviewed that document.",
  not_submitted: "That business has not been submitted for review.",
  not_waiting: "That milestone is not waiting for review.",
  invalid_input: "That request was not valid.",
  failed: "Something went wrong. Please try again.",
};

const dateFormat = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function groupByBusiness(items: ReviewQueueItem[]) {
  const groups = new Map<
    string,
    { business: ReviewQueueItem["business"]; documents: ReviewQueueItem[] }
  >();
  for (const item of items) {
    const group = groups.get(item.business.id) ?? { business: item.business, documents: [] };
    group.documents.push(item);
    groups.set(item.business.id, group);
  }
  return [...groups.values()];
}

function noticeText(notice: string | undefined, paid?: string, failed?: string) {
  if (notice === "payouts_done")
    return `Payouts processed: ${Number(paid) || 0} paid, ${Number(failed) || 0} failed.`;
  return notice ? notices[notice] : undefined;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; paid?: string; failed?: string }>;
}) {
  const user = await requireUser(["admin"]);
  const { notice, error, paid, failed } = await searchParams;
  const milestones = createMilestoneStore();
  const isSuperAdmin = user.adminLevel === "super_admin";
  const [queue, proofs, payouts, stats] = await Promise.all([
    getReviewQueue(),
    getProofQueue(),
    milestones.listPendingPayouts(),
    createAdminDirectory().platformStats(),
  ]);
  const groups = groupByBusiness(queue);

  const message = noticeText(notice, paid, failed);
  const input = "min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm";

  return (
    <DashboardShell
      role="admin"
      adminLevel={user.adminLevel}
      name={user.fullName}
      title="Review queue"
      subtitle="Check documents and proof before any money moves."
    >
      {message && (
        <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">
          {message}
        </p>
      )}
      {error && errors[error] && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {errors[error]}
        </p>
      )}
      {stats && (
        <section
          aria-label="Platform at a glance"
          className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Businesses"
            value={stats.totalBusinesses}
            Icon={Building2}
            note={`${stats.pendingBusinesses} under review`}
          />
          <StatCard
            label="Verified businesses"
            value={stats.verifiedBusinesses}
            Icon={ShieldCheck}
          />
          <StatCard label="Open goals" value={stats.openGoals} Icon={HandCoins} tone="amber" />
          <StatCard
            label="Held in escrow"
            value={formatRand(stats.heldCents)}
            Icon={Lock}
            tone="slate"
            note={`${formatRand(stats.paidOutCents)} paid out so far`}
          />
        </section>
      )}
      <p className="mb-6 text-sm text-gray-600">Opening a document is recorded in the audit log.</p>

      <section className="mb-10" aria-labelledby="proofs-heading">
        <h2 id="proofs-heading" className="mb-1 text-lg font-semibold">
          Milestone proofs
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          {proofs.length === 0 ? "No proof is waiting." : `${proofs.length} waiting.`} Approving
          releases that milestone&apos;s money to the founder once the goal has raised enough.
        </p>
        <ul className="space-y-3">
          {proofs.map((p) => (
            <li key={p.milestoneId} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {p.businessName ?? "A business"} · {p.goalTitle ?? "A goal"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Milestone: {p.milestoneTitle} · <strong>{formatRand(p.amountCents)}</strong>
                  </p>
                </div>
                {p.proofDocumentId && (
                  <a
                    href={`/documents/${p.proofDocumentId}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand underline"
                  >
                    Open invoice or quote
                  </a>
                )}
              </div>
              <form
                action={reviewMilestoneAction}
                className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <input type="hidden" name="milestoneId" value={p.milestoneId} />
                <input
                  name="note"
                  maxLength={300}
                  aria-label={`Reason for ${p.milestoneTitle} (required if you reject)`}
                  placeholder="Reason (required if you reject)"
                  className={input}
                />
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Approve
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="reject"
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                >
                  Reject
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10" aria-labelledby="payouts-heading">
        <h2 id="payouts-heading" className="mb-1 text-lg font-semibold">
          Payouts waiting
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          {payouts.length === 0 ? "Nothing is waiting to be paid." : `${payouts.length} to pay.`}
        </p>
        {payouts.length > 0 && (
          <>
            <ul className="space-y-2">
              {payouts.map((p) => (
                <li key={p.id} className="card p-4 text-sm">
                  <span className="font-medium">{formatRand(p.amountCents)}</span> to{" "}
                  {p.businessName ?? "a business"} for “{p.milestoneTitle ?? "a milestone"}”
                  {p.failureReason && (
                    <span className="block text-xs text-red-700">
                      Last attempt failed: {p.failureReason}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {isSuperAdmin ? (
              <form action={processPayoutsAction} className="mt-3">
                <button
                  type="submit"
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  Pay out now
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Only a super admin can pay out.</p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="verify-heading">
        <h2 id="verify-heading" className="mb-1 text-lg font-semibold">
          Business verification
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          {groups.length === 0
            ? "Nothing is waiting for review."
            : `${groups.length} business${groups.length === 1 ? "" : "es"} waiting.`}
        </p>
        <div className="space-y-6">
          {groups.map(({ business, documents }) => (
            <section key={business.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{business.name}</h3>
                  <p className="text-sm text-gray-600">
                    {isBusinessCategory(business.category)
                      ? categoryLabels[business.category]
                      : business.category}
                    {business.suburb && ` · ${business.suburb}`}
                    {business.ownerName && ` · Owner: ${business.ownerName}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    Trust level now: {trustTierLabels[business.trustTier]}
                  </p>
                </div>
                <VerificationBadge status={business.verification} />
              </div>
              <ul className="mt-3 space-y-3">
                {documents.map((doc) => (
                  <li key={doc.documentId} className="rounded-xl bg-gray-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {isUploadableType(doc.type) ? documentInfo[doc.type].label : doc.type}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          uploaded {dateFormat.format(new Date(doc.uploadedAt))}
                        </span>
                      </p>
                      <a
                        href={`/documents/${doc.documentId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand underline"
                      >
                        Open document
                      </a>
                    </div>
                    <form
                      action={reviewDocumentAction}
                      className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="documentId" value={doc.documentId} />
                      <input
                        name="note"
                        maxLength={300}
                        aria-label={`Reason for ${business.name} (required if you reject)`}
                        placeholder="Reason (required if you reject)"
                        className={input}
                      />
                      <button
                        type="submit"
                        name="decision"
                        value="approve"
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        Approve
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="reject"
                        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                      >
                        Reject
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
