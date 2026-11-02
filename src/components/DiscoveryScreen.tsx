import { Building2, Clock, HandCoins } from "lucide-react";
import Link from "next/link";
import { discoverBusinesses } from "@/application/discovery";
import type { DiscoveryFilters, PublicBusiness } from "@/application/ports";
import { discoveryHref } from "@/app/_lib/discovery-links";
import { summarizeContributions } from "@/domain/funding";
import { formatRand } from "@/domain/money";
import { firstName } from "@/domain/names";
import { createContributionStore } from "@/infrastructure/supabase/funding-store";
import { createDiscoveryStore } from "@/infrastructure/supabase/discovery-store";
import { BusinessCard } from "./BusinessCard";
import { DashboardShell } from "./DashboardShell";
import { DiscoveryFilterForm } from "./DiscoveryFilterForm";
import { DiscoveryMapPanel } from "./DiscoveryMapPanel";
import { StatCard } from "./ui/StatCard";

type Props = { role: "investor" | "donor"; name: string | null; params: Record<string, unknown> };

const copy = {
  investor:
    "Every business here has had its identity and trading checked by our team. Search, filter, or look near you.",
  donor:
    "Find a verified local business whose goal matters to you. Donations ask for nothing in return.",
} as const;

export type DiscoveryViewProps = {
  role: "investor" | "donor";
  name: string | null;
  summary: ReturnType<typeof summarizeContributions>;
  filters: DiscoveryFilters;
  items: PublicBusiness[];
  hasMore: boolean;
};

/** The investor and donor home: welcome, their numbers, search, and a grid of verified businesses. */
export function DiscoveryView({
  role,
  name,
  summary,
  filters,
  items,
  hasMore,
}: DiscoveryViewProps) {
  const mappable = items.flatMap((b) =>
    b.lat !== null && b.lng !== null ? [{ id: b.id, name: b.name, lat: b.lat, lng: b.lng }] : [],
  );
  const filtered = filters.query !== null || filters.category !== null || filters.near !== null;
  const first = firstName(name);

  return (
    <DashboardShell
      role={role}
      name={name}
      title={first ? `Welcome back, ${first}` : "Welcome back"}
      subtitle={copy[role]}
    >
      <section aria-label="Your contributions" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total contributed"
          value={formatRand(summary.contributedCents)}
          Icon={HandCoins}
        />
        <StatCard
          label="Businesses supported"
          value={summary.businessesSupported}
          Icon={Building2}
          tone="slate"
        />
        <StatCard
          label="Waiting for payment"
          value={formatRand(summary.waitingCents)}
          Icon={Clock}
          tone="amber"
          note={
            summary.waitingCount > 0 ? (
              <Link href="/contributions" className="underline">
                Finish {summary.waitingCount} checkout{summary.waitingCount === 1 ? "" : "s"}
              </Link>
            ) : (
              "Nothing waiting"
            )
          }
        />
      </section>

      <section aria-labelledby="discover-heading" className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="discover-heading" className="text-2xl font-bold text-gray-900">
            Discover local businesses
          </h2>
        </div>
        <DiscoveryFilterForm
          key={JSON.stringify([filters.query, filters.category, filters.near])}
          filters={filters}
        />

        <div className="mt-5">
          {mappable.length > 0 || filters.near ? (
            <DiscoveryMapPanel
              businesses={mappable}
              origin={filters.near ? { lat: filters.near.lat, lng: filters.near.lng } : null}
            />
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="card mt-6 border-dashed p-10 text-center text-gray-600">
            {filtered
              ? "No verified businesses match that search. Try a wider area or fewer filters."
              : "No businesses are verified yet. Check back soon."}
          </p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </ul>
        )}

        {(filters.page > 1 || hasMore) && (
          <nav aria-label="More results" className="mt-8 flex items-center justify-between">
            {filters.page > 1 ? (
              <Link href={discoveryHref(filters, filters.page - 1)} className="btn-secondary">
                Previous page
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-gray-500">Page {filters.page}</span>
            {hasMore ? (
              <Link href={discoveryHref(filters, filters.page + 1)} className="btn-secondary">
                Next page
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </DashboardShell>
  );
}

export async function DiscoveryScreen({ role, name, params }: Props) {
  const [{ filters, items, hasMore }, mine] = await Promise.all([
    discoverBusinesses({ discovery: createDiscoveryStore() }, params),
    createContributionStore().listMine(),
  ]);
  return (
    <DiscoveryView
      role={role}
      name={name}
      summary={summarizeContributions(mine)}
      filters={filters}
      items={items}
      hasMore={hasMore}
    />
  );
}
