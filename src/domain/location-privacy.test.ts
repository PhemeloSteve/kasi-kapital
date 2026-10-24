import { describe, expect, it } from "vitest";
import { coarsenLocation } from "./location-privacy";

describe("coarsenLocation", () => {
  it("rounds to roughly 1 km by default", () => {
    expect(coarsenLocation({ lat: -33.918861, lng: 18.4233 })).toEqual({ lat: -33.92, lng: 18.42 });
  });

  it("throws on invalid coordinates", () => {
    expect(() => coarsenLocation({ lat: 91, lng: 0 })).toThrow(RangeError);
    expect(() => coarsenLocation({ lat: 0, lng: Number.NaN })).toThrow(RangeError);
  });
});
