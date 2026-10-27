import { z } from "zod";
import { parseRandToCents } from "@/domain/funding-goal";
import { MAX_CONTRIBUTION_CENTS, MIN_CONTRIBUTION_CENTS } from "@/domain/funding";
import { err, ok, type Result } from "@/domain/result";
import type {
  ContributionStore,
  PaymentGateway,
  PaymentServer,
  StartContributionError,
} from "./ports";

// ---------- a supporter starts a contribution ----------
export type StartError = StartContributionError | { code: "invalid_input" };

/**
 * Checks what was typed, then asks the database to start the contribution. The database applies every rule
 * that protects money (limits, goal capacity, who may give), so this only gives quick, friendly feedback.
 */
export async function startContribution(
  deps: { contributions: ContributionStore; payments: PaymentGateway },
  raw: { goalId: unknown; amount: unknown },
): Promise<Result<{ checkoutUrl: string }, StartError>> {
  const goalId = z.uuid().safeParse(raw.goalId);
  if (!goalId.success) return err({ code: "invalid_input" });

  const amountCents = typeof raw.amount === "string" ? parseRandToCents(raw.amount) : null;
  if (
    amountCents === null ||
    amountCents < MIN_CONTRIBUTION_CENTS ||
    amountCents > MAX_CONTRIBUTION_CENTS
  ) {
    return err({ code: "amount_out_of_range" });
  }

  const started = await deps.contributions.start({ goalId: goalId.data, amountCents });
  if (!started.ok) return err(started.error);

  const checkout = await deps.payments.createCheckout({
    contributionId: started.value.id,
    amountCents,
  });
  return ok({ checkoutUrl: checkout.checkoutUrl });
}

// ---------- releasing money to founders ----------
/**
 * Pays every released-but-unpaid milestone through the payment provider and records the result.
 * Safe to run repeatedly: each payout carries its own id as an idempotency key, and a payout already
 * marked paid is never paid again. A failed attempt stays pending with a reason, to be retried.
 */
export async function processPayouts(deps: {
  gateway: PaymentGateway;
  server: PaymentServer;
}): Promise<{ paid: number; failed: number }> {
  let paid = 0;
  let failed = 0;
  for (const payout of await deps.server.listPendingPayouts()) {
    const result = await deps.gateway.payOut({
      payoutId: payout.id,
      amountCents: payout.amountCents,
    });
    if (result.ok) {
      if (await deps.server.markPayoutPaid(payout.id, result.value.reference)) paid += 1;
    } else {
      failed += 1;
      await deps.server.noteFailure(
        payout.id,
        "The payment provider could not complete this payout. It will be retried.",
      );
    }
  }
  return { paid, failed };
}

// ---------- the demo checkout ----------
export type DemoPaymentOutcome = "held" | "expired" | "not_pending";

/**
 * Stands in for the payment provider telling us "the money arrived". Only the demo checkout calls this;
 * a real provider would call a signed webhook instead. The contribution must be the signed-in person's own.
 */
export async function confirmDemoPayment(
  deps: { contributions: ContributionStore; server: PaymentServer; gateway: PaymentGateway },
  rawId: unknown,
): Promise<
  Result<
    { outcome: DemoPaymentOutcome; payouts: { paid: number; failed: number } },
    "invalid_input" | "not_found" | "failed"
  >
> {
  const id = z.uuid().safeParse(rawId);
  if (!id.success) return err("invalid_input");

  // Read as the signed-in user: someone else's contribution simply isn't found.
  const mine = await deps.contributions.getMine(id.data);
  if (!mine) return err("not_found");
  const noPayouts = { paid: 0, failed: 0 };
  if (mine.status === "held") return ok({ outcome: "held", payouts: noPayouts });
  if (mine.status !== "pending") return ok({ outcome: "not_pending", payouts: noPayouts });

  const confirmed = await deps.server.confirmContribution({
    contributionId: id.data,
    reference: `mock-pay-${id.data}`,
  });
  if (!confirmed.ok) return err(confirmed.error === "not_found" ? "not_found" : "failed");
  if (confirmed.value !== "held") return ok({ outcome: confirmed.value, payouts: noPayouts });

  // New money may have released a waiting milestone: pay it out now.
  return ok({
    outcome: "held",
    payouts: await processPayouts({ gateway: deps.gateway, server: deps.server }),
  });
}

// ---------- demo identity verification ----------
/** For demos only: lets a supporter mark themselves verified. Refuses unless explicitly enabled. */
export async function verifyIdentityDemo(
  deps: { server: PaymentServer; demoEnabled: boolean },
  userId: string,
): Promise<Result<true, "disabled" | "failed">> {
  if (!deps.demoEnabled) return err("disabled");
  const result = await deps.server.setKycStatus(userId, "verified");
  return result.ok ? ok(true as const) : err("failed");
}
