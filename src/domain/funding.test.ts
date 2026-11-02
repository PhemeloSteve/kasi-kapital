import { describe, expect, it } from "vitest";
import { allocateFunding, progressPercent, summarizeContributions } from "./funding";

const milestones = [
  { id: "a", amountCents: 300_000 },
  { id: "b", amountCents: 200_000 },
];

describe("allocateFunding", () => {
  it("fills milestones in order", () => {
    expect(allocateFunding(350_000, milestones)).toEqual([
      { id: "a", fundedCents: 300_000, state: "funded" },
      { id: "b", fundedCents: 50_000, state: "partial" },
    ]);
  });
  it("handles nothing raised, exactly enough, and more than enough", () => {
    expect(allocateFunding(0, milestones).map((m) => m.state)).toEqual(["unfunded", "unfunded"]);
    expect(allocateFunding(500_000, milestones).map((m) => m.state)).toEqual(["funded", "funded"]);
    expect(allocateFunding(900_000, milestones).map((m) => m.fundedCents)).toEqual([
      300_000, 200_000,
    ]);
  });
  it("never goes negative", () => {
    expect(allocateFunding(-5, milestones).every((m) => m.fundedCents === 0)).toBe(true);
  });
  it("copes with no milestones", () => {
    expect(allocateFunding(100, [])).toEqual([]);
  });
});

describe("progressPercent", () => {
  it.each([
    [0, 500, 0],
    [250, 500, 50],
    [499, 500, 99],
    [500, 500, 100],
    [900, 500, 100],
    [100, 0, 0],
    [-10, 500, 0],
  ])("%i of %i is %i%%", (raised, target, expected) => {
    expect(progressPercent(raised, target)).toBe(expected);
  });
});

describe("summarizeContributions", () => {
  it("counts only held money as contributed and counts each business once", () => {
    expect(
      summarizeContributions([
        { amountCents: 10_000, status: "held", businessId: "a" },
        { amountCents: 5_000, status: "held", businessId: "a" },
        { amountCents: 20_000, status: "held", businessId: "b" },
        { amountCents: 7_000, status: "pending", businessId: "c" },
        { amountCents: 9_000, status: "failed", businessId: "d" },
        { amountCents: 1_000, status: "refunded", businessId: "e" },
      ]),
    ).toEqual({
      contributedCents: 35_000,
      businessesSupported: 2,
      waitingCents: 7_000,
      waitingCount: 1,
    });
  });
  it("is all zeros for someone who has not given yet", () => {
    expect(summarizeContributions([])).toEqual({
      contributedCents: 0,
      businessesSupported: 0,
      waitingCents: 0,
      waitingCount: 0,
    });
  });
});
