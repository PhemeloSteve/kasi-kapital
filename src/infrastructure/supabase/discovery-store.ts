import { z } from "zod";
import { isBusinessCategory } from "@/domain/business-categories";
import { toTrustTier } from "@/domain/documents";
import type { DiscoveryStore, PublicBusiness } from "@/application/ports";
import { PAGE_SIZE } from "@/application/discovery";
import { createClient } from "./server";

const row = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().refine(isBusinessCategory),
  description: z.string().nullable(),
  suburb: z.string().nullable(),
  trust_tier: z.number(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  youtube_url: z.string().nullable(),
  facebook_url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  open_goal_count: z.coerce.number(),
  open_goal_target_cents: z.coerce.number(),
  distance_km: z.number().nullable(),
});

function toPublicBusiness(raw: unknown): PublicBusiness | null {
  const parsed = row.safeParse(raw);
  if (!parsed.success) return null;
  const b = parsed.data;
  return {
    id: b.id,
    name: b.name,
    category: b.category as PublicBusiness["category"],
    description: b.description,
    suburb: b.suburb,
    trustTier: toTrustTier(b.trust_tier),
    lat: b.lat,
    lng: b.lng,
    youtubeUrl: b.youtube_url,
    facebookUrl: b.facebook_url,
    linkedinUrl: b.linkedin_url,
    openGoalCount: b.open_goal_count,
    openGoalTargetCents: b.open_goal_target_cents,
    distanceKm: b.distance_km,
  };
}

/** Supabase implementation of the DiscoveryStore port. The database functions return public fields only. */
export function createDiscoveryStore(): DiscoveryStore {
  return {
    async search(filters) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("discover_businesses", {
        p_query: filters.query,
        p_category: filters.category,
        p_lat: filters.near?.lat ?? null,
        p_lng: filters.near?.lng ?? null,
        p_radius_km: filters.near?.radiusKm ?? 50,
        p_limit: PAGE_SIZE,
        p_offset: (filters.page - 1) * PAGE_SIZE,
      });
      if (error) console.error("[discovery] search failed", { code: error.code });

      const rows = Array.isArray(data) ? data : [];
      const items = rows.slice(0, PAGE_SIZE).flatMap((r) => toPublicBusiness(r) ?? []);
      // The database returns one row more than a page, so we know whether there is a next page.
      return { items, hasMore: rows.length > PAGE_SIZE };
    },

    async getBusiness(id) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("get_public_business", { p_id: id });
      if (error) console.error("[discovery] detail failed", { code: error.code });
      return Array.isArray(data) && data[0] ? toPublicBusiness(data[0]) : null;
    },
  };
}
