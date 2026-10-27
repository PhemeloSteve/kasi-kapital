import type { DiscoveryFilters } from "@/application/ports";

/** A relative link ("?q=bread&page=2") to the same page with the given filters, for paging. */
export function discoveryHref(filters: DiscoveryFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.near) {
    params.set("lat", String(filters.near.lat));
    params.set("lng", String(filters.near.lng));
    params.set("radius", String(filters.near.radiusKm));
  }
  if (page > 1) params.set("page", String(page));
  return `?${params.toString()}`;
}
