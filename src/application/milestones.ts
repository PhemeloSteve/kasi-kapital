import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import { storeDocument, type UploadError } from "./documents";
import type { BusinessStore, DocumentStore, MilestoneStore } from "./ports";

// ---------- founder: proof of spending ----------
export type ProofError =
  UploadError | "invalid_milestone" | "not_allowed" | "invalid_proof" | "failed";

/** The founder uploads an invoice or quote and attaches it to one of their milestones. */
export async function submitMilestoneProof(
  deps: {
    business: BusinessStore;
    documents: DocumentStore;
    milestones: MilestoneStore;
    newId: () => string;
  },
  userId: string,
  input: { milestoneId: unknown; bytes: Uint8Array | null },
): Promise<Result<true, ProofError>> {
  const milestoneId = z.uuid().safeParse(input.milestoneId);
  if (!milestoneId.success) return err("invalid_milestone");
  if (input.bytes === null) return err("no_file");

  const stored = await storeDocument(deps, userId, "invoice", input.bytes);
  if (!stored.ok) return err(stored.error);

  const submitted = await deps.milestones.submitProof({
    milestoneId: milestoneId.data,
    documentId: stored.value.id,
  });
  if (!submitted.ok) {
    // The proof was refused (not your milestone, already approved...): leave nothing behind.
    await deps.documents.removeFile(stored.value.bucket, stored.value.path);
    await deps.documents.deleteRecord(stored.value.id);
    return err(submitted.error);
  }
  return ok(true as const);
}

// ---------- administrator: approve or reject proof ----------
const reviewInput = z.object({
  milestoneId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300),
});

export type MilestoneReviewError = "invalid_input" | "note_required" | "not_waiting" | "failed";

export async function reviewMilestone(
  deps: { milestones: MilestoneStore },
  rawInput: unknown,
): Promise<Result<{ approved: boolean; payoutCreated: boolean }, MilestoneReviewError>> {
  const parsed = reviewInput.safeParse(rawInput);
  if (!parsed.success) return err("invalid_input");
  const { milestoneId, decision, note } = parsed.data;

  const approve = decision === "approve";
  if (!approve && note === "") return err("note_required");

  const reviewed = await deps.milestones.review({
    milestoneId,
    approve,
    note: note === "" ? null : note,
  });
  return reviewed.ok
    ? ok({ approved: approve, payoutCreated: reviewed.value.payoutCreated })
    : err(reviewed.error);
}
