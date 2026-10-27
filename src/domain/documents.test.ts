import { describe, expect, it } from "vitest";
import {
  bucketFor,
  detectFileKind,
  isUploadableType,
  MAX_UPLOAD_BYTES,
  missingRequirements,
  toTrustTier,
  trustTierLabels,
  validateUpload,
} from "./documents";

const bytes = (...values: number[]) => new Uint8Array(values);
const pdf = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34);
const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00);
const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);

describe("detectFileKind", () => {
  it("recognises PDF, JPEG and PNG by their first bytes", () => {
    expect(detectFileKind(pdf)).toBe("pdf");
    expect(detectFileKind(jpeg)).toBe("jpeg");
    expect(detectFileKind(png)).toBe("png");
  });

  it.each([
    ["an HTML page", new TextEncoder().encode("<html><script>alert(1)</script>")],
    ["a Windows program", new TextEncoder().encode("MZ\u0090\u0000")],
    ["a zip archive", bytes(0x50, 0x4b, 0x03, 0x04)],
    ["a PDF-looking file with a leading space", new TextEncoder().encode(" %PDF-1.4")],
    ["a truncated PNG", bytes(0x89, 0x50, 0x4e, 0x47)],
    ["nothing", bytes()],
  ])("rejects %s", (_label, content) => {
    expect(detectFileKind(content)).toBeNull();
  });
});

describe("validateUpload", () => {
  it("accepts a real PDF", () => {
    expect(validateUpload(pdf)).toEqual({ ok: true, value: "pdf" });
  });
  it("rejects empty, oversized and unsupported files", () => {
    expect(validateUpload(bytes())).toEqual({ ok: false, error: "empty" });
    const huge = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    huge.set(pdf);
    expect(validateUpload(huge)).toEqual({ ok: false, error: "too_large" });
    expect(validateUpload(new TextEncoder().encode("hello"))).toEqual({
      ok: false,
      error: "unsupported_type",
    });
  });
  it("accepts a file exactly at the size limit", () => {
    const exact = new Uint8Array(MAX_UPLOAD_BYTES);
    exact.set(pdf);
    expect(validateUpload(exact)).toEqual({ ok: true, value: "pdf" });
  });
});

describe("document types and buckets", () => {
  it("only lets founders upload known types", () => {
    expect(isUploadableType("id")).toBe(true);
    expect(isUploadableType("invoice")).toBe(false);
    expect(isUploadableType("../../etc/passwd")).toBe(false);
    expect(isUploadableType(undefined)).toBe(false);
  });
  it("keeps identity documents in their own bucket", () => {
    expect(bucketFor("id")).toBe("identity-documents");
    expect(bucketFor("bank_statement")).toBe("business-documents");
    expect(bucketFor("cipc")).toBe("business-documents");
  });
});

describe("missingRequirements", () => {
  it("asks for an ID and a bank statement", () => {
    expect(missingRequirements([])).toEqual(["id", "bank_statement"]);
  });
  it("counts pending and approved documents but not rejected ones", () => {
    expect(
      missingRequirements([
        { type: "id", status: "pending" },
        { type: "bank_statement", status: "verified" },
      ]),
    ).toEqual([]);
    expect(
      missingRequirements([
        { type: "id", status: "rejected" },
        { type: "bank_statement", status: "pending" },
      ]),
    ).toEqual(["id"]);
  });
  it("does not require the optional documents", () => {
    expect(
      missingRequirements([
        { type: "id", status: "pending" },
        { type: "bank_statement", status: "pending" },
      ]),
    ).toEqual([]);
  });
});

describe("trust tiers", () => {
  it("has a label for every tier and clamps unknown values to 0", () => {
    expect(Object.keys(trustTierLabels)).toHaveLength(4);
    expect(toTrustTier(2)).toBe(2);
    expect(toTrustTier(7)).toBe(0);
    expect(toTrustTier(-1)).toBe(0);
  });
});
