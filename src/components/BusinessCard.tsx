import { MapPin } from "lucide-react";
import Link from "next/link";
import type { PublicBusiness } from "@/application/ports";
import { formatDistance } from "@/domain/distance";
import { formatRand } from "@/domain/money";
import { progressPercent } from "@/domain/funding";
import { CategoryChip } from "./CategoryChip";
import { TrustTierBadge } from "./TrustTierBadge";
import { ProgressBar } from "./ui/ProgressBar";

const shorten = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;

/** One verified business in the discovery grid, with its current goal and a way to back it. */
export function BusinessCard({ business }: { business: PublicBusiness }) {
  const goal = business.featuredGoal;
  const percent = goal ? progressPercent(goal.raisedCents, goal.targetCents) : 0;
  const href = `/businesses/${business.id}${goal ? `#goal-${goal.id}` : ""}`;

  return (
    <li className="card flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <CategoryChip category={business.category} />
        <TrustTierBadge tier={business.trustTier} />
      </div>

      <h3 className="mt-4 text-lg font-bold text-gray-900">
        <Link href={`/businesses/${business.id}`} className="hover:underline">
          {business.name}
        </Link>
      </h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
        <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>
          {business.suburb ?? "South Africa"}
          {business.distanceKm !== null && ` · ${formatDistance(business.distanceKm)}`}
        </span>
      </p>
      {business.description && (
        <p className="mt-3 text-sm text-gray-600">{shorten(business.description, 110)}</p>
      )}

      <div className="mt-auto pt-5">
        {goal ? (
          <div className="rounded-xl bg-brand-cream p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">{goal.title}</p>
              <p className="shrink-0 text-xs font-semibold text-brand">{percent}%</p>
            </div>
            <div className="mt-2">
              <ProgressBar percent={percent} label={`${goal.title}: ${percent}% funded`} />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Raised {formatRand(goal.raisedCents)} of {formatRand(goal.targetCents)}
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-brand-cream p-4 text-sm text-gray-600">
            No open funding goal right now.
          </p>
        )}
        <Link href={href} className="btn-primary mt-4 w-full">
          {goal ? "Back this goal" : "View business"}
        </Link>
      </div>
    </li>
  );
}
