import { describe, expect, it, vi } from "vitest";
import { discoverBusinesses, getPublicBusiness, parseDiscoveryParams } from "./discovery";
import type { DiscoveryStore, PublicBusiness } from "./ports";

const business: PublicBusiness = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Mama T Bakery",
  category: "bakery",
  description: null,
  suburb: "Soweto",
  trustTier: 2,
  lat: -26.27,
  lng: 27.86,
  youtubeUrl: null,
  facebookUrl: null,
  linkedinUrl: null,
  openGoalCount: 1,
  openGoalTargetCents: 500000,
  distanceKm: null,
  featuredGoal: null,
};

function makeStore(overrides: Partial<DiscoveryStore> = {}): DiscoveryStore {
  return {
    search: async () => ({ items: [business], hasMore: false }),
    getBusiness: async () => business,
    ...overrides,
  };
}

describe("parseDiscoveryParams", () => {
  it("returns plain defaults for an empty page", () => {
    expect(parseDiscoveryParams({})).toEqual({ query: null, category: null, near: null, page: 1 });
  });

  it("reads a normal search", () => {
    expect(parseDiscoveryParams({ q: "  bread ", category: "bakery", page: "3" })).toEqual({
      query: "bread",
      category: "bakery",
      near: null,
      page: 3,
    });
  });

  it("takes only the first value when a parameter is repeated", () => {
    expect(
      parseDiscoveryParams({ q: ["first", "second"], category: ["welding", "bakery"] }),
    ).toMatchObject({ query: "first", category: "welding" });
  });

  it("only passes on an approximate position", () => {
    expect(
      parseDiscoveryParams({ lat: "-26.2678912", lng: "27.8584321", radius: "25" }).near,
    ).toEqual({ lat: -26.27, lng: 27.86, radiusKm: 25 });
  });

  it("falls back to the default radius for values that are not on offer", () => {
    expect(parseDiscoveryParams({ lat: "-26", lng: "28", radius: "9999" }).near?.radiusKm).toBe(50);
    expect(parseDiscoveryParams({ lat: "-26", lng: "28", radius: "abc" }).near?.radiusKm).toBe(50);
  });

  it.each([
    ["half a location", { lat: "-26" }],
    ["a latitude out of range", { lat: "95", lng: "28" }],
    ["a longitude out of range", { lat: "-26", lng: "200" }],
    ["text instead of numbers", { lat: "north", lng: "east" }],
    ["empty strings", { lat: "", lng: "" }],
  ])("ignores %s", (_label, raw) => {
    expect(parseDiscoveryParams(raw).near).toBeNull();
  });

  it.each([
    ["an unknown category", { category: "casino" }],
    ["an object where text belongs", { q: { $ne: "" }, category: { x: 1 } }],
  ])("ignores %s", (_label, raw) => {
    const filters = parseDiscoveryParams(raw);
    expect(filters.category).toBeNull();
    expect(filters.query).toBeNull();
  });

  it.each(["0", "-1", "51", "2.5", "abc", ""])("treats page %j as page 1", (page) => {
    expect(parseDiscoveryParams({ page }).page).toBe(1);
  });

  it("shortens an over-long search", () => {
    expect(parseDiscoveryParams({ q: "x".repeat(500) }).query).toHaveLength(80);
  });
});

describe("discoverBusinesses", () => {
  it("asks the store using the cleaned-up filters and returns the results", async () => {
    const search = vi.fn(async () => ({ items: [business], hasMore: true }));
    const result = await discoverBusinesses(
      { discovery: makeStore({ search }) },
      { q: "bread", lat: "-26.2678", lng: "27.8584" },
    );
    expect(search).toHaveBeenCalledWith({
      query: "bread",
      category: null,
      near: { lat: -26.27, lng: 27.86, radiusKm: 50 },
      page: 1,
    });
    expect(result).toMatchObject({ items: [business], hasMore: true });
  });
});

describe("getPublicBusiness", () => {
  it("returns a business that exists", async () => {
    expect(await getPublicBusiness({ discovery: makeStore() }, business.id)).toEqual({
      ok: true,
      value: business,
    });
  });
  it("treats a malformed id as not found without asking the store", async () => {
    const getBusiness = vi.fn();
    expect(await getPublicBusiness({ discovery: makeStore({ getBusiness }) }, "../../etc")).toEqual(
      { ok: false, error: "not_found" },
    );
    expect(getBusiness).not.toHaveBeenCalled();
  });
  it("reports a business the store cannot find (for example one that is not verified)", async () => {
    expect(
      await getPublicBusiness(
        { discovery: makeStore({ getBusiness: async () => null }) },
        business.id,
      ),
    ).toEqual({ ok: false, error: "not_found" });
  });
});
