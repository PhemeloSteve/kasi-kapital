import Link from "next/link";
import { discoverBusinesses } from "@/application/discovery";
import { discoveryHref } from "@/app/_lib/discovery-links";
import { createDiscoveryStore } from "@/infrastructure/supabase/discovery-store";
import { BusinessCard } from "./BusinessCard";
import { DashboardShell } from "./DashboardShell";
import { DiscoveryFilterForm } from "./DiscoveryFilterForm";
import { DiscoveryMapLoader } from "./DiscoveryMapLoader";

type Props = {
  title: string;
  roleLabel: string;
  name: string | null;
  intro: string;
  params: Record<string, unknown>;
};

/** Shared by the investor and donor pages: search form, results, map and paging. */
export async function DiscoveryScreen({ title, roleLabel, name, intro, params }: Props) {
  const { filters, items, hasMore } = await discoverBusinesses(
    { discovery: createDiscoveryStore() },
    params,
  );
  const mappable = items.flatMap((b) =>
    b.lat !== null && b.lng !== null ? [{ id: b.id, name: b.name, lat: b.lat, lng: b.lng }] : [],
  );
  const filtered = filters.query !== null || filters.category !== null || filters.near !== null;

  return (
    <DashboardShell title={title} roleLabel={roleLabel} name={name}>
      <p className="mb-4 text-sm text-slate-600">
        {intro}{" "}
        <Link href="/contributions" className="text-brand underline">
          My contributions
        </Link>
      </p>
      <DiscoveryFilterForm
        key={JSON.stringify([filters.query, filters.category, filters.near])}
        filters={filters}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section aria-label="Results">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
              {filtered
                ? "No verified businesses match that search. Try a wider area or fewer filters."
                : "No businesses are verified yet. Check back soon."}
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </ul>
          )}

          {(filters.page > 1 || hasMore) && (
            <nav
              aria-label="More results"
              className="mt-4 flex items-center justify-between text-sm"
            >
              {filters.page > 1 ? (
                <Link
                  href={discoveryHref(filters, filters.page - 1)}
                  className="text-brand underline"
                >
                  Previous page
                </Link>
              ) : (
                <span />
              )}
              <span className="text-slate-500">Page {filters.page}</span>
              {hasMore ? (
                <Link
                  href={discoveryHref(filters, filters.page + 1)}
                  className="text-brand underline"
                >
                  Next page
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>

        <section aria-label="Map of results" className="lg:sticky lg:top-4 lg:self-start">
          {mappable.length > 0 || filters.near ? (
            <>
              <DiscoveryMapLoader
                businesses={mappable}
                origin={filters.near ? { lat: filters.near.lat, lng: filters.near.lng } : null}
              />
              <p className="mt-1 text-xs text-slate-500">
                Markers show an approximate area, not an exact address.
              </p>
            </>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              None of these businesses have shared a map area yet. Their details are in the list.
            </p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
