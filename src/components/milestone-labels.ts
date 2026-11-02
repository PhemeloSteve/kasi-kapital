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

export type MilestoneTone = "success" | "waiting" | "action" | "attention" | "locked";

/** How a milestone row should look: done, in someone else's hands, needs the founder, needs fixing, or not open yet. */
export function milestoneTone(input: {
  status: MilestoneStatus;
  funded: "unfunded" | "partial" | "funded" | null;
  payout: "pending" | "paid" | "failed" | null;
}): MilestoneTone {
  if (input.payout === "paid") return "success";
  if (input.payout === "pending" || input.payout === "failed") return "waiting";
  switch (input.status) {
    case "approved":
    case "proof_submitted":
      return "waiting";
    case "rejected":
      return "attention";
    case "pending":
      return input.funded === "funded" ? "action" : "locked";
  }
}
