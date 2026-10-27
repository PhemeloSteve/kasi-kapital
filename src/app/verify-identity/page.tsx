import Link from "next/link";
import { requireUser } from "@/app/_lib/guard";
import { isDemoKycEnabled, isServiceKeyConfigured } from "@/config/env";
import { landingPathForRole } from "@/domain/roles";
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
    <main className="mx-auto max-w-md p-6">
      <Link href={landingPathForRole(user.role)} className="text-sm text-slate-600 underline">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-brand">Verify your identity</h1>
      <p className="mt-2 text-sm text-slate-700">
        Until we have checked who you are, you can give up to <strong>R1 000 in total</strong>. This
        protects founders and other supporters from fraud.
      </p>

      {notice && notices[notice] && (
        <p role="status" className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-900">
          {notices[notice]}
        </p>
      )}
      {error && errors[error] && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {errors[error]}
        </p>
      )}

      {demo ? (
        <form action={verifyIdentityAction} className="mt-6 space-y-3">
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Demo only.</strong> In the real product an identity provider checks your ID and
            a selfie. Here, one click marks you as verified so you can try larger contributions.
          </p>
          <button
            type="submit"
            className="w-full rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
          >
            Verify me (demo)
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Identity checks with our provider aren&apos;t switched on yet. Until they are,
          contributions are limited to R1 000 in total.
        </p>
      )}
    </main>
  );
}
