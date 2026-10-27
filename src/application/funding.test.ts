import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import {
  confirmDemoPayment,
  processPayouts,
  startContribution,
  verifyIdentityDemo,
} from "./funding";
import type { ContributionRecord, ContributionStore, PaymentGateway, PaymentServer } from "./ports";

const GOAL = "11111111-1111-4111-8111-111111111111";
const CONTRIBUTION = "22222222-2222-4222-8222-222222222222";

const record = (status: ContributionRecord["status"]): ContributionRecord => ({
  id: CONTRIBUTION,
  amountCents: 20_000,
  status,
  createdAt: "2026-01-01T00:00:00Z",
  goalTitle: "Bigger oven",
  businessId: "b1",
  businessName: "Mama T Bakery",
});

function makeContributions(overrides: Partial<ContributionStore> = {}): ContributionStore {
  return {
    start: async () => ok({ id: CONTRIBUTION }),
    getMine: async () => record("pending"),
    listMine: async () => [],
    ...overrides,
  };
}

function makeGateway(overrides: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    createCheckout: async ({ contributionId }) => ({
      checkoutUrl: `/mock-checkout/${contributionId}`,
      reference: "ref",
    }),
    payOut: async ({ payoutId }) => ok({ reference: `payout-${payoutId}` }),
    ...overrides,
  };
}

function makeServer(overrides: Partial<PaymentServer> = {}): PaymentServer {
  return {
    confirmContribution: async () => ok("held" as const),
    listPendingPayouts: async () => [],
    markPayoutPaid: async () => true,
    noteFailure: async () => {},
    setKycStatus: async () => ok(true as const),
    ...overrides,
  };
}

