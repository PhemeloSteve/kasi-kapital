import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { closeBusiness, suspendBusiness, unsuspendBusiness } from "./moderation";
import type { BusinessModeration } from "./ports";

const ID = "11111111-1111-4111-8111-111111111111";

function makeModeration(overrides: Partial<BusinessModeration> = {}): BusinessModeration {
  return {
    suspend: async () => ok(true as const),
    unsuspend: async () => ok(true as const),
    close: async () => ok(true as const),
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

describe("closeBusiness", () => {
  it("passes the id and the trimmed reason to the store once confirmed", async () => {
    const close = vi.fn(async () => ok(true as const));
    const result = await closeBusiness(
      { moderation: makeModeration({ close }) },
      { businessId: ID, reason: "  Owner stopped trading  ", confirmed: true },
    );
    expect(result).toEqual(ok(true));
    expect(close).toHaveBeenCalledWith({ businessId: ID, reason: "Owner stopped trading" });
  });

  it("needs the confirmation and never calls the store without it", async () => {
    const close = vi.fn(async () => ok(true as const));
    for (const confirmed of [false, undefined, "yes", 1, null]) {
      const result = await closeBusiness(
        { moderation: makeModeration({ close }) },
        { businessId: ID, reason: "stopped trading", confirmed },
      );
      expect(result).toEqual(err("confirm_required"));
    }
    expect(close).not.toHaveBeenCalled();
  });

  it("needs a reason and never calls the store without one", async () => {
    const close = vi.fn(async () => ok(true as const));
    for (const reason of ["", "   ", undefined, 42]) {
      const result = await closeBusiness(
        { moderation: makeModeration({ close }) },
        { businessId: ID, reason, confirmed: true },
      );
      expect(result).toEqual(err("reason_required"));
    }
    expect(close).not.toHaveBeenCalled();
  });

  it("refuses a reason over 300 characters or an id that is not a uuid", async () => {
    const close = vi.fn(async () => ok(true as const));
    const deps = { moderation: makeModeration({ close }) };
    expect(
      await closeBusiness(deps, { businessId: ID, reason: "x".repeat(301), confirmed: true }),
    ).toEqual(err("invalid_input"));
    expect(
      await closeBusiness(deps, { businessId: "nope", reason: "stopped", confirmed: true }),
    ).toEqual(err("invalid_input"));
    expect(close).not.toHaveBeenCalled();
  });

  it("passes each refusal from the store through", async () => {
    for (const code of [
      "not_allowed",
      "not_found",
      "already_closed",
      "money_held",
      "failed",
    ] as const) {
      const result = await closeBusiness(
        { moderation: makeModeration({ close: async () => err(code) }) },
        { businessId: ID, reason: "stopped", confirmed: true },
      );
      expect(result).toEqual(err(code));
    }
  });
});
