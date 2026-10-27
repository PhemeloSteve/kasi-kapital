import { z } from "zod";
import { err, ok } from "@/domain/result";
import type { PaymentServer } from "@/application/ports";
import { createServiceClient } from "./service";

const confirmation = z.object({ status: z.string() });
const pendingRow = z.object({ id: z.string(), amount_cents: z.coerce.number() });

/** Supabase implementation of the PaymentServer port. Uses the service role: server only. */
export function createPaymentServer(): PaymentServer {
  return {
    async confirmContribution({ contributionId, reference }) {
      const supabase = createServiceClient();
      const { data, error } = await supabase.rpc("confirm_contribution", {
        p_id: contributionId,
        p_reference: reference,
      });
      if (error) {
        console.error("[payments] confirm failed", { code: error.code });
        return err(error.code === "P0002" ? "not_found" : "failed");
      }
      const parsed = confirmation.safeParse(data);
      if (!parsed.success) return err("failed");
      if (parsed.data.status === "held") return ok("held" as const);
      return ok(parsed.data.status === "expired" ? ("expired" as const) : ("not_pending" as const));
    },

    async listPendingPayouts() {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("payouts")
        .select("id, amount_cents")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) console.error("[payments] list payouts failed", { code: error.code });
      return (data ?? []).flatMap((row) => {
        const parsed = pendingRow.safeParse(row);
        return parsed.success
          ? [{ id: parsed.data.id, amountCents: parsed.data.amount_cents }]
          : [];
      });
    },

    async markPayoutPaid(payoutId, reference) {
      const supabase = createServiceClient();
      const { data, error } = await supabase.rpc("mark_payout_paid", {
        p_payout_id: payoutId,
        p_reference: reference,
      });
      if (error) console.error("[payments] mark paid failed", { code: error.code });
      return data === true;
    },

    async noteFailure(payoutId, reason) {
      const supabase = createServiceClient();
      const { error } = await supabase.rpc("note_payout_failure", {
        p_payout_id: payoutId,
        p_reason: reason,
      });
      if (error) console.error("[payments] note failure failed", { code: error.code });
    },

    async setKycStatus(userId, status) {
      const supabase = createServiceClient();
      const { error } = await supabase.rpc("set_kyc_status", {
        p_user_id: userId,
        p_status: status,
      });
      if (error) {
        console.error("[payments] kyc failed", { code: error.code });
        return err("failed");
      }
      return ok(true as const);
    },
  };
}
