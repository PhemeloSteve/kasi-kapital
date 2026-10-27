import { z } from "zod";
import { err, ok } from "@/domain/result";
import type {
  ContributionRecord,
  ContributionStore,
  FundingReads,
  GoalFunding,
  MilestonePayout,
  StartContributionError,
} from "@/application/ports";
import { createClient } from "./server";

const contributionRow = z.object({
  id: z.string(),
  amount_cents: z.coerce.number(),
  status: z.enum(["pending", "held", "failed", "refunded", "released"]),
  created_at: z.string(),
  funding_goals: z
    .object({
      title: z.string(),
      businesses: z.object({ id: z.string(), name: z.string() }).nullable(),
    })
    .nullable(),
});

const SELECT = "id, amount_cents, status, created_at, funding_goals(title, businesses(id, name))";

function toRecord(raw: unknown): ContributionRecord | null {
  const parsed = contributionRow.safeParse(raw);
  if (!parsed.success) return null;
  const c = parsed.data;
  return {
    id: c.id,
    amountCents: c.amount_cents,
    status: c.status,
    createdAt: c.created_at,
    goalTitle: c.funding_goals?.title ?? null,
    businessId: c.funding_goals?.businesses?.id ?? null,
    businessName: c.funding_goals?.businesses?.name ?? null,
  };
}

/** Maps the database's custom error codes (see migration 0006) to something the app understands. */
function toStartError(error: { code?: string; details?: string | null }): StartContributionError {
  const remaining = Number(error.details ?? 0);
  const remainingCents = Number.isFinite(remaining) && remaining > 0 ? remaining : 0;
  switch (error.code) {
    case "42501":
      return { code: "not_allowed" };
    case "P0002":
      return { code: "goal_not_found" };
    case "KK003":
      return { code: "goal_closed" };
    case "KK004":
      return { code: "amount_out_of_range" };
    case "KK001":
      return { code: "goal_full", remainingCents };
    case "KK002":
      return { code: "limit_reached", remainingCents };
    default:
      return { code: "failed" };
  }
}

/** Supabase implementation of what a supporter does, always as themselves. */
export function createContributionStore(): ContributionStore {
  return {
    async start({ goalId, amountCents }) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("start_contribution", {
        p_goal_id: goalId,
        p_amount_cents: amountCents,
      });
      if (error) {
        console.error("[contribution] start failed", { code: error.code });
        return err(toStartError(error));
      }
      return typeof data === "string" ? ok({ id: data }) : err({ code: "failed" as const });
    },

    async getMine(contributionId) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("contributions")
        .select(SELECT)
        .eq("id", contributionId)
        .maybeSingle();
      return data ? toRecord(data) : null;
    },

    async listMine() {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("contributions")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) console.error("[contribution] list failed", { code: error.code });
      return (data ?? []).flatMap((row) => toRecord(row) ?? []);
    },
  };
}

const fundingRow = z.object({
  goal_id: z.string(),
  raised_cents: z.coerce.number(),
  paid_out_cents: z.coerce.number(),
  supporter_count: z.coerce.number(),
});
const payoutRow = z.object({
  milestone_id: z.string(),
  amount_cents: z.coerce.number(),
  status: z.enum(["pending", "paid", "failed"]),
});

/** Safe totals for anyone allowed to see a business. The database decides who that is. */
export function createFundingReads(): FundingReads {
  return {
    async goalFunding(businessId) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("goal_funding", { p_business_id: businessId });
      if (error) console.error("[funding] totals failed", { code: error.code });
      return (Array.isArray(data) ? data : []).flatMap((row): GoalFunding[] => {
        const r = fundingRow.safeParse(row);
        return r.success
          ? [
              {
                goalId: r.data.goal_id,
                raisedCents: r.data.raised_cents,
                paidOutCents: r.data.paid_out_cents,
                supporterCount: r.data.supporter_count,
              },
            ]
          : [];
      });
    },

    async milestonePayouts(businessId) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("milestone_payouts", {
        p_business_id: businessId,
      });
      if (error) console.error("[funding] payouts failed", { code: error.code });
      return (Array.isArray(data) ? data : []).flatMap((row): MilestonePayout[] => {
        const r = payoutRow.safeParse(row);
        return r.success
          ? [
              {
                milestoneId: r.data.milestone_id,
                amountCents: r.data.amount_cents,
                status: r.data.status,
              },
            ]
          : [];
      });
    },
  };
}
