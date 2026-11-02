import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";
import { isDemoKycEnabled, isServiceKeyConfigured } from "@/config/env";
import { verifyIdentityAction } from "./actions";

export const metadata = { title: "Verify your identity | Kasi Kapital" };

const notices: Record<string, string> = {
  verified: "Your identity is marked as verified. The R1 000 limit no longer applies to you.",
};
const errors: Record<string, string> = {
  disabled: "Identity verification isn't available in this environment.",
  failed: "We couldn't update your verification. Please try again.",
};

export default async function VerifyIdentityPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireUser(["investor", "donor"]);
  const { notice, error } = await searchParams;
  const demo = isDemoKycEnabled() && isServiceKeyConfigured();

  return (
    <DashboardShell
      role={user.role}
      name={user.fullName}
      title="Verify your identity"
      subtitle="Until we have checked who you are, you can give up to R1 000 in total. This protects founders and other supporters from fraud."
      narrow
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

      <div className="card p-6 sm:p-8">
        {demo ? (
          <form action={verifyIdentityAction} className="space-y-4">
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Demo only.</strong> In the real product an identity provider checks your ID
              and a selfie. Here, one click marks you as verified so you can try larger
              contributions.
            </p>
            <button type="submit" className="btn-primary w-full py-3">
              Verify me (demo)
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-700">
            Identity checks with our provider aren&apos;t switched on yet. Until they are,
            contributions are limited to R1 000 in total.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
