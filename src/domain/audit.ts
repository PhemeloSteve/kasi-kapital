// Pure rules for showing the audit log.

export type AuditTone = "green" | "red" | "amber" | "slate";

const redEndings = new Set(["suspended", "rejected", "failed", "deleted", "removed"]);
const greenEndings = new Set(["approved", "unsuspended", "paid", "verified", "released", "held"]);
const amberEndings = new Set([
  "started",
  "created",
  "verification_changed",
  "status_set",
  "submitted",
  "changed",
]);

/**
 * How to colour an action such as "business.suspended". Only the last part counts, so
 * "unsuspended" is green even though it contains "suspended".
 */
export function auditActionTone(action: string): AuditTone {
  const ending = action.split(".").pop() ?? "";
  if (redEndings.has(ending)) return "red";
  if (greenEndings.has(ending)) return "green";
  if (amberEndings.has(ending)) return "amber";
  return "slate";
}

/** The first 8 characters of an id, enough to tell rows apart without printing the whole thing. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

export const AUDIT_PAGE_SIZE = 25;

/** Action and entity filters are short code-like words ("business.suspended", "businesses"). Anything else is ignored. */
export function parseAuditFilter(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[a-z0-9_.-]{1,60}$/i.test(trimmed) ? trimmed : null;
}

/** A page number from a query string: a whole number from 1 to 1000, otherwise 1. */
export function parseAuditPage(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}
