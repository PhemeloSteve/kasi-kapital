import { describe, expect, it } from "vitest";
import { checkContribution, type ContributionCheck } from "./contribution-rules";

const base: ContributionCheck = {
  kycStatus: "verified",
  amountCents: 50_000,
  unverifiedLimitCents: 100_000,
  goalOpen: true,
  businessVerified: true,
};

describe("checkContribution", () => {
  it("accepts a valid contribution from a verified user", () => {
    expect(checkContribution(base).ok).toBe(true);
  });

  it.each([0, -5, 10.5, Number.NaN])("rejects invalid amount %s", (amountCents) => {
    expect(checkContribution({ ...base, amountCents })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
  });

  it.each(["rejected", "suspended"] as const)("blocks %s accounts", (kycStatus) => {
    expect(checkContribution({ ...base, kycStatus })).toEqual({
      ok: false,
      error: "account_blocked",
    });
  });

  it("rejects closed goals and unverified businesses", () => {
    expect(checkContribution({ ...base, goalOpen: false })).toEqual({
      ok: false,
      error: "goal_closed",
    });
    expect(checkContribution({ ...base, businessVerified: false })).toEqual({
      ok: false,
      error: "business_not_verified",
    });
  });

  it("caps unverified users but not verified ones", () => {
    const big = 500_000;
    expect(checkContribution({ ...base, kycStatus: "unverified", amountCents: big })).toEqual({
      ok: false,
      error: "over_unverified_limit",
    });
    expect(checkContribution({ ...base, kycStatus: "unverified", amountCents: 100_000 }).ok).toBe(
      true,
    );
    expect(checkContribution({ ...base, kycStatus: "verified", amountCents: big }).ok).toBe(true);
  });
});
