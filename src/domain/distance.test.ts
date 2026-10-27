import { describe, expect, it } from "vitest";
import { formatDistance } from "./distance";

describe("formatDistance", () => {
  it.each([
    [0, "Less than 1 km away"],
    [0.4, "Less than 1 km away"],
    [3.44, "3.4 km away"],
    [9.96, "10.0 km away"],
    [10, "10 km away"],
    [27.4, "27 km away"],
    [1234.5, "1235 km away"],
  ])("formats %s km", (km, text) => {
    expect(formatDistance(km)).toBe(text);
  });
  it("returns nothing for impossible values", () => {
    expect(formatDistance(-1)).toBe("");
    expect(formatDistance(Number.NaN)).toBe("");
  });
});
