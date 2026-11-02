import { MapPin } from "lucide-react";
import Link from "next/link";
import type { BusinessRecord } from "@/application/ports";
import { CategoryChip } from "@/components/CategoryChip";
import { VerificationBadge } from "@/components/VerificationBadge";

export function ProfilePanel({ business }: { business: BusinessRecord }) {
  return (
    <section aria-labelledby="profile-heading" className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id="profile-heading" className="text-lg font-bold text-gray-900">
          {business.name}
        </h2>
        <VerificationBadge status={business.verification} />
      </div>
      <div className="mt-3">
        <CategoryChip category={business.category} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
        <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
        {business.suburb}
        {business.hasLocation ? " · on the map" : ""}
      </p>
      {business.description && <p className="mt-3 text-sm text-gray-700">{business.description}</p>}
      {!business.hasLocation && (
        <p className="mt-3 text-sm text-gray-600">
          No map location yet.{" "}
          <Link href="/business/profile" className="font-medium text-brand underline">
            Add your area
          </Link>{" "}
          so nearby supporters can find you.
        </p>
      )}
    </section>
  );
}
