import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/app/_lib/guard";
import { formatRand } from "@/domain/money";
import { isMockPayments, paymentsReady } from "@/infrastructure/providers";
import { createContributionStore } from "@/infrastructure/supabase/funding-store";
import { payDemoCheckoutAction } from "./actions";

export const metadata = { title: "Demo checkout | Kasi Kapital" };

export default async function MockCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["investor", "donor"]);
  if (!isMockPayments()) notFound();

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  // Read as the signed-in person: anyone else's contribution simply isn't found.
  const contribution = await createContributionStore().getMine(id.data);
  if (!contribution) notFound();
  if (contribution.status === "held") redirect("/contributions?notice=thanks");

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Demo checkout.</strong> No real money moves. This stands in for a payment provider
        so you can see how the flow works.
      </p>

      <h1 className="mt-6 text-2xl font-bold text-brand">Confirm your contribution</h1>
      <dl className="mt-4 space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Business</dt>
          <dd className="font-medium">{contribution.businessName ?? "A business"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Goal</dt>
          <dd className="font-medium">{contribution.goalTitle ?? "A funding goal"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base">
          <dt>Amount</dt>
          <dd className="font-bold">{formatRand(contribution.amountCents)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-slate-700">
        Your money is held safely. It is released to the business one milestone at a time, only
        after an administrator has checked the founder&apos;s proof.
      </p>

      {contribution.status !== "pending" ? (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          This checkout is no longer open. Start again from the business page.
        </p>
      ) : !paymentsReady() ? (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Payments aren&apos;t set up on this server yet. The administrator needs to add the
          Supabase service-role key (SUPABASE_SERVICE_ROLE_KEY) to the server settings.
        </p>
      ) : (
        <form action={payDemoCheckoutAction} className="mt-4">
          <input type="hidden" name="contributionId" value={contribution.id} />
          <button
            type="submit"
            className="w-full rounded-md bg-brand px-5 py-3 font-medium text-white hover:bg-brand-dark"
          >
            Pay {formatRand(contribution.amountCents)} (demo)
          </button>
        </form>
      )}
      <p className="mt-3 text-center text-sm">
        <Link href="/contributions" className="text-slate-600 underline">
          Cancel
        </Link>
      </p>
    </main>
  );
}
