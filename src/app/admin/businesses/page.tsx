import { DashboardShell } from "@/components/DashboardShell";
import { TrustTierBadge } from "@/components/TrustTierBadge";
import { VerificationBadge } from "@/components/VerificationBadge";
import { requireSuperAdmin } from "@/app/_lib/guard";
import { createAdminDirectory } from "@/infrastructure/supabase/admin-store";
import { closeBusinessAction, suspendBusinessAction, unsuspendBusinessAction } from "./actions";

export const metadata = { title: "Businesses | Kasi Kapital" };

const notices: Record<string, string> = {
  suspended: "Business suspended. It is no longer visible to supporters.",
  unsuspended: "Business reinstated. It is back under review.",
  closed:
    "Business closed. Its unreviewed documents are deleted within a day, and approved ones after the retention period.",
};
const errors: Record<string, string> = {
  reason_required: "Please give a reason (up to 300 characters) for suspending.",
  not_allowed: "Only a super admin can do that.",
  not_found: "That business could not be found.",
  not_suspended: "That business is not suspended.",
  closed: "A closed business cannot be reinstated.",
  already_closed: "That business is already closed.",
  confirm_required: "Please tick the box to confirm. Closing cannot be undone.",
  money_held:
    "Money is still held for this business, or a payout is on its way. It can only be closed once that is settled.",
  invalid_input: "That request was not valid.",
  failed: "Something went wrong. Please try again.",
};

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireSuperAdmin();
  const { notice, error } = await searchParams;
  const businesses = await createAdminDirectory().listBusinesses();

  return (
    <DashboardShell
      role="admin"
      adminLevel={user.adminLevel}
      name={user.fullName}
      title="Businesses"
      subtitle="Every business on the platform. Suspending hides a business from supporters. Closing a business is permanent. Both are recorded in the audit log."
    >
      {notice && notices[notice] && (
        <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">
          {notices[notice]}
        </p>
      )}
      {error && errors[error] && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {errors[error]}
        </p>
      )}

      {businesses.length === 0 ? (
        <p className="card p-6 text-sm text-gray-600">No businesses yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-light/40 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Business
                </th>
                <th scope="col" className="px-4 py-3">
                  Owner
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Trust tier
                </th>
                <th scope="col" className="px-4 py-3">
                  Goals
                </th>
                <th scope="col" className="px-4 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {businesses.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-gray-700">{b.ownerName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {b.closedAt ? (
                      <span className="inline-block rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                        Closed
                      </span>
                    ) : (
                      <VerificationBadge status={b.verification} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TrustTierBadge tier={b.trustTier} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.goalCount}</td>
                  <td className="space-y-2 px-4 py-3">
                    {b.closedAt ? (
                      <p className="text-sm text-gray-600">Closed on {b.closedAt.slice(0, 10)}</p>
                    ) : (
                      <>
                        {b.verification === "suspended" ? (
                          <form action={unsuspendBusinessAction}>
                            <input type="hidden" name="businessId" value={b.id} />
                            <button type="submit" className="btn-secondary">
                              Reinstate
                            </button>
                          </form>
                        ) : (
                          <form action={suspendBusinessAction} className="flex items-center gap-2">
                            <input type="hidden" name="businessId" value={b.id} />
                            <input
                              name="reason"
                              required
                              maxLength={300}
                              aria-label={`Reason for suspending ${b.name}`}
                              placeholder="Reason (required)"
                              className="min-w-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                            >
                              Suspend
                            </button>
                          </form>
                        )}
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-gray-700">
                            Close business…
                          </summary>
                          <form action={closeBusinessAction} className="mt-2 space-y-2">
                            <input type="hidden" name="businessId" value={b.id} />
                            <input
                              name="reason"
                              required
                              maxLength={300}
                              aria-label={`Reason for closing ${b.name}`}
                              placeholder="Reason (required)"
                              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                            />
                            <label className="flex items-start gap-2 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                name="confirm"
                                value="yes"
                                required
                                className="mt-0.5"
                              />
                              <span>
                                I understand this cannot be undone. The business is hidden for good
                                and its documents are deleted after the retention period.
                              </span>
                            </label>
                            <button
                              type="submit"
                              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                            >
                              Close business
                            </button>
                          </form>
                        </details>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
