import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { createGoal, saveBusiness } from "./business";
import type { BusinessRecord, BusinessStore } from "./ports";

const record: BusinessRecord = {
  id: "b1",
  name: "Mama T Bakery",
  category: "bakery",
  description: null,
  suburb: "Soweto",
  hasLocation: false,
  youtubeUrl: null,
  facebookUrl: null,
  linkedinUrl: null,
  verification: "unverified",
  trustTier: 0,
};

function makeStore(overrides: Partial<BusinessStore> = {}): BusinessStore {
  return {
    getMyBusiness: async () => record,
    saveMyBusiness: async () => ok({ id: "b1" }),
    createGoal: async () => ok({ id: "g1" }),
    listGoals: async () => [],
    ...overrides,
  };
}

const validBusiness = {
  name: "  Mama T Bakery ",
  category: "bakery",
  description: "",
  suburb: "Soweto",
  lat: "-26.2678912",
  lng: "27.8584321",
  youtubeUrl: "",
  facebookUrl: "www.facebook.com/mamatbakery",
  linkedinUrl: "",
};

describe("saveBusiness", () => {
  it("trims input, normalises links and stores only an approximate location", async () => {
    const saveMyBusiness = vi.fn(async () => ok({ id: "b1" }));
    const result = await saveBusiness({ store: makeStore({ saveMyBusiness }) }, validBusiness);
    expect(result).toEqual({ ok: true, value: { id: "b1" } });
    expect(saveMyBusiness).toHaveBeenCalledWith({
      name: "Mama T Bakery",
      category: "bakery",
      description: null,
      suburb: "Soweto",
      location: { lat: -26.27, lng: 27.86 },
      youtubeUrl: null,
      facebookUrl: "https://www.facebook.com/mamatbakery",
      linkedinUrl: null,
    });
  });

  it("allows a business with no location", async () => {
    const saveMyBusiness = vi.fn(async () => ok({ id: "b1" }));
    await saveBusiness(
      { store: makeStore({ saveMyBusiness }) },
      { ...validBusiness, lat: "", lng: "" },
    );
    expect(saveMyBusiness).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
  });

  it.each([
    ["short name", { name: "x" }, "name"],
    ["unknown category", { category: "casino" }, "category"],
    ["missing suburb", { suburb: "" }, "suburb"],
    ["long description", { description: "x".repeat(601) }, "description"],
    ["wrong-site YouTube link", { youtubeUrl: "https://evil.example/yt" }, "youtubeUrl"],
    ["javascript link", { facebookUrl: "javascript:alert(1)" }, "facebookUrl"],
    ["out-of-range latitude", { lat: "95" }, "lat"],
    ["latitude without longitude", { lng: "" }, "lat"],
  ])("rejects %s without touching the store", async (_label, change, field) => {
    const saveMyBusiness = vi.fn();
    const result = await saveBusiness(
      { store: makeStore({ saveMyBusiness }) },
      { ...validBusiness, ...change },
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === "invalid_input")
      expect(Object.keys(result.error.fields)).toContain(field);
    expect(saveMyBusiness).not.toHaveBeenCalled();
  });

  it("reports a save failure", async () => {
    const store = makeStore({ saveMyBusiness: async () => err("failed" as const) });
    expect(await saveBusiness({ store }, validBusiness)).toEqual({
      ok: false,
      error: { code: "save_failed" },
    });
  });
});

const validGoal = {
  title: "Buy 50 chicks",
  description: "",
  target: "R 5 000",
  kind: "donation",
  milestones: [
    { title: "Chicks", amount: "3000" },
    { title: "Feed for 6 weeks", amount: "2000" },
  ],
};

describe("createGoal", () => {
  it("converts rand to cents and creates the goal on the user's own business", async () => {
    const getMyBusiness = vi.fn(async () => record);
    const createGoalSpy = vi.fn(async () => ok({ id: "g1" }));
    const result = await createGoal(
      { store: makeStore({ getMyBusiness, createGoal: createGoalSpy }) },
      "user-1",
      validGoal,
    );
    expect(result).toEqual({ ok: true, value: { id: "g1" } });
    expect(getMyBusiness).toHaveBeenCalledWith("user-1");
    expect(createGoalSpy).toHaveBeenCalledWith("b1", {
      title: "Buy 50 chicks",
      description: null,
      targetCents: 500_000,
      kind: "donation",
      milestones: [
        { title: "Chicks", amountCents: 300_000 },
        { title: "Feed for 6 weeks", amountCents: 200_000 },
      ],
    });
  });

  it("explains how far the milestones are from the target", async () => {
    const short = await createGoal({ store: makeStore() }, "u", {
      ...validGoal,
      milestones: [{ title: "Chicks", amount: "3000" }],
    });
    expect(short).toMatchObject({
      ok: false,
      error: {
        code: "invalid_input",
        fields: { milestones: expect.stringContaining("R2\u00a0000 short") },
      },
    });

    const over = await createGoal({ store: makeStore() }, "u", {
      ...validGoal,
      milestones: [{ title: "Chicks", amount: "6000" }],
    });
    expect(over).toMatchObject({
      ok: false,
      error: { fields: { milestones: expect.stringContaining("R1\u00a0000 over") } },
    });
  });

  it("refuses equity goals until a licensed partner exists", async () => {
    const createGoalSpy = vi.fn();
    const result = await createGoal({ store: makeStore({ createGoal: createGoalSpy }) }, "u", {
      ...validGoal,
      kind: "equity",
    });
    expect(result.ok).toBe(false);
    expect(createGoalSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["target below R100", { target: "50", milestones: [{ title: "Tiny", amount: "50" }] }],
    ["no milestones", { milestones: [] }],
    [
      "seven milestones",
      {
        target: "700",
        milestones: Array.from({ length: 7 }, (_, i) => ({ title: `Step ${i}`, amount: "100" })),
      },
    ],
    ["bad amount", { target: "five thousand" }],
    ["short title", { title: "ab" }],
  ])("rejects %s", async (_label, change) => {
    const createGoalSpy = vi.fn();
    const result = await createGoal({ store: makeStore({ createGoal: createGoalSpy }) }, "u", {
      ...validGoal,
      ...change,
    });
    expect(result.ok).toBe(false);
    expect(createGoalSpy).not.toHaveBeenCalled();
  });

  it("requires a business profile first", async () => {
    const store = makeStore({ getMyBusiness: async () => null });
    expect(await createGoal({ store }, "u", validGoal)).toEqual({
      ok: false,
      error: { code: "no_business" },
    });
  });

  it("reports a save failure", async () => {
    const store = makeStore({ createGoal: async () => err("failed" as const) });
    expect(await createGoal({ store }, "u", validGoal)).toEqual({
      ok: false,
      error: { code: "save_failed" },
    });
  });
});
