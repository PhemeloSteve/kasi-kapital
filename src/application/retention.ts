import type { RetentionStore } from "./ports";

export type PurgeSummary = {
  /** Expired documents found. */
  found: number;
  /** Stored files that were deleted. */
  filesRemoved: number;
  /** Database records that were deleted (each one is also written to the audit log). */
  recordsDeleted: number;
  /** Documents whose file could not be deleted this time. They are tried again on the next run. */
  failed: number;
};

const BATCH_SIZE = 200;
const MAX_BATCHES = 10;

/**
 * Deletes rejected documents and proof files once they are past their retention period. For each batch the
 * stored file goes first and the record second, so a failure never leaves a record pointing at a file that is
 * gone, and never leaves a file nobody can find. Whatever could not be removed is simply found again on the
 * next run. A run stops at the first batch that had any failure, instead of retrying the same files.
 */
export async function purgeExpiredDocuments(deps: {
  retention: RetentionStore;
}): Promise<PurgeSummary> {
  const summary: PurgeSummary = { found: 0, filesRemoved: 0, recordsDeleted: 0, failed: 0 };

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const due = await deps.retention.listDueDocuments(BATCH_SIZE);
    if (due.length === 0) break;
    summary.found += due.length;

    const removed = await deps.retention.removeFiles(due);
    summary.filesRemoved += removed.length;
    summary.failed += due.length - removed.length;

    if (removed.length > 0) {
      summary.recordsDeleted += await deps.retention.deleteRecords(removed);
    }
    if (removed.length < due.length) break;
  }
  return summary;
}
