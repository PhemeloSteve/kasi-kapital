import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";
import { formatRand } from "@/domain/money";
import { landingPathForRole } from "@/domain/roles";
import { createContributionStore } from "@/infrastructure/supabase/funding-store";
import type { ContributionStatus } from "@/application/ports";

export const metadata = { title: "My contributions | Kasi Kapital" };

const statusLabels: Record<ContributionStatus, { label: string; className: string }> = {
  pending: { label: "Waiting for payment", className: "bg-amber-100 text-amber-900" },
  held: { label: "Held safely", className: "bg-green-100 text-green-800" },
  released: { label: "Released", className: "bg-green-100 text-green-800" },
  failed: { label: "Not completed", className: "bg-gray-100 text-gray-700" },
  refunded: { label: "Refunded", className: "bg-gray-100 text-gray-700" },
};

const notices: Record<string, string> = {
  thanks: "Thank you! Your contribution is held safely until the founder shows proof of spending.",
};
const errors: Record<string, string> = {
  expired:
    "That checkout expired before it was paid, so nothing was taken. You can start again from the business page.",
  closed: "That checkout is no longer open.",
  failed: "We couldn't complete that payment. Nothing was taken. Please try again.",
};

const dateFormat = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireUser(["investor", "donor"]);
  const { notice, error } = await searchParams;
  const contributions = await createContributionStore().listMine();
  const heldTotal = contributions
    .filter((c) => c.status === "held")
    .reduce((sum, c) => sum + c.amountCents, 0);

  return (
    <DashboardShell
      title="My contributions"
      subtitle="Everything you have given, and where it stands."
      role={user.role}
      name={user.fullName}
    >
      <Link href={landingPathForRole(user.role)} className="text-sm text-gray-600 underline">
        Back to businesses
      </Link>

      {notice && notices[notice] && (
        <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">
          {notices[notice]}
        </p>
      )}
      {error && errors[error] && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {errors[error]}
        </p>
      )}

      <p className="mt-4 text-sm text-gray-600">
        Total held for businesses: <strong>{formatRand(heldTotal)}</strong>. Until your identity is
        verified you can give up to R1 000 in total.{" "}
        <Link href="/verify-identity" className="text-brand underline">
          Verify your identity
        </Link>
      </p>

      {contributions.length === 0 ? (
        <p className="mt-6 card border-dashed p-8 text-center text-sm text-gray-600">
          You haven&apos;t contributed yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {contributions.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {c.businessId ? (
                      <Link href={`/businesses/${c.businessId}`} className="text-brand underline">
                        {c.businessName ?? "A business"}
                      </Link>
                    ) : (
                      (c.businessName ?? "A business")
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {c.goalTitle ?? "A funding goal"} · {dateFormat.format(new Date(c.createdAt))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatRand(c.amountCents)}</p>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabels[c.status].className}`}
                  >
                    {statusLabels[c.status].label}
                  </span>
                </div>
              </div>
              {c.status === "pending" && (
                <Link
                  href={`/mock-checkout/${c.id}`}
                  className="mt-2 inline-block text-sm text-brand underline"
                >
                  Finish paying
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
