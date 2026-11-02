import { BusinessForm } from "@/components/BusinessForm";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";

export const metadata = { title: "Business profile | Kasi Kapital" };

export default async function BusinessProfilePage() {
  const user = await requireUser(["business"]);
  const business = await createBusinessStore().getMyBusiness(user.userId);

  return (
    <DashboardShell
      role="business"
      name={user.fullName}
      title={business ? "Edit your business" : "Create your business profile"}
      subtitle="Supporters will see this once your business is verified."
      narrow
    >
      <div className="card p-6 sm:p-8">
        <BusinessForm
          isEdit={business !== null}
          hasSavedLocation={business?.hasLocation ?? false}
          defaults={
            business
              ? {
                  name: business.name,
                  category: business.category,
                  description: business.description ?? "",
                  suburb: business.suburb,
                  youtubeUrl: business.youtubeUrl ?? "",
                  facebookUrl: business.facebookUrl ?? "",
                  linkedinUrl: business.linkedinUrl ?? "",
                }
              : undefined
          }
        />
      </div>
    </DashboardShell>
  );
}
