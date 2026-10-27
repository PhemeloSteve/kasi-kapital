import { BusinessForm } from "@/components/BusinessForm";
import { requireUser } from "@/app/_lib/guard";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";

export const metadata = { title: "Business profile | Kasi Kapital" };

export default async function BusinessProfilePage() {
  const user = await requireUser(["business"]);
  const business = await createBusinessStore().getMyBusiness(user.userId);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold text-brand">
        {business ? "Edit your business" : "Create your business profile"}
      </h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Supporters will see this once your business is verified.
      </p>
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
    </main>
  );
}
