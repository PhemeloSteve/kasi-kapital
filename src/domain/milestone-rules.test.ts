import { describe, expect, it } from "vitest";
import { canReleaseMilestone } from "./milestone-rules";

describe("canReleaseMilestone", () => {
  it("only releases funds once proof is approved", () => {
    expect(canReleaseMilestone("approved")).toBe(true);
    expect(canReleaseMilestone("pending")).toBe(false);
    expect(canReleaseMilestone("proof_submitted")).toBe(false);
    expect(canReleaseMilestone("rejected")).toBe(false);
  });
});
