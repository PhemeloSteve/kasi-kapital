import { describe, expect, it } from "vitest";
import { milestoneLabel } from "./milestone-labels";

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
