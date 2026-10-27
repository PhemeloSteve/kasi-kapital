import { describe, expect, it } from "vitest";
import { checkMilestones, MAX_GOAL_CENTS, MIN_GOAL_CENTS, parseRandToCents } from "./funding-goal";

describe("parseRandToCents", () => {
  it.each([
    ["1500", 150000],
    ["R 1 500", 150000],
    ["r1500", 150000],
    ["1500.50", 150050],
    ["1500,5", 150050],
    ["0.99", 99],
    ["  250  ", 25000],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parseRandToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "1,500", "1.234", "-5", "1e3", "12.", ".5", "1234567890"])(
    "rejects %j",
    (input) => {
      expect(parseRandToCents(input)).toBeNull();
    },
  );
});

describe("checkMilestones", () => {
  it("accepts milestones that add up exactly to the target", () => {
    expect(checkMilestones(100_000, [40_000, 60_000])).toEqual({ ok: true, value: true });
  });

  it("reports how far off the total is", () => {
    expect(checkMilestones(100_000, [40_000, 50_000])).toEqual({
      ok: false,
      error: { code: "sum_mismatch", differenceCents: 10_000 },
    });
    expect(checkMilestones(100_000, [70_000, 50_000])).toEqual({
      ok: false,
      error: { code: "sum_mismatch", differenceCents: -20_000 },
    });
  });

  it("enforces count, amount and target limits", () => {
    expect(checkMilestones(100_000, [])).toEqual({ ok: false, error: { code: "no_milestones" } });
    expect(checkMilestones(600_000, Array(7).fill(100_000 / 7))).toMatchObject({ ok: false });
    expect(checkMilestones(100_000, [100_000, 0])).toEqual({
      ok: false,
      error: { code: "invalid_amount" },
    });
    expect(checkMilestones(100_000, [150_000, -50_000])).toEqual({
      ok: false,
      error: { code: "invalid_amount" },
    });
    expect(checkMilestones(MIN_GOAL_CENTS - 1, [MIN_GOAL_CENTS - 1])).toEqual({
      ok: false,
      error: { code: "target_out_of_range" },
    });
    expect(checkMilestones(MAX_GOAL_CENTS + 1, [MAX_GOAL_CENTS + 1])).toEqual({
      ok: false,
      error: { code: "target_out_of_range" },
    });
    expect(checkMilestones(100_000, [33_333.5, 66_666.5])).toEqual({
      ok: false,
      error: { code: "invalid_amount" },
    });
  });

  it("accepts the maximum of six milestones", () => {
    expect(checkMilestones(60_000, Array(6).fill(10_000))).toEqual({ ok: true, value: true });
  });
});
