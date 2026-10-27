import { err, ok, type Result } from "./result";

/** Document types a founder may upload. (Invoices for milestone proof arrive in a later step.) */
export const uploadableTypes = ["id", "bank_statement", "cipc", "tax_return"] as const;
export type UploadableType = (typeof uploadableTypes)[number];

export type DocumentStatus = "pending" | "verified" | "rejected";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB, kept under common hosting request limits

export const documentInfo: Record<
  UploadableType,
  { label: string; hint: string; required: boolean }
> = {
  id: {
    label: "Your ID document",
    hint: "Smart ID card, green ID book or passport. Used only to confirm who you are.",
    required: true,
  },
  bank_statement: {
    label: "Business bank statement",
    hint: "From the last 3 months. It proves the business is trading. Black out anything you don't want us to see except the name, dates and amounts.",
    required: true,
  },
  cipc: {
    label: "CIPC company registration",
    hint: "Only if your business is registered. It earns the highest trust level.",
    required: false,
  },
  tax_return: {
    label: "Tax return or SARS letter",
    hint: "Optional extra proof that the business is real.",
    required: false,
  },
};

export function isUploadableType(value: unknown): value is UploadableType {
  return typeof value === "string" && (uploadableTypes as readonly string[]).includes(value);
}

/** Identity documents are kept in their own bucket, apart from business paperwork. */
export function bucketFor(type: string): "identity-documents" | "business-documents" {
  return type === "id" ? "identity-documents" : "business-documents";
}

// ---------- what a file really is ----------
export type FileKind = "pdf" | "jpeg" | "png";

export const fileKinds: Record<FileKind, { extension: string; contentType: string }> = {
  pdf: { extension: "pdf", contentType: "application/pdf" },
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  png: { extension: "png", contentType: "image/png" },
};

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);

/**
 * Identifies a file by its first bytes. The browser's claimed type and the file name can be faked;
 * the content cannot, so this is what decides whether a file is accepted.
 */
export function detectFileKind(bytes: Uint8Array): FileKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  return null;
}

export type UploadProblem = "empty" | "too_large" | "unsupported_type";

export function validateUpload(bytes: Uint8Array): Result<FileKind, UploadProblem> {
  if (bytes.length === 0) return err("empty");
  if (bytes.length > MAX_UPLOAD_BYTES) return err("too_large");
  const kind = detectFileKind(bytes);
  return kind ? ok(kind) : err("unsupported_type");
}

// ---------- what a business still has to provide ----------
/** A required document counts once it is uploaded and not rejected (pending or approved). */
export function missingRequirements(
  documents: ReadonlyArray<{ type: string; status: DocumentStatus }>,
): UploadableType[] {
  return uploadableTypes.filter(
    (type) =>
      documentInfo[type].required &&
      !documents.some((d) => d.type === type && d.status !== "rejected"),
  );
}

// ---------- trust levels ----------
export type TrustTier = 0 | 1 | 2 | 3;

export const trustTierLabels: Record<TrustTier, string> = {
  0: "No checks completed yet",
  1: "Identity checked",
  2: "Verified business",
  3: "Verified and registered",
};

export function toTrustTier(value: number): TrustTier {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}
