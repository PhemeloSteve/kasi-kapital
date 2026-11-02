"use server";

import { redirect } from "next/navigation";
import { deleteDocument, submitForReview, uploadDocument } from "@/application/documents";
import { requireUser } from "@/app/_lib/guard";
import { RATE_LIMIT_MESSAGE } from "@/app/_lib/rate-limit";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";
import { createRateLimiter } from "@/infrastructure/supabase/rate-limiter";
import { readUploadForm } from "./form-input";
import { uploadMessages } from "./messages";

export type UploadState = { status: "idle" | "error"; message?: string };

const deps = () => ({ business: createBusinessStore(), documents: createDocumentStore() });

// Server actions are public endpoints, so each one re-checks who is calling.
export async function uploadDocumentAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireUser(["business"]);
  if (!(await createRateLimiter().allow("upload")))
    return { status: "error", message: RATE_LIMIT_MESSAGE };
  const input = await readUploadForm(formData);

  const result = await uploadDocument(
    { ...deps(), newId: () => crypto.randomUUID() },
    user.userId,
    input,
  );
  if (!result.ok) return { status: "error", message: uploadMessages[result.error] };
  redirect("/business/documents?notice=uploaded");
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  await requireUser(["business"]);
  const result = await deleteDocument(deps(), formData.get("documentId"));
  redirect(
    result.ok ? "/business/documents?notice=deleted" : "/business/documents?error=delete_failed",
  );
}

export async function submitForReviewAction(): Promise<void> {
  const user = await requireUser(["business"]);
  const result = await submitForReview(deps(), user.userId);
  if (result.ok) redirect("/business/documents?notice=submitted");

  const code = result.error.code;
  if (code === "no_business") redirect("/business/profile");
  redirect(
    `/business/documents?error=${code === "missing_documents" ? "missing" : code === "already_submitted" ? "already_submitted" : "failed"}`,
  );
}
