import { describe, expect, it, vi } from "vitest";
import { contribute, type ContributeDeps } from "./contribute";
import { mockPayments } from "@/infrastructure/providers/mock";

const ids = {
  goalId: "11111111-1111-4111-8111-111111111111",
  contributorId: "22222222-2222-4222-8222-222222222222",
};

function makeDeps(overrides: Partial<ContributeDeps["store"]> = {}): ContributeDeps {
  return {
    unverifiedLimitCents: 100_000,
    payments: mockPayments,
    store: {
      getContributor: async () => ({ kycStatus: "verified" }),
      getGoal: async () => ({ isOpen: true, businessVerified: true }),
      saveContribution: async () => ({ id: "c-1" }),
      ...overrides,
    },
  };
}

describe("contribute use case", () => {
  it("creates a contribution and a checkout", async () => {
    const result = await contribute(makeDeps(), { ...ids, amountCents: 20_000, kind: "donation" });
    expect(result).toEqual({
      ok: true,
      value: { contributionId: "c-1", checkoutUrl: "/mock-checkout/c-1" },
    });
  });

  it("rejects malformed input before touching the store", async () => {
    const getGoal = vi.fn();
    const result = await contribute(makeDeps({ getGoal }), { goalId: "nope", amountCents: -1 });
    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(getGoal).not.toHaveBeenCalled();
  });

  it("does not allow equity contributions yet", async () => {
    const result = await contribute(makeDeps(), { ...ids, amountCents: 1000, kind: "equity" });
    expect(result).toEqual({ ok: false, error: "invalid_input" });
  });

  it("returns not_found for unknown goals or users", async () => {
    const result = await contribute(makeDeps({ getGoal: async () => null }), {
      ...ids,
      amountCents: 1000,
      kind: "donation",
    });
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("applies domain rules and never saves a rejected contribution", async () => {
    const saveContribution = vi.fn();
    const result = await contribute(
      makeDeps({ getContributor: async () => ({ kycStatus: "unverified" }), saveContribution }),
      { ...ids, amountCents: 900_000, kind: "donation" },
    );
    expect(result).toEqual({ ok: false, error: "over_unverified_limit" });
    expect(saveContribution).not.toHaveBeenCalled();
  });
});
