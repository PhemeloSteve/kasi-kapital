import { z } from "zod";
import {
  bucketFor,
  fileKinds,
  isUploadableType,
  missingRequirements,
  validateUpload,
  type UploadableType,
} from "@/domain/documents";
import { err, ok, type Result } from "@/domain/result";
import type { BusinessStore, DocumentStore } from "./ports";

type Deps = { business: BusinessStore; documents: DocumentStore };

// ---------- storing a file (shared by verification documents and milestone proof) ----------
export type UploadError =
  | "invalid_type"
  | "no_file"
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "no_business"
  | "suspended"
  | "limit_reached"
  | "upload_failed";

export type StoredDocument = { id: string; bucket: string; path: string };

/**
 * Checks a file, stores it in the business's own folder and records it. The file's real content decides
 * what it is, never its name or the type the browser claims. If recording fails, the file is removed again
 * so no unreferenced document is left sitting in storage.
 */
export async function storeDocument(
  deps: Deps & { newId: () => string },
  userId: string,
  type: string,
  bytes: Uint8Array,
): Promise<Result<StoredDocument, UploadError>> {
  const checked = validateUpload(bytes);
  if (!checked.ok) return err(checked.error);

  const business = await deps.business.getMyBusiness(userId);
  if (!business) return err("no_business");
  if (business.verification === "suspended") return err("suspended");

  const id = deps.newId();
  const kind = fileKinds[checked.value];
  const bucket = bucketFor(type);
  const path = `${business.id}/${id}.${kind.extension}`;

  const stored = await deps.documents.upload({
    bucket,
    path,
    bytes,
    contentType: kind.contentType,
  });
  if (!stored.ok) return err("upload_failed");

  const recorded = await deps.documents.createRecord({ id, businessId: business.id, type, path });
  if (!recorded.ok) {
    await deps.documents.removeFile(bucket, path);
    return err(recorded.error === "limit_reached" ? "limit_reached" : "upload_failed");
  }
  return ok({ id, bucket, path });
}

export async function uploadDocument(
  deps: Deps & { newId: () => string },
  userId: string,
  input: { type: unknown; bytes: Uint8Array | null },
): Promise<Result<{ id: string }, UploadError>> {
  if (!isUploadableType(input.type)) return err("invalid_type");
  if (input.bytes === null) return err("no_file");

  const stored = await storeDocument(deps, userId, input.type, input.bytes);
  return stored.ok ? ok({ id: stored.value.id }) : err(stored.error);
}

// ---------- delete ----------
export type DeleteError = "invalid_input" | "not_found" | "approved_locked" | "failed";

export async function deleteDocument(
  deps: Deps,
  rawId: unknown,
): Promise<Result<true, DeleteError>> {
  const parsed = z.uuid().safeParse(rawId);
  if (!parsed.success) return err("invalid_input");

  // The store only returns documents this user may see, so other people's ids come back empty.
  const doc = await deps.documents.getDocument(parsed.data);
  if (!doc) return err("not_found");
  if (doc.status === "verified") return err("approved_locked");

  // File first, then the record: if this stops half-way, the founder can simply try again,
  // and no identity document is left behind in storage.
  await deps.documents.removeFile(bucketFor(doc.type), doc.path);
  const removed = await deps.documents.deleteRecord(doc.id);
  return removed.ok ? ok(true as const) : err("failed");
}

// ---------- submit for review ----------
export type SubmitError =
  | { code: "no_business" }
  | { code: "already_submitted" }
  | { code: "missing_documents"; missing: UploadableType[] }
  | { code: "failed" };

export async function submitForReview(
  deps: Deps,
  userId: string,
): Promise<Result<true, SubmitError>> {
  const business = await deps.business.getMyBusiness(userId);
  if (!business) return err({ code: "no_business" });
  if (business.verification !== "unverified" && business.verification !== "rejected") {
    return err({ code: "already_submitted" });
  }

  const missing = missingRequirements(await deps.documents.listMyDocuments(business.id));
  if (missing.length > 0) return err({ code: "missing_documents", missing });

  const submitted = await deps.documents.submitForReview(business.id);
  if (submitted.ok) return ok(true as const);
  return err(
    submitted.error === "missing_documents"
      ? { code: "missing_documents", missing }
      : { code: "failed" },
  );
}

// ---------- administrator review ----------
const reviewInput = z.object({
  documentId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300),
});

export type ReviewError =
  "invalid_input" | "note_required" | "already_reviewed" | "not_submitted" | "failed";

export async function reviewDocument(deps: { documents: DocumentStore }, rawInput: unknown) {
  const parsed = reviewInput.safeParse(rawInput);
  if (!parsed.success) return err<ReviewError>("invalid_input");
  const { documentId, decision, note } = parsed.data;

  const approve = decision === "approve";
  if (!approve && note === "") return err<ReviewError>("note_required");

  const reviewed = await deps.documents.reviewDocument({
    documentId,
    approve,
    note: note === "" ? null : note,
  });
  return reviewed.ok
    ? ok({ approved: approve, ...reviewed.value })
    : err<ReviewError>(reviewed.error);
}
