import { describe, expect, it } from "vitest";
import { purgeExpiredDocuments } from "./retention";
import type { DueDocument, RetentionStore } from "./ports";

const doc = (n: number): DueDocument => ({
  id: `doc-${n}`,
  type: "tax_return",
  storagePath: `biz/${n}.pdf`,
});

/** A store holding some expired documents, which records what was asked of it. */
function fakeStore(initial: DueDocument[], options: { cannotRemove?: string[] } = {}) {
  const waiting = [...initial];
  const calls = { removed: [] as string[], deleted: [] as string[] };

  const retention: RetentionStore = {
    async listDueDocuments(limit) {
      return waiting.slice(0, limit);
    },
    async removeFiles(documents) {
      const gone = documents.filter((d) => !options.cannotRemove?.includes(d.id)).map((d) => d.id);
      calls.removed.push(...gone);
      return gone;
    },
    async deleteRecords(ids) {
      calls.deleted.push(...ids);
      for (const id of ids) {
        const at = waiting.findIndex((d) => d.id === id);
        if (at >= 0) waiting.splice(at, 1);
      }
      return ids.length;
    },
  };
  return { retention, calls, waiting };
}

describe("purgeExpiredDocuments", () => {
  it("does nothing when nothing has expired", async () => {
    const { retention, calls } = fakeStore([]);
    expect(await purgeExpiredDocuments({ retention })).toEqual({
      found: 0,
      filesRemoved: 0,
      recordsDeleted: 0,
      failed: 0,
    });
    expect(calls.removed).toEqual([]);
    expect(calls.deleted).toEqual([]);
  });

  it("removes the files, then the records, for everything that has expired", async () => {
    const { retention, calls, waiting } = fakeStore([doc(1), doc(2), doc(3)]);
    const summary = await purgeExpiredDocuments({ retention });
    expect(summary).toEqual({ found: 3, filesRemoved: 3, recordsDeleted: 3, failed: 0 });
    expect(calls.removed).toEqual(["doc-1", "doc-2", "doc-3"]);
    expect(calls.deleted).toEqual(["doc-1", "doc-2", "doc-3"]);
    expect(waiting).toHaveLength(0);
  });

  it("works through more than one batch", async () => {
    const many = Array.from({ length: 450 }, (_, i) => doc(i));
    const { retention, waiting } = fakeStore(many);
    const summary = await purgeExpiredDocuments({ retention });
    expect(summary.found).toBe(450);
    expect(summary.recordsDeleted).toBe(450);
    expect(waiting).toHaveLength(0);
  });

  it("never deletes the record of a document whose file could not be removed", async () => {
    const { retention, calls, waiting } = fakeStore([doc(1), doc(2), doc(3)], {
      cannotRemove: ["doc-2"],
    });
    const summary = await purgeExpiredDocuments({ retention });
    expect(summary).toEqual({ found: 3, filesRemoved: 2, recordsDeleted: 2, failed: 1 });
    expect(calls.deleted).toEqual(["doc-1", "doc-3"]);
    expect(waiting.map((d) => d.id)).toEqual(["doc-2"]);
  });

  it("stops after a batch with a failure instead of retrying the same file", async () => {
    let listed = 0;
    const retention: RetentionStore = {
      async listDueDocuments() {
        listed += 1;
        return [doc(1)];
      },
      async removeFiles() {
        return [];
      },
      async deleteRecords() {
        throw new Error("nothing should be deleted");
      },
    };
    const summary = await purgeExpiredDocuments({ retention });
    expect(listed).toBe(1);
    expect(summary).toEqual({ found: 1, filesRemoved: 0, recordsDeleted: 0, failed: 1 });
  });

  it("stops after a bounded number of batches, so one run can never go on for ever", async () => {
    let listed = 0;
    const retention: RetentionStore = {
      async listDueDocuments() {
        listed += 1;
        return [doc(listed)];
      },
      async removeFiles(documents) {
        return documents.map((d) => d.id);
      },
      async deleteRecords(ids) {
        return ids.length;
      },
    };
    await purgeExpiredDocuments({ retention });
    expect(listed).toBe(10);
  });
});
