import { describe, expect, it } from "vitest";
import { allocateFunding, progressPercent } from "./funding";

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
