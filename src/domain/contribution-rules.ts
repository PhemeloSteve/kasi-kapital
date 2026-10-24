import { err, ok, type Result } from "./result";
import type { VerificationStatus } from "./types";

export type ContributionCheck = {
  kycStatus: VerificationStatus;
  amountCents: number;
  unverifiedLimitCents: number;
  goalOpen: boolean;
  businessVerified: boolean;
};

export type ContributionRejection =
  | "invalid_amount"
  | "account_blocked"
  | "goal_closed"
  | "business_not_verified"
  | "over_unverified_limit";

/** Single source of truth for whether a contribution may proceed. */
export function checkContribution(input: ContributionCheck): Result<true, ContributionRejection> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return err("invalid_amount");
  if (!Number.isInteger(input.unverifiedLimitCents) || input.unverifiedLimitCents < 0) {
    return err("over_unverified_limit");
  }
  const validKycStatuses = new Set(["unverified", "pending", "verified", "rejected", "suspended"]);
  if (!validKycStatuses.has(input.kycStatus)) return err("account_blocked");
  if (input.kycStatus === "rejected" || input.kycStatus === "suspended")
    return err("account_blocked");
  if (!input.goalOpen) return err("goal_closed");
  if (!input.businessVerified) return err("business_not_verified");
  if (input.kycStatus !== "verified" && input.amountCents > input.unverifiedLimitCents) {
    return err("over_unverified_limit");
  }
  return ok(true as const);
}
