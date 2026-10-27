import { describe, expect, it } from "vitest";
import { describeGeolocationFailure } from "./geolocation-messages";

describe("describeGeolocationFailure", () => {
  it("explains an insecure page first, whatever the error code", () => {
    expect(describeGeolocationFailure(1, false)).toContain("localhost");
  });

  it.each([
    [1, "blocked"],
    [2, "desktop"],
    [3, "too long"],
    [null, "map"],
    [99, "map"],
  ])("gives a specific message for code %s", (code, fragment) => {
    expect(describeGeolocationFailure(code, true)).toContain(fragment);
  });

  it("always points the person to the map as a way forward", () => {
    for (const code of [1, 2, 3, null]) {
      expect(describeGeolocationFailure(code, true)).toMatch(/map/);
    }
  });
});
