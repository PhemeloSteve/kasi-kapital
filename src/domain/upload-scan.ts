import type { FileKind } from "./documents";
import { sanitiseJpeg, sanitisePng } from "./image-sanitise";
import { scanPdf } from "./pdf-scan";
import { err, ok, type Result } from "./result";

export type ScanProblem = "active_content" | "encrypted_pdf" | "malformed" | "too_complex";

/**
 * The last check before a file is stored. A PDF is refused if it can run scripts, carry attachments or is
 * locked; it is stored exactly as uploaded. A JPEG or PNG is checked and stored without its hidden
 * metadata (location, camera, comments, appended files). The bytes returned are the ones to store.
 */
export async function scanUpload(
  kind: FileKind,
  bytes: Uint8Array,
): Promise<Result<Uint8Array, ScanProblem>> {
  if (kind === "pdf") {
    const scanned = await scanPdf(bytes);
    return scanned.ok ? ok(bytes) : err(scanned.error);
  }
  const clean = kind === "jpeg" ? sanitiseJpeg(bytes) : sanitisePng(bytes);
  return clean.ok ? ok(clean.value) : err(clean.error);
}
