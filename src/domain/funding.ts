// The database is the authority on these limits (see platform_settings); the copies here only give
// people friendly feedback before they go to checkout.
export const MIN_CONTRIBUTION_CENTS = 1_000; // R10
export const MAX_CONTRIBUTION_CENTS = 100_000_000; // R1 000 000

export type MilestoneFunding = {
  id: string;
  fundedCents: number;
  state: "unfunded" | "partial" | "funded";
};

/**
 * Shows how far the money raised stretches over the milestones, earliest first. This mirrors how
 * payouts are released: a later milestone is never paid before an earlier one.
 */
export function allocateFunding(
  raisedCents: number,
  milestones: ReadonlyArray<{ id: string; amountCents: number }>,
): MilestoneFunding[] {
  let remaining = Math.max(0, raisedCents);
  return milestones.map((m) => {
    const fundedCents = Math.min(remaining, m.amountCents);
    remaining -= fundedCents;
    const state =
      fundedCents >= m.amountCents ? "funded" : fundedCents > 0 ? "partial" : "unfunded";
    return { id: m.id, fundedCents, state };
  });
}

/** Whole-number percentage between 0 and 100. */
export function progressPercent(raisedCents: number, targetCents: number): number {
  if (targetCents <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((raisedCents / targetCents) * 100)));
}
