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

  return null;
}
