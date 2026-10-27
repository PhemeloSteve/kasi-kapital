import { describe, expect, it } from "vitest";
import { discoveryHref } from "./discovery-links";

describe("discoveryHref", () => {
  it("keeps every filter when paging", () => {
    const filters = {
      query: "bread & butter",
      category: "bakery" as const,
      near: { lat: -26.27, lng: 27.86, radiusKm: 25 },
      page: 2,
    };
    const params = new URLSearchParams(discoveryHref(filters, 3));
    expect(params.get("q")).toBe("bread & butter");
    expect(params.get("category")).toBe("bakery");
    expect(params.get("lat")).toBe("-26.27");
    expect(params.get("radius")).toBe("25");
    expect(params.get("page")).toBe("3");
  });
  it("leaves out page 1 and empty filters", () => {
    expect(discoveryHref({ query: null, category: null, near: null, page: 1 }, 1)).toBe("?");
  });
  it("escapes what people typed", () => {
    expect(discoveryHref({ query: "a&page=9", category: null, near: null, page: 1 }, 1)).toBe(
      "?q=a%26page%3D9",
    );
  });
});
