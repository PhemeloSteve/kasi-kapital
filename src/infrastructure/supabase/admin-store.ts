import { z } from "zod";
import { err, ok } from "@/domain/result";
import { isUserRole } from "@/domain/roles";
import type { TrustTier } from "@/domain/documents";
import type { VerificationStatus } from "@/domain/types";
import type {
  AdminBusinessRow,
  AdminDirectory,
  AdminUserRow,
  BusinessModeration,
} from "@/application/ports";
import { createClient } from "./server";

const verification = z.enum(["unverified", "pending", "verified", "rejected", "suspended"]);

const businessRow = z.object({
  id: z.string(),
  name: z.string(),
  verification,
  trust_tier: z.number().int().min(0).max(3),
  profiles: z.object({ full_name: z.string().nullable() }).nullable(),
  // an aggregate embed: [{ count: 3 }]
  funding_goals: z.array(z.object({ count: z.coerce.number() })),
});

const userRow = z.object({
  id: z.string(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string(),
  kyc_status: verification,
  contributed_cents: z.coerce.number(),
});

const statsRow = z.object({
  total_businesses: z.coerce.number(),
  verified_businesses: z.coerce.number(),
  pending_businesses: z.coerce.number(),
  open_goals: z.coerce.number(),
  held_cents: z.coerce.number(),
  paid_out_cents: z.coerce.number(),
});

/** Supabase implementation of the AdminDirectory port. Every call runs as the signed-in administrator. */
export function createAdminDirectory(): AdminDirectory {
  return {
    async listBusinesses() {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, verification, trust_tier, profiles(full_name), funding_goals(count)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) console.error("[admin] list businesses failed", { code: error.code });

      return (data ?? []).flatMap((raw): AdminBusinessRow[] => {
        const r = businessRow.safeParse(raw);
        if (!r.success) return [];
        return [
          {
            id: r.data.id,
            name: r.data.name,
            ownerName: r.data.profiles?.full_name ?? null,
            verification: r.data.verification satisfies VerificationStatus,
            trustTier: r.data.trust_tier as TrustTier,
            goalCount: r.data.funding_goals[0]?.count ?? 0,
          },
        ];
      });
    },

    async listUsers() {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) console.error("[admin] list users failed", { code: error.code });

      return ((data as unknown[] | null) ?? []).flatMap((raw): AdminUserRow[] => {
        const r = userRow.safeParse(raw);
        if (!r.success || !isUserRole(r.data.role)) return [];
        return [
          {
            id: r.data.id,
            fullName: r.data.full_name,
            email: r.data.email,
            role: r.data.role,
            kycStatus: r.data.kyc_status,
            contributedCents: r.data.contributed_cents,
          },
        ];
      });
    },

    async platformStats() {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("platform_stats");
      if (error) {
        console.error("[admin] stats failed", { code: error.code });
        return null;
      }
      const first = Array.isArray(data) ? data[0] : data;
      const r = statsRow.safeParse(first);
      if (!r.success) return null;
      return {
        totalBusinesses: r.data.total_businesses,
        verifiedBusinesses: r.data.verified_businesses,
        pendingBusinesses: r.data.pending_businesses,
        openGoals: r.data.open_goals,
        heldCents: r.data.held_cents,
        paidOutCents: r.data.paid_out_cents,
      };
    },
  };
}

/** Supabase implementation of the BusinessModeration port. The database re-checks the admin level. */
export function createBusinessModeration(): BusinessModeration {
  return {
    async suspend({ businessId, reason }) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("suspend_business", {
        p_id: businessId,
        p_reason: reason,
      });
      if (error) {
        console.error("[admin] suspend failed", { code: error.code });
        if (error.code === "42501") return err("not_allowed");
        if (error.code === "22023") return err("reason_required");
        return err(error.code === "P0002" ? "not_found" : "failed");
      }
      return ok(true as const);
    },

    async unsuspend(businessId) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("unsuspend_business", { p_id: businessId });
      if (error) {
        console.error("[admin] unsuspend failed", { code: error.code });
        if (error.code === "42501") return err("not_allowed");
        if (error.code === "22023") return err("not_suspended");
        return err(error.code === "P0002" ? "not_found" : "failed");
      }
      return ok(true as const);
    },
  };
}
