import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { suspendBusiness, unsuspendBusiness } from "./moderation";
import type { BusinessModeration } from "./ports";

const ID = "11111111-1111-4111-8111-111111111111";

function makeModeration(overrides: Partial<BusinessModeration> = {}): BusinessModeration {
  return {
    suspend: async () => ok(true as const),
    unsuspend: async () => ok(true as const),
    ...overrides,
  };
}

describe("suspendBusiness", () => {
  it("passes the id and the trimmed reason to the store", async () => {
    const suspend = vi.fn(async () => ok(true as const));
    const result = await suspendBusiness(
      { moderation: makeModeration({ suspend }) },
      { businessId: ID, reason: "  Reported for fraud  " },
    );
    expect(result).toEqual(ok(true));
    expect(suspend).toHaveBeenCalledWith({ businessId: ID, reason: "Reported for fraud" });
  });

  it("needs a reason and never calls the store without one", async () => {
    const suspend = vi.fn(async () => ok(true as const));
    for (const reason of ["", "   ", undefined, 42]) {
      const result = await suspendBusiness(
        { moderation: makeModeration({ suspend }) },
        { businessId: ID, reason },
      );
      expect(result).toEqual(err("reason_required"));
    }
    expect(suspend).not.toHaveBeenCalled();
  });

  it("refuses a reason over 300 characters or an id that is not a uuid", async () => {
    const suspend = vi.fn(async () => ok(true as const));
    const deps = { moderation: makeModeration({ suspend }) };
    expect(await suspendBusiness(deps, { businessId: ID, reason: "x".repeat(301) })).toEqual(
      err("invalid_input"),
    );
    expect(await suspendBusiness(deps, { businessId: "nope", reason: "fraud" })).toEqual(
      err("invalid_input"),
    );
    expect(suspend).not.toHaveBeenCalled();
  });

  it("passes the store's refusal through", async () => {
    const result = await suspendBusiness(
      { moderation: makeModeration({ suspend: async () => err("not_allowed") }) },
      { businessId: ID, reason: "fraud" },
    );
    expect(result).toEqual(err("not_allowed"));
  });
});

describe("unsuspendBusiness", () => {
  it("reinstates by id", async () => {
    const unsuspend = vi.fn(async () => ok(true as const));
    const result = await unsuspendBusiness(
      { moderation: makeModeration({ unsuspend }) },
      { businessId: ID },
    );
    expect(result).toEqual(ok(true));
    expect(unsuspend).toHaveBeenCalledWith(ID);
  });

  it("refuses a bad id without calling the store", async () => {
    const unsuspend = vi.fn(async () => ok(true as const));
    const result = await unsuspendBusiness(
      { moderation: makeModeration({ unsuspend }) },
      { businessId: 7 },
    );
    expect(result).toEqual(err("invalid_input"));
    expect(unsuspend).not.toHaveBeenCalled();
  });

  it("passes the store's refusal through", async () => {
    const result = await unsuspendBusiness(
      { moderation: makeModeration({ unsuspend: async () => err("not_suspended") }) },
      { businessId: ID },
    );
    expect(result).toEqual(err("not_suspended"));
  });
});
