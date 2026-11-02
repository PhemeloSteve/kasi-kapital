import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { BusinessDashboardView } from "@/components/business/BusinessDashboardView";
import { requireUser } from "@/app/_lib/guard";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";
import { createFundingReads } from "@/infrastructure/supabase/funding-store";

export const metadata = { title: "Your business | Kasi Kapital" };

export default async function BusinessPage() {
  const user = await requireUser(["business"]);
  const store = createBusinessStore();
  const business = await store.getMyBusiness(user.userId);

  if (!business) {
    return (
      <DashboardShell
        role="business"
        name={user.fullName}
        title="Welcome to Kasi Kapital"
        subtitle="Set up your business so supporters can find and back you."
      >
        <section className="card mx-auto max-w-xl p-10 text-center">
          <h2 className="text-xl font-bold text-gray-900">Set up your business profile</h2>
          <p className="mx-auto mt-2 max-w-md text-gray-600">
            Tell supporters who you are and what you do. It takes about two minutes.
          </p>
          <Link href="/business/profile" className="btn-primary mt-6 px-6">
            Create business profile
          </Link>
        </section>
      </DashboardShell>
    );
  }

  const goals = await store.listGoals(business.id);
  const reads = createFundingReads();
  const [funding, payouts, documents] = await Promise.all([
    goals.length > 0 ? reads.goalFunding(business.id) : Promise.resolve([]),
    goals.length > 0 ? reads.milestonePayouts(business.id) : Promise.resolve([]),
    createDocumentStore().listMyDocuments(business.id),
  ]);

  return (
    <BusinessDashboardView
      name={user.fullName}
      business={business}
      goals={goals}
      funding={funding}
      payouts={payouts}
      documents={documents}
    />
  );
}