describe("startContribution", () => {
  it("converts rand to cents, starts the contribution and returns the checkout address", async () => {
    const start = vi.fn(async () => ok({ id: CONTRIBUTION }));
    const result = await startContribution(
      { contributions: makeContributions({ start }), payments: makeGateway() },
      { goalId: GOAL, amount: "R 200" },
    );
    expect(result).toEqual({ ok: true, value: { checkoutUrl: `/mock-checkout/${CONTRIBUTION}` } });
    expect(start).toHaveBeenCalledWith({ goalId: GOAL, amountCents: 20_000 });
  });

  it.each([
    ["no amount", undefined],
    ["text", "a lot"],
    ["below R10", "9.99"],
    ["above R1 000 000", "1000000.01"],
    ["a comma-thousands amount that could be misread", "1,500"],
  ])("refuses %s without asking the database", async (_label, amount) => {
    const start = vi.fn();
    const result = await startContribution(
      { contributions: makeContributions({ start }), payments: makeGateway() },
      { goalId: GOAL, amount },
    );
    expect(result).toEqual({ ok: false, error: { code: "amount_out_of_range" } });
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects a malformed goal id", async () => {
    const start = vi.fn();
    expect(
      await startContribution(
        { contributions: makeContributions({ start }), payments: makeGateway() },
        { goalId: "../x", amount: "50" },
      ),
    ).toEqual({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("passes the database's refusal through, including how much room is left", async () => {
    const contributions = makeContributions({
      start: async () => err({ code: "goal_full" as const, remainingCents: 12_300 }),
    });
    const createCheckout = vi.fn();
    const result = await startContribution(
      { contributions, payments: makeGateway({ createCheckout }) },
      { goalId: GOAL, amount: "500" },
    );
    expect(result).toEqual({ ok: false, error: { code: "goal_full", remainingCents: 12_300 } });
    expect(createCheckout).not.toHaveBeenCalled();
  });
});

describe("processPayouts", () => {
  it("pays each pending payout once and records it, using the payout id as the idempotency key", async () => {
    const payOut = vi.fn(async ({ payoutId }: { payoutId: string }) =>
      ok({ reference: `ref-${payoutId}` }),
    );
    const markPayoutPaid = vi.fn(async () => true);
    const server = makeServer({
      listPendingPayouts: async () => [
        { id: "p1", amountCents: 300_000 },
        { id: "p2", amountCents: 200_000 },
      ],
      markPayoutPaid,
    });
    expect(await processPayouts({ gateway: makeGateway({ payOut }), server })).toEqual({
      paid: 2,
      failed: 0,
    });
    expect(payOut).toHaveBeenCalledWith({ payoutId: "p1", amountCents: 300_000 });
    expect(markPayoutPaid).toHaveBeenCalledWith("p1", "ref-p1");
  });

  it("leaves a failed payout pending with a reason and carries on with the others", async () => {
    const noteFailure = vi.fn(async () => {});
    const markPayoutPaid = vi.fn(async () => true);
    const gateway = makeGateway({
      payOut: async ({ payoutId }) =>
        payoutId === "p1" ? err("failed" as const) : ok({ reference: "r2" }),
    });
    const server = makeServer({
      listPendingPayouts: async () => [
        { id: "p1", amountCents: 1 },
        { id: "p2", amountCents: 2 },
      ],
      noteFailure,
      markPayoutPaid,
    });
    expect(await processPayouts({ gateway, server })).toEqual({ paid: 1, failed: 1 });
    expect(noteFailure).toHaveBeenCalledWith("p1", expect.stringContaining("retried"));
    expect(markPayoutPaid).toHaveBeenCalledTimes(1);
  });

  it("does not count a payout the database says was already paid", async () => {
    const server = makeServer({
      listPendingPayouts: async () => [{ id: "p1", amountCents: 1 }],
      markPayoutPaid: async () => false,
    });
    expect(await processPayouts({ gateway: makeGateway(), server })).toEqual({
      paid: 0,
      failed: 0,
    });
  });

  it("does nothing when nothing is pending", async () => {
    const payOut = vi.fn();
    expect(
      await processPayouts({ gateway: makeGateway({ payOut }), server: makeServer() }),
    ).toEqual({ paid: 0, failed: 0 });
    expect(payOut).not.toHaveBeenCalled();
  });
});

describe("confirmDemoPayment", () => {
  it("confirms a pending contribution and then pays out anything that became payable", async () => {
    const confirmContribution = vi.fn(async () => ok("held" as const));
    const server = makeServer({
      confirmContribution,
      listPendingPayouts: async () => [{ id: "p1", amountCents: 100 }],
    });
    const result = await confirmDemoPayment(
      { contributions: makeContributions(), server, gateway: makeGateway() },
      CONTRIBUTION,
    );
    expect(result).toEqual({
      ok: true,
      value: { outcome: "held", payouts: { paid: 1, failed: 0 } },
    });
    expect(confirmContribution).toHaveBeenCalledWith({
      contributionId: CONTRIBUTION,
      reference: `mock-pay-${CONTRIBUTION}`,
    });
  });

  it("does nothing for someone else's contribution (not visible to this user)", async () => {
    const confirmContribution = vi.fn();
    const result = await confirmDemoPayment(
      {
        contributions: makeContributions({ getMine: async () => null }),
        server: makeServer({ confirmContribution }),
        gateway: makeGateway(),
      },
      CONTRIBUTION,
    );
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(confirmContribution).not.toHaveBeenCalled();
  });

  it.each([
    ["already held", "held", "held"],
    ["failed", "failed", "not_pending"],
    ["refunded", "refunded", "not_pending"],
  ] as const)("is harmless for a contribution that is %s", async (_label, status, outcome) => {
    const confirmContribution = vi.fn();
    const result = await confirmDemoPayment(
      {
        contributions: makeContributions({ getMine: async () => record(status) }),
        server: makeServer({ confirmContribution }),
        gateway: makeGateway(),
      },
      CONTRIBUTION,
    );
    expect(result).toMatchObject({ ok: true, value: { outcome } });
    expect(confirmContribution).not.toHaveBeenCalled();
  });

  it("reports an expired checkout without paying anything out", async () => {
    const server = makeServer({ confirmContribution: async () => ok("expired" as const) });
    const payOut = vi.fn();
    const result = await confirmDemoPayment(
      { contributions: makeContributions(), server, gateway: makeGateway({ payOut }) },
      CONTRIBUTION,
    );
    expect(result).toMatchObject({ ok: true, value: { outcome: "expired" } });
    expect(payOut).not.toHaveBeenCalled();
  });

  it("rejects a malformed id", async () => {
    expect(
      await confirmDemoPayment(
        { contributions: makeContributions(), server: makeServer(), gateway: makeGateway() },
        "nope",
      ),
    ).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("verifyIdentityDemo", () => {
  it("refuses unless the demo switch is on, and never reaches the server", async () => {
    const setKycStatus = vi.fn();
    expect(
      await verifyIdentityDemo({ server: makeServer({ setKycStatus }), demoEnabled: false }, "u"),
    ).toEqual({ ok: false, error: "disabled" });
    expect(setKycStatus).not.toHaveBeenCalled();
  });
  it("marks the user verified when the demo switch is on", async () => {
    const setKycStatus = vi.fn(async () => ok(true as const));
    expect(
      await verifyIdentityDemo({ server: makeServer({ setKycStatus }), demoEnabled: true }, "u1"),
    ).toEqual({ ok: true, value: true });
    expect(setKycStatus).toHaveBeenCalledWith("u1", "verified");
  });
});
