import type { MilestoneStatus } from "./types";

/** Funds are only released against an admin-approved proof of spend. */
export function canReleaseMilestone(status: MilestoneStatus): boolean {
  return status === "approved";
}
