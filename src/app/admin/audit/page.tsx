import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { requireSuperAdmin } from "@/app/_lib/guard";
import {
  auditActionTone,
  parseAuditFilter,
  parseAuditPage,
  shortId,
  type AuditTone,
} from "@/domain/audit";
import { createAuditStore } from "@/infrastructure/supabase/audit-store";

export const metadata = { title: "Audit log | Kasi Kapital" };

const toneClass: Record<AuditTone, string> = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-900",
  slate: "bg-gray-100 text-gray-700",
};

const whenFormat = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});

function pageHref(page: number, action: string | null, entity: string | null): string {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (entity) params.set("entity", entity);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; page?: string }>;
}) {
  const user = await requireSuperAdmin();
  const params = await searchParams;
  const action = parseAuditFilter(params.action);
  const entity = parseAuditFilter(params.entity);
  const page = parseAuditPage(params.page);

  const { items, hasMore } = await createAuditStore().list({ action, entity, page });

  return (
    <DashboardShell
      role="admin"
      adminLevel={user.adminLevel}
      name={user.fullName}
      title="Audit log"
      subtitle="Every administrator action and every document opened, newest first."
    >
      <form method="get" className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="audit-action" className="mb-1 block text-xs font-medium text-gray-600">
            Action
          </label>
          <input
            id="audit-action"
            name="action"
            defaultValue={action ?? ""}
            maxLength={60}
            placeholder="e.g. business.suspended"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="audit-entity" className="mb-1 block text-xs font-medium text-gray-600">
            Entity
          </label>
          <input
            id="audit-entity"
            name="entity"
            defaultValue={entity ?? ""}
            maxLength={60}
            placeholder="e.g. businesses"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="btn-primary">
          Filter
        </button>
        {(action || entity) && (
          <Link href="/admin/audit" className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <p className="card p-6 text-sm text-gray-600">
          {page > 1 || action || entity ? "No audit entries match." : "No audit entries yet."}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-light/40 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  When
                </th>
                <th scope="col" className="px-4 py-3">
                  Admin
                </th>
                <th scope="col" className="px-4 py-3">
                  Action
                </th>
                <th scope="col" className="px-4 py-3">
                  Entity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {whenFormat.format(new Date(entry.createdAt))}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{entry.actorName ?? "System"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[auditActionTone(entry.action)]}`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {entry.entity}
                    {entry.entityId && (
                      <span className="ml-2 font-mono text-xs text-gray-500">
                        {shortId(entry.entityId)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link href={pageHref(page - 1, action, entity)} className="btn-secondary">
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-gray-500">Page {page}</span>
        {hasMore ? (
          <Link href={pageHref(page + 1, action, entity)} className="btn-secondary">
            Next
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </DashboardShell>
  );
}
