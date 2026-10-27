import type { MilestoneStatus } from "@/domain/types";

/** One plain-language line that combines a milestone's progress with where its money is. */
export function milestoneLabel(input: {
  status: MilestoneStatus;
  funded: "unfunded" | "partial" | "funded" | null;
  payout: "pending" | "paid" | "failed" | null;
}): string {
  if (input.payout === "paid") return "Paid out";
  if (input.payout === "pending" || input.payout === "failed") return "Being paid out";
  switch (input.status) {
    case "approved":
      return "Approved, waiting for funds";
    case "proof_submitted":
      return "Proof sent, awaiting review";
    case "rejected":
      return "Needs attention";
    case "pending":
      if (input.funded === "funded") return "Funded, waiting for proof";
      if (input.funded === "partial") return "Partly funded";
      if (input.funded === "unfunded") return "Waiting for funds";
      return "Not started";
  }
}
