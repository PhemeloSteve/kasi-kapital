import { z } from "zod";
import { isBusinessCategory } from "@/domain/business-categories";
import { toTrustTier } from "@/domain/documents";
import { err, ok } from "@/domain/result";
import type { VerificationStatus } from "@/domain/types";
import type { BusinessRecord, BusinessStore, GoalRecord } from "@/application/ports";
import { createClient } from "./server";

const verificationValues = ["unverified", "pending", "verified", "rejected", "suspended"] as const;

const businessRow = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().refine(isBusinessCategory),
  description: z.string().nullable(),
  suburb: z.string().nullable(),
  has_location: z.boolean(),
  youtube_url: z.string().nullable(),
  facebook_url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  verification: z.enum(verificationValues),
  trust_tier: z.number(),
});

const goalRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  target_cents: z.number(),
  kind: z.enum(["donation", "presale"]),
  is_open: z.boolean(),
  milestones: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      amount_cents: z.number(),
      status: z.enum(["pending", "proof_submitted", "approved", "rejected"]),
      position: z.number(),
      review_note: z.string().nullable(),
    }),
  ),
});

/** Supabase implementation of the BusinessStore port. Every call runs as the signed-in user. */
export function createBusinessStore(): BusinessStore {
  return {
    async getMyBusiness(userId) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("businesses")
        .select(
          "id, name, category, description, suburb, has_location, youtube_url, facebook_url, linkedin_url, verification, trust_tier",
        )
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) console.error("[business] load failed", { code: error.code });
      if (!data) return null;

      const row = businessRow.safeParse(data);
      if (!row.success) return null;
      const b = row.data;
      return {
        id: b.id,
        name: b.name,
        category: b.category as BusinessRecord["category"],
        description: b.description,
        suburb: b.suburb ?? "",
        hasLocation: b.has_location,
        youtubeUrl: b.youtube_url,
        facebookUrl: b.facebook_url,
        linkedinUrl: b.linkedin_url,
        verification: b.verification as VerificationStatus,
        trustTier: toTrustTier(b.trust_tier),
      };
    },

    async saveMyBusiness(data) {
      const supabase = await createClient();
      const { data: id, error } = await supabase.rpc("save_my_business", {
        p_name: data.name,
        p_category: data.category,
        p_description: data.description,
        p_suburb: data.suburb,
        p_lat: data.location?.lat ?? null,
        p_lng: data.location?.lng ?? null,
        p_youtube: data.youtubeUrl,
        p_facebook: data.facebookUrl,
        p_linkedin: data.linkedinUrl,
      });
      if (error || typeof id !== "string") {
        console.error("[business] save failed", { code: error?.code });
        return err("failed");
      }
      return ok({ id });
    },

    async createGoal(businessId, data) {
      const supabase = await createClient();
      const { data: id, error } = await supabase.rpc("create_funding_goal", {
        p_business_id: businessId,
        p_title: data.title,
        p_description: data.description,
        p_target_cents: data.targetCents,
        p_kind: data.kind,
        p_milestones: data.milestones.map((m) => ({ title: m.title, amount_cents: m.amountCents })),
      });
      if (error || typeof id !== "string") {
        console.error("[goal] create failed", { code: error?.code });
        return err("failed");
      }
      return ok({ id });
    },

    async listGoals(businessId) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("funding_goals")
        .select(
          "id, title, description, target_cents, kind, is_open, milestones(id, title, amount_cents, status, position, review_note)",
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) console.error("[goal] list failed", { code: error.code });

      const goals: GoalRecord[] = [];
      for (const raw of data ?? []) {
        const row = goalRow.safeParse(raw);
        if (!row.success) continue;
        const g = row.data;
        goals.push({
          id: g.id,
          title: g.title,
          description: g.description,
          targetCents: g.target_cents,
          kind: g.kind,
          isOpen: g.is_open,
          milestones: [...g.milestones]
            .sort((a, b) => a.position - b.position)
            .map((m) => ({
              id: m.id,
              title: m.title,
              amountCents: m.amount_cents,
              reviewNote: m.review_note,
              status: m.status,
            })),
        });
      }
      return goals;
    },
  };
}
