import { z } from "zod";
import { isBusinessCategory } from "@/domain/business-categories";
import { coarsenLocation } from "@/domain/location-privacy";
import { err, ok, type Result } from "@/domain/result";
import type { DiscoveryFilters, DiscoveryStore, PublicBusiness } from "./ports";

export const PAGE_SIZE = 12;
export const MAX_PAGE = 50;
export const radiusOptions = [10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 50;

// Next.js hands over a string, a list of strings, or nothing.
const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

function toNumber(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Turns the page's URL parameters into search filters. Anything odd (a made-up category, a letter
 * where a number should be, half a location) is quietly ignored, so a bad link never breaks the page.
 */
export function parseDiscoveryParams(raw: Record<string, unknown>): DiscoveryFilters {
  const q = first(raw.q);
  const query = typeof q === "string" && q.trim() !== "" ? q.trim().slice(0, 80) : null;

  const c = first(raw.category);
  const category = isBusinessCategory(c) ? c : null;

  const lat = toNumber(first(raw.lat));
  const lng = toNumber(first(raw.lng));
  const radius = toNumber(first(raw.radius));
  const radiusKm = radiusOptions.find((option) => option === radius) ?? DEFAULT_RADIUS_KM;

  let near: DiscoveryFilters["near"] = null;
  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    // Only an approximate position is ever passed on.
    near = { ...coarsenLocation({ lat, lng }), radiusKm };
  }

  const p = toNumber(first(raw.page));
  const page = p !== null && Number.isInteger(p) && p >= 1 && p <= MAX_PAGE ? p : 1;

  return { query, category, near, page };
}

export async function discoverBusinesses(
  deps: { discovery: DiscoveryStore },
  rawParams: Record<string, unknown>,
) {
  const filters = parseDiscoveryParams(rawParams);
  const { items, hasMore } = await deps.discovery.search(filters);
  return { filters, items, hasMore };
}

export async function getPublicBusiness(
  deps: { discovery: DiscoveryStore },
  rawId: unknown,
): Promise<Result<PublicBusiness, "not_found">> {
  const id = z.uuid().safeParse(rawId);
  if (!id.success) return err("not_found");
  const business = await deps.discovery.getBusiness(id.data);
  return business ? ok(business) : err("not_found");
}
