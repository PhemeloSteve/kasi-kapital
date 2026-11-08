import { DashboardShell } from "@/components/DashboardShell";
import { VerificationBadge } from "@/components/VerificationBadge";
import { requireSuperAdmin } from "@/app/_lib/guard";
import { formatRand } from "@/domain/money";
import { roleLabels } from "@/domain/roles";
import { createAdminDirectory } from "@/infrastructure/supabase/admin-store";

export const metadata = { title: "Users | Kasi Kapital" };

export default async function AdminUsersPage() {
  const user = await requireSuperAdmin();
  const users = await createAdminDirectory().listUsers();

  return (
    <DashboardShell
      role="admin"
      adminLevel={user.adminLevel}
      name={user.fullName}
      title="Users"
      subtitle="Every account, newest first (up to 500). Contributed counts money held or released."
    >
      {users.length === 0 ? (
        <p className="card p-6 text-sm text-gray-600">No accounts yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-light/40 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Name
                </th>
                <th scope="col" className="px-4 py-3">
                  Email
                </th>
                <th scope="col" className="px-4 py-3">
                  Role
                </th>
                <th scope="col" className="px-4 py-3">
                  Identity check
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Contributed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.fullName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{u.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{roleLabels[u.role]}</td>
                  <td className="px-4 py-3">
                    <VerificationBadge status={u.kycStatus} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatRand(u.contributedCents)}
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
