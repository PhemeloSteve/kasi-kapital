import { z } from "zod";
import { bucketFor } from "@/domain/documents";
import type { DueDocument, RetentionStore } from "@/application/ports";
import { createServiceClient } from "./service";

const dueRows = z.array(
  z.object({ id: z.string(), doc_type: z.string(), storage_path: z.string() }),
);

type DueRow = z.infer<typeof dueRows>[number];

const FILES_PER_REQUEST = 100;

/**
 * The server-side store for deleting expired documents. It uses the service role, because the database
 * functions it calls are closed to every signed-in person.
 */
export function createRetentionStore(): RetentionStore {
  return {
    async listDueDocuments(limit): Promise<DueDocument[]> {
      const supabase = createServiceClient();
      const { data, error } = await supabase.rpc("documents_due_for_purge", { p_limit: limit });
      if (error) throw new Error(`listing expired documents failed (${error.code})`);
      return dueRows
        .parse(data ?? [])
        .map((row: DueRow) => ({ id: row.id, type: row.doc_type, storagePath: row.storage_path }));
    },

    async removeFiles(documents) {
      const supabase = createServiceClient();
      const byBucket = new Map<string, DueDocument[]>();
      for (const document of documents) {
        const bucket = bucketFor(document.type);
        byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), document]);
      }

      const removed: string[] = [];
      for (const [bucket, inBucket] of byBucket) {
        for (let from = 0; from < inBucket.length; from += FILES_PER_REQUEST) {
          const chunk = inBucket.slice(from, from + FILES_PER_REQUEST);
          const { error } = await supabase.storage
            .from(bucket)
            .remove(chunk.map((document) => document.storagePath));
          if (error) {
            console.error("[retention] file removal failed", { bucket, count: chunk.length });
            continue;
          }
          removed.push(...chunk.map((document) => document.id));
        }
      }
      return removed;
    },

    async deleteRecords(ids) {
      const supabase = createServiceClient();
      const { data, error } = await supabase.rpc("finish_document_purge", { p_ids: ids });
      if (error) throw new Error(`deleting expired records failed (${error.code})`);
      return typeof data === "number" ? data : 0;
    },
  };
}
