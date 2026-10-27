import { z } from "zod";
import { err, ok } from "@/domain/result";
import type { MilestoneStore, PendingPayoutDetail, ProofQueueItem } from "@/application/ports";
import { createClient } from "./server";

const queueRow = z.object({
  id: z.string(),
  title: z.string(),
  amount_cents: z.coerce.number(),
  proof_document_id: z.string().nullable(),
  funding_goals: z
    .object({ title: z.string(), businesses: z.object({ name: z.string() }).nullable() })
    .nullable(),
});

const payoutRow = z.object({
  id: z.string(),
  amount_cents: z.coerce.number(),
  failure_reason: z.string().nullable(),
  milestones: z.object({ title: z.string() }).nullable(),
  funding_goals: z.object({ businesses: z.object({ name: z.string() }).nullable() }).nullable(),
});

const reviewResult = z.object({ payout_created: z.boolean() });

/** Supabase implementation of the MilestoneStore port. Every call runs as the signed-in user. */
export function createMilestoneStore(): MilestoneStore {
  return {
    async submitProof({ milestoneId, documentId }) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("submit_milestone_proof", {
        p_milestone_id: milestoneId,
        p_document_id: documentId,
      });
      if (error) {
        console.error("[milestone] proof failed", { code: error.code });
        if (error.code === "23514") return err("invalid_proof");
        return err(error.code === "42501" || error.code === "P0002" ? "not_allowed" : "failed");
      }
      return ok(true as const);
    },

    async listProofQueue() {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("milestones")
        .select(
          "id, title, amount_cents, proof_document_id, funding_goals(title, businesses(name))",
        )
        .eq("status", "proof_submitted")
        .order("created_at", { ascending: true });
      if (error) console.error("[milestone] queue failed", { code: error.code });

      return (data ?? []).flatMap((raw): ProofQueueItem[] => {
        const r = queueRow.safeParse(raw);
        if (!r.success) return [];
        const m = r.data;
        return [
          {
            milestoneId: m.id,
            milestoneTitle: m.title,
            amountCents: m.amount_cents,
            proofDocumentId: m.proof_document_id,
            goalTitle: m.funding_goals?.title ?? null,
            businessName: m.funding_goals?.businesses?.name ?? null,
          },
        ];
      });
    },

    async review({ milestoneId, approve, note }) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("review_milestone", {
        p_milestone_id: milestoneId,
        p_approve: approve,
        p_note: note,
      });
      if (error) {
        console.error("[milestone] review failed", { code: error.code });
        if (error.code === "22023") return err("note_required");
        return err(error.code === "P0001" ? "not_waiting" : "failed");
      }
      const parsed = reviewResult.safeParse(data);
      return parsed.success ? ok({ payoutCreated: parsed.data.payout_created }) : err("failed");
    },

    async listPendingPayouts() {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("payouts")
        .select(
          "id, amount_cents, failure_reason, milestones(title), funding_goals(businesses(name))",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) console.error("[milestone] payouts failed", { code: error.code });

      return (data ?? []).flatMap((raw): PendingPayoutDetail[] => {
        const r = payoutRow.safeParse(raw);
        if (!r.success) return [];
        const p = r.data;
        return [
          {
            id: p.id,
            amountCents: p.amount_cents,
            failureReason: p.failure_reason,
            milestoneTitle: p.milestones?.title ?? null,
            businessName: p.funding_goals?.businesses?.name ?? null,
          },
        ];
      });
    },
  };
}
