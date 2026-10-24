import { z } from "zod";
import { checkContribution, type ContributionRejection } from "@/domain/contribution-rules";
import { err, ok, type Result } from "@/domain/result";
import type { ContributionStore, PaymentGateway } from "./ports";

// Equity and revenue-share are intentionally excluded until a licensed partner is in place.
export const contributeInput = z.object({
  goalId: z.string().uuid(),
  contributorId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_000),
  kind: z.enum(["donation", "presale"]),
});

export type ContributeInput = z.infer<typeof contributeInput>;
export type ContributeError = ContributionRejection | "invalid_input" | "not_found";

export type ContributeDeps = {
  store: ContributionStore;
  payments: PaymentGateway;
  unverifiedLimitCents: number;
};

export async function contribute(
  deps: ContributeDeps,
  rawInput: unknown,
): Promise<Result<{ contributionId: string; checkoutUrl: string }, ContributeError>> {
  const parsed = contributeInput.safeParse(rawInput);
  if (!parsed.success) return err("invalid_input");
  const input = parsed.data;

  const [contributor, goal] = await Promise.all([
    deps.store.getContributor(input.contributorId),
    deps.store.getGoal(input.goalId),
  ]);
  if (!contributor || !goal) return err("not_found");

  const check = checkContribution({
    kycStatus: contributor.kycStatus,
    amountCents: input.amountCents,
    unverifiedLimitCents: deps.unverifiedLimitCents,
    goalOpen: goal.isOpen,
    businessVerified: goal.businessVerified,
  });
  if (!check.ok) return err(check.error);

  const saved = await deps.store.saveContribution(input);
  const checkout = await deps.payments.createCheckout({
    contributionId: saved.id,
    amountCents: input.amountCents,
  });
  return ok({ contributionId: saved.id, checkoutUrl: checkout.checkoutUrl });
}
