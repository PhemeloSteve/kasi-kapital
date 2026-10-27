import { describe, expect, it } from "vitest";
import { formatRand } from "./money";

describe("formatRand", () => {
  it("formats whole and fractional rand with space separators", () => {
    expect(formatRand(0)).toBe("R0");
    expect(formatRand(5000)).toBe("R50");
    expect(formatRand(150000)).toBe("R1\u00a0500");
    expect(formatRand(150050)).toBe("R1\u00a0500,50");
    expect(formatRand(100000000)).toBe("R1\u00a0000\u00a0000");
    expect(formatRand(1005)).toBe("R10,05");
  });
});
