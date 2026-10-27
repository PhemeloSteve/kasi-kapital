import { z } from "zod";
import { bucketFor, toTrustTier, type DocumentStatus } from "@/domain/documents";
import { err, ok } from "@/domain/result";
import type { VerificationStatus } from "@/domain/types";
import type { DocumentRecord, DocumentStore, ReviewQueueItem } from "@/application/ports";
import { createClient } from "./server";

const status = z.enum(["pending", "verified", "rejected"]);
const verification = z.enum(["unverified", "pending", "verified", "rejected", "suspended"]);

const documentRow = z.object({
  id: z.string(),
  type: z.string(),
  status,
  review_note: z.string().nullable(),
  created_at: z.string(),
});

const queueRow = z.object({
  id: z.string(),
  type: z.string(),
  created_at: z.string(),
  businesses: z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    suburb: z.string().nullable(),
    verification,
    trust_tier: z.number(),
    owner: z.object({ full_name: z.string().nullable() }).nullable(),
  }),
});

const reviewResult = z.object({ business_status: verification, trust_tier: z.number() });

/** Supabase implementation of the DocumentStore port. Every call runs as the signed-in user. */
export function createDocumentStore(): DocumentStore {
  return {
    async listMyDocuments(businessId) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("id, type, status, review_note, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) console.error("[documents] list failed", { code: error.code });

      const records: DocumentRecord[] = [];
      for (const raw of data ?? []) {
        const row = documentRow.safeParse(raw);
        if (row.success) {
          const d = row.data;
          records.push({
            id: d.id,
            type: d.type,
            status: d.status,
            reviewNote: d.review_note,
            createdAt: d.created_at,
          });
        }
      }
      return records;
    },

    async upload({ bucket, path, bytes, contentType }) {
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: false });
      if (error) {
        console.error("[documents] upload failed", { message: error.message });
        return err("failed");
      }
      return ok(true as const);
    },

    async createRecord({ id, businessId, type, path }) {
      const supabase = await createClient();
      const { error } = await supabase
        .from("documents")
        .insert({ id, business_id: businessId, type, storage_path: path });
      if (error) {
        console.error("[documents] record failed", { code: error.code });
        return err(error.code === "54000" ? "limit_reached" : "failed");
      }
      return ok(true as const);
    },

    async removeFile(bucket, path) {
      const supabase = await createClient();
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) console.error("[documents] file removal failed", { message: error.message });
    },

    async getDocument(documentId) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("documents")
        .select("id, type, storage_path, status")
        .eq("id", documentId)
        .maybeSingle();
      const row = z
        .object({ id: z.string(), type: z.string(), storage_path: z.string(), status })
        .safeParse(data);
      if (!row.success) return null;
      return {
        id: row.data.id,
        type: row.data.type,
        path: row.data.storage_path,
        status: row.data.status as DocumentStatus,
      };
    },

    async deleteRecord(documentId) {
      const supabase = await createClient();
      // .select() lets us see whether a row was really deleted (row level security hides the rest).
      const { data, error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId)
        .select("id");
      if (error || !data || data.length === 0) {
        console.error("[documents] delete failed", { code: error?.code });
        return err("failed");
      }
      return ok(true as const);
    },

    async submitForReview(businessId) {
      const supabase = await createClient();
      // The database refuses this unless the required documents exist, so the rule cannot be skipped.
      const { data, error } = await supabase
        .from("businesses")
        .update({ verification: "pending" })
        .eq("id", businessId)
        .select("id");
      if (error) {
        console.error("[documents] submit failed", { code: error.code });
        if (error.code === "23514") return err("missing_documents");
        return err(error.code === "42501" ? "not_allowed" : "failed");
      }
      return data && data.length > 0 ? ok(true as const) : err("failed");
    },

    async listReviewQueue() {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, type, created_at, businesses!inner(id, name, category, suburb, verification, trust_tier, owner:profiles(full_name))",
        )
        .eq("status", "pending")
        .neq("type", "invoice")
        .order("created_at", { ascending: true });
      if (error) console.error("[documents] queue failed", { code: error.code });

      const items: ReviewQueueItem[] = [];
      for (const raw of data ?? []) {
        const row = queueRow.safeParse(raw);
        if (!row.success) continue;
        const { id, type, created_at, businesses: b } = row.data;
        items.push({
          documentId: id,
          type,
          uploadedAt: created_at,
          business: {
            id: b.id,
            name: b.name,
            category: b.category,
            suburb: b.suburb,
            verification: b.verification as VerificationStatus,
            trustTier: toTrustTier(b.trust_tier),
            ownerName: b.owner?.full_name ?? null,
          },
        });
      }
      return items;
    },

    async reviewDocument({ documentId, approve, note }) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("review_document", {
        p_document_id: documentId,
        p_approve: approve,
        p_note: note,
      });
      if (error) {
        console.error("[documents] review failed", { code: error.code });
        if (error.code === "22023") return err("note_required");
        if (error.message.includes("already been reviewed")) return err("already_reviewed");
        if (error.message.includes("not been submitted")) return err("not_submitted");
        return err("failed");
      }
      const result = reviewResult.safeParse(data);
      if (!result.success) return err("failed");
      return ok({
        businessStatus: result.data.business_status as VerificationStatus,
        trustTier: toTrustTier(result.data.trust_tier),
      });
    },

    async createViewUrl(documentId) {
      const supabase = await createClient();
      // Row level security means only the owner or an administrator can even find the document.
      const { data: doc } = await supabase
        .from("documents")
        .select("id, type, storage_path")
        .eq("id", documentId)
        .maybeSingle();
      const row = z
        .object({ id: z.string(), type: z.string(), storage_path: z.string() })
        .safeParse(doc);
      if (!row.success) return err("not_found");

      // Recorded only when an administrator is the one looking (the function ignores everyone else).
      await supabase.rpc("log_document_view", { p_document_id: row.data.id });

      const { data, error } = await supabase.storage
        .from(bucketFor(row.data.type))
        .createSignedUrl(row.data.storage_path, 60);
      if (error || !data) return err("not_found");
      return ok({ url: data.signedUrl });
    },
  };
}
