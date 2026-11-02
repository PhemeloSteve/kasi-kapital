import { Lock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";
import { formatRand } from "@/domain/money";
import { isMockPayments, paymentsReady } from "@/infrastructure/providers";
import { createContributionStore } from "@/infrastructure/supabase/funding-store";
import { payDemoCheckoutAction } from "./actions";

export const metadata = { title: "Demo checkout | Kasi Kapital" };

export default async function MockCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["investor", "donor"]);
  if (!isMockPayments()) notFound();

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  // Read as the signed-in person: anyone else's contribution simply isn't found.
  const contribution = await createContributionStore().getMine(id.data);
  if (!contribution) notFound();
  if (contribution.status === "held") redirect("/contributions?notice=thanks");

  return (
    <DashboardShell
      role={user.role}
      name={user.fullName}
      title="Confirm your contribution"
      subtitle="Review the details, then pay."
      narrow
    >
      <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Demo checkout.</strong> No real money moves. This stands in for a payment provider
        so you can see how the flow works.
      </p>

      <div className="card p-6 sm:p-8">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Business</dt>
            <dd className="font-medium text-gray-900">
              {contribution.businessName ?? "A business"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Goal</dt>
            <dd className="font-medium text-gray-900">
              {contribution.goalTitle ?? "A funding goal"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-brand-border pt-3 text-base">
            <dt className="font-medium text-gray-900">Amount</dt>
            <dd className="text-xl font-bold text-gray-900">
              {formatRand(contribution.amountCents)}
            </dd>
          </div>
        </dl>

        <p className="mt-5 flex gap-2 rounded-xl bg-brand-light p-3 text-sm text-gray-700">
          <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          Your money is held safely. It is released to the business one milestone at a time, only
          after an administrator has checked the founder&apos;s proof.
        </p>

        {contribution.status !== "pending" ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            This checkout is no longer open. Start again from the business page.
          </p>
        ) : !paymentsReady() ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Payments aren&apos;t set up on this server yet. The administrator needs to add the
            Supabase service-role key (SUPABASE_SERVICE_ROLE_KEY) to the server settings.
          </p>
        ) : (
          <form action={payDemoCheckoutAction} className="mt-5">
            <input type="hidden" name="contributionId" value={contribution.id} />
            <button type="submit" className="btn-primary w-full py-3 text-base">
              Pay {formatRand(contribution.amountCents)} (demo)
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/contributions" className="text-gray-600 underline">
            Cancel
          </Link>
        </p>
      </div>
    </DashboardShell>
  );
}
