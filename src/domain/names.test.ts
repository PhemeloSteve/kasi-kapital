import { describe, expect, it } from "vitest";
import { firstName } from "./names";

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("Phemelo Mokwena")).toBe("Phemelo");
    expect(firstName("  Thandi   ")).toBe("Thandi");
  });
  it("returns null when there is nothing to use", () => {
    expect(firstName(null)).toBeNull();
    expect(firstName(undefined)).toBeNull();
    expect(firstName("   ")).toBeNull();
  });
});
