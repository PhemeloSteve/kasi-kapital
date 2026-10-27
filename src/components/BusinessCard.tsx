import Link from "next/link";
import type { PublicBusiness } from "@/application/ports";
import { categoryLabels } from "@/domain/business-categories";
import { formatDistance } from "@/domain/distance";
import { formatRand } from "@/domain/money";
import { TrustTierBadge } from "./TrustTierBadge";

const shorten = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;

export function BusinessCard({ business }: { business: PublicBusiness }) {
  return (
    <li>
      <Link
        href={`/businesses/${business.id}`}
        className="block rounded-lg border border-slate-200 p-4 transition hover:border-brand hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">{business.name}</h3>
            <p className="text-sm text-slate-600">
              {categoryLabels[business.category]}
              {business.suburb && ` · ${business.suburb}`}
              {business.distanceKm !== null && ` · ${formatDistance(business.distanceKm)}`}
            </p>
          </div>
          <TrustTierBadge tier={business.trustTier} />
        </div>
        {business.description && (
          <p className="mt-2 text-sm text-slate-700">{shorten(business.description, 140)}</p>
        )}
        <p className="mt-2 text-sm font-medium text-brand">
          {business.openGoalCount === 0
            ? "No open funding goals right now"
            : `${business.openGoalCount} open goal${business.openGoalCount === 1 ? "" : "s"} · ${formatRand(business.openGoalTargetCents)} needed`}
        </p>
      </Link>
    </li>
  );
}
