import { describe, expect, it } from "vitest";
import { describeStartError } from "./messages";

describe("describeStartError", () => {
  it("says how much room a nearly full goal has left", () => {
    expect(describeStartError({ code: "goal_full", remainingCents: 12_350 }).message).toContain(
      "R123,50",
    );
    expect(describeStartError({ code: "goal_full", remainingCents: 0 }).message).toBe(
      "This goal is fully funded.",
    );
  });
  it("points unverified supporters towards verification, with what they can still give", () => {
    const withRoom = describeStartError({ code: "limit_reached", remainingCents: 30_000 });
    expect(withRoom.needsVerification).toBe(true);
    expect(withRoom.message).toContain("R300");
    expect(describeStartError({ code: "limit_reached", remainingCents: 0 }).message).toContain(
      "limit",
    );
  });
  it("does not suggest verification for other problems", () => {
    for (const code of [
      "amount_out_of_range",
      "goal_closed",
      "goal_not_found",
      "not_allowed",
      "too_many_pending",
      "failed",
      "invalid_input",
    ] as const) {
      expect(describeStartError({ code })).toMatchObject({ needsVerification: false });
      expect(describeStartError({ code }).message.length).toBeGreaterThan(5);
    }
  });
});
