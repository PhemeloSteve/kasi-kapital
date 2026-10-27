import { err, ok, type Result } from "./result";

export const MIN_GOAL_CENTS = 10_000; // R100
export const MAX_GOAL_CENTS = 100_000_000; // R1 000 000
export const MAX_MILESTONES = 6;

/**
 * Turns what a person typed ("1500", "R 1 500", "1500.50", "1500,5") into cents.
 * Ambiguous input such as "1,500" is rejected rather than guessed.
 */
export function parseRandToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^r\s*/i, "").replace(/\s+/g, "");
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}

export type MilestoneProblem =
  | { code: "no_milestones" }
  | { code: "too_many_milestones" }
  | { code: "invalid_amount" }
  | { code: "target_out_of_range" }
  | { code: "sum_mismatch"; differenceCents: number };

/** A goal's milestones must be 1 to 6 positive amounts that add up exactly to the target. */
export function checkMilestones(
  targetCents: number,
  amounts: readonly number[],
): Result<true, MilestoneProblem> {
  if (
    !Number.isInteger(targetCents) ||
    targetCents < MIN_GOAL_CENTS ||
    targetCents > MAX_GOAL_CENTS
  ) {
    return err({ code: "target_out_of_range" });
  }
  if (amounts.length === 0) return err({ code: "no_milestones" });
  if (amounts.length > MAX_MILESTONES) return err({ code: "too_many_milestones" });
  if (amounts.some((a) => !Number.isInteger(a) || a <= 0)) return err({ code: "invalid_amount" });

  const total = amounts.reduce((sum, a) => sum + a, 0);
  // Positive difference = milestones are short of the target; negative = over it.
  if (total !== targetCents)
    return err({ code: "sum_mismatch", differenceCents: targetCents - total });
  return ok(true as const);
}
