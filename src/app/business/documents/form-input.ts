import { MAX_UPLOAD_BYTES } from "@/domain/documents";

/**
 * Reads the upload form. Returns `bytes: null` when no file was chosen (browsers send an empty,
 * nameless file in that case). At most one byte over the limit is read, so a huge file can never
 * fill the server's memory; the size rule then rejects it.
 */
export async function readUploadForm(
  formData: FormData,
): Promise<{ type: string; bytes: Uint8Array | null }> {
  const rawType = formData.get("type");
  const type = typeof rawType === "string" ? rawType : "";

  const file = formData.get("file");
  if (!(file instanceof File) || (file.size === 0 && file.name === ""))
    return { type, bytes: null };

  const bytes = new Uint8Array(await file.slice(0, MAX_UPLOAD_BYTES + 1).arrayBuffer());
  return { type, bytes };
}

/** Reads the milestone-proof form: which milestone, which goal page to return to, and the file. */
export async function readProofForm(
  formData: FormData,
): Promise<{ milestoneId: string; goalId: string; bytes: Uint8Array | null }> {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const { bytes } = await readUploadForm(formData);
  return { milestoneId: text("milestoneId"), goalId: text("goalId"), bytes };
}
