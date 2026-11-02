import { describe, expect, it } from "vitest";
import { milestoneLabel, milestoneTone } from "./milestone-labels";

describe("milestoneLabel", () => {
  it.each([
    [{ status: "approved", funded: "funded", payout: "paid" }, "Paid out"],
    [{ status: "approved", funded: "funded", payout: "pending" }, "Being paid out"],
    [{ status: "approved", funded: "partial", payout: null }, "Approved, waiting for funds"],
    [{ status: "proof_submitted", funded: "funded", payout: null }, "Proof sent, awaiting review"],
    [{ status: "rejected", funded: "funded", payout: null }, "Needs attention"],
    [{ status: "pending", funded: "funded", payout: null }, "Funded, waiting for proof"],
    [{ status: "pending", funded: "partial", payout: null }, "Partly funded"],
    [{ status: "pending", funded: "unfunded", payout: null }, "Waiting for funds"],
    [{ status: "pending", funded: null, payout: null }, "Not started"],
  ] as const)("describes %j as %s", (input, label) => {
    expect(milestoneLabel(input)).toBe(label);
  });
});

describe("milestoneTone", () => {
  it.each([
    [{ status: "approved", funded: "funded", payout: "paid" }, "success"],
    [{ status: "approved", funded: "funded", payout: "pending" }, "waiting"],
    [{ status: "approved", funded: "partial", payout: null }, "waiting"],
    [{ status: "proof_submitted", funded: "funded", payout: null }, "waiting"],
    [{ status: "rejected", funded: "funded", payout: null }, "attention"],
    [{ status: "pending", funded: "funded", payout: null }, "action"],
    [{ status: "pending", funded: "partial", payout: null }, "locked"],
    [{ status: "pending", funded: "unfunded", payout: null }, "locked"],
    [{ status: "pending", funded: null, payout: null }, "locked"],
  ] as const)("treats %j as %s", (input, tone) => {
    expect(milestoneTone(input)).toBe(tone);
  });
});
