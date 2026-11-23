// Pure rules for the "something is waiting for an administrator" emails.

export type WebhookEvent = {
  type?: unknown;
  table?: unknown;
  record?: unknown;
  old_record?: unknown;
};

export type AdminNotification = { subject: string; text: string };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Strips line breaks and trims, so a business name can never inject extra email headers or lines. */
function oneLine(value: unknown, max = 120): string {
  return String(typeof value === "string" ? value : "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Decides whether a database webhook deserves an email, and what it says. Supabase's webhook screen cannot
 * filter rows, so this does: only the moment a business becomes "pending" (submitted or resubmitted for
 * review) or a milestone becomes "proof_submitted" counts. Everything else returns null.
 */
export function describeAdminNotification(event: WebhookEvent): AdminNotification | null {
  if (event.type !== "UPDATE" && event.type !== "INSERT") return null;
  const record = asRecord(event.record);
  if (!record) return null;
  const before = asRecord(event.old_record);

  if (event.table === "businesses") {
    if (record.verification !== "pending" || before?.verification === "pending") return null;
    const name = oneLine(record.name) || "A business";
    return {
      subject: `New business submitted for verification: ${name}`,
      text: `${name} has been submitted for verification and is waiting in the review queue.`,
    };
  }

  if (event.table === "milestones") {
    if (record.status !== "proof_submitted" || before?.status === "proof_submitted") return null;
    const title = oneLine(record.title) || "a milestone";
    return {
      subject: "Milestone proof submitted",
      text: `Proof was submitted for “${title}” and is waiting in the review queue.`,
    };
  }

  // The audit log: an email for the actions an administrator should never learn about only afterwards.
  // The reason an administrator typed is left out on purpose; it is in the audit log for whoever looks.
  if (event.table === "audit_log") {
    if (event.type !== "INSERT") return null;
    const label = ALERT_ACTIONS.get(oneLine(record.action, 60));
    if (!label) return null;
    const what = [oneLine(record.entity, 40), oneLine(record.entity_id, 60)]
      .filter(Boolean)
      .join(" ");
    return {
      subject: `Admin action: ${label.toLowerCase()}`,
      text: `${label}${what ? ` (${what})` : ""}. Open Admin, Audit log to see who did it and why. If this was not you or a colleague, follow the account takeover runbook.`,
    };
  }

  return null;
}

const ALERT_ACTIONS = new Map<string, string>([
  ["business.suspended", "A business was suspended"],
  ["business.unsuspended", "A business was reinstated"],
  ["business.closed", "A business was closed"],
  ["payout.created", "A payout was created"],
  ["payout.paid", "A payout was recorded as paid"],
]);

export type RetentionOutcome =
  | { ok: true; found: number; filesRemoved: number; recordsDeleted: number; failed: number }
  | { ok: false };

/** An email for a clean-up run that failed or left documents behind. A normal run sends nothing. */
export function describeRetentionAlert(outcome: RetentionOutcome): AdminNotification | null {
  if (!outcome.ok) {
    return {
      subject: "Retention run failed",
      text: "The daily clean-up of expired documents failed and may not have finished. Look for “[retention] purge failed” in the Vercel logs. It runs again tomorrow; documents past their retention period stay until it succeeds.",
    };
  }
  if (outcome.failed > 0) {
    return {
      subject: "Retention run left documents behind",
      text: `The daily clean-up found ${outcome.found} document(s) due for deletion and could not delete ${outcome.failed} of them. It tries them again tomorrow. Look for “[retention]” lines in the Vercel logs.`,
    };
  }
  return null;
}
