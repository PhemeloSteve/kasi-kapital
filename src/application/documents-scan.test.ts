import { describe, expect, it } from "vitest";
import { ok } from "@/domain/result";
import { storeDocument } from "./documents";
import type { BusinessRecord, BusinessStore, DocumentStore } from "./ports";

const DOC = "11111111-1111-4111-8111-111111111111";
const enc = (text: string) => new TextEncoder().encode(text);

const business: BusinessRecord = {
  id: "biz-1",
  name: "Mama T Bakery",
  category: "bakery",
  description: null,
  suburb: "Soweto",
  hasLocation: true,
  youtubeUrl: null,
  facebookUrl: null,
  linkedinUrl: null,
  verification: "unverified",
  trustTier: 0,
};

function setup() {
  const uploaded: Array<{ bytes: Uint8Array; contentType: string }> = [];
  let recorded = 0;
  const documents = {
    upload: async (input: { bytes: Uint8Array; contentType: string }) => {
      uploaded.push(input);
      return ok(true as const);
    },
    createRecord: async () => {
      recorded += 1;
      return ok(true as const);
    },
    removeFile: async () => {},
  } as unknown as DocumentStore;
  const store = { getMyBusiness: async () => business } as unknown as BusinessStore;
  const deps = { business: store, documents, newId: () => DOC };
  return { deps, uploaded, recordedCount: () => recorded };
}

const cleanPdf = enc("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

describe("storeDocument and the upload scan", () => {
  it("still stores a clean PDF exactly as it was uploaded", async () => {
    const { deps, uploaded } = setup();
    const result = await storeDocument(deps, "u1", "bank_statement", cleanPdf);
    expect(result.ok).toBe(true);
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]?.bytes).toEqual(cleanPdf);
    expect(uploaded[0]?.contentType).toBe("application/pdf");
  });

  it("refuses a PDF that can run scripts, and stores and records nothing", async () => {
    const { deps, uploaded, recordedCount } = setup();
    const result = await storeDocument(
      deps,
      "u1",
      "id",
      enc("%PDF-1.4\n<< /S /JavaScript /JS (app.alert(1)) >>\n%%EOF\n"),
    );
    expect(result).toEqual({ ok: false, error: "unsafe_file" });
    expect(uploaded).toHaveLength(0);
    expect(recordedCount()).toBe(0);
  });

  it("refuses a password-protected PDF with its own message", async () => {
    const { deps, uploaded } = setup();
    const locked = enc("%PDF-1.4\ntrailer << /Encrypt 9 0 R >>\n%%EOF\n");
    const result = await storeDocument(deps, "u1", "id", locked);
    expect(result).toEqual({ ok: false, error: "encrypted_pdf" });
    expect(uploaded).toHaveLength(0);
  });

  it("refuses an image that is not really one", async () => {
    const { deps, uploaded } = setup();
    const broken = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = await storeDocument(deps, "u1", "id", broken);
    expect(result).toEqual({ ok: false, error: "unreadable_file" });
    expect(uploaded).toHaveLength(0);
  });

  it("stores the cleaned image, not the original with its hidden extras", async () => {
    const { deps, uploaded } = setup();
    const photo = Uint8Array.from([
      0xff,
      0xd8,
      0xff,
      0xda,
      0x00,
      0x08,
      1,
      1,
      0,
      0,
      0x3f,
      0,
      0x12,
      0xff,
      0xd9,
      ...enc("SMUGGLED-FILE"),
    ]);
    const result = await storeDocument(deps, "u1", "id", photo);
    expect(result.ok).toBe(true);
    expect(uploaded).toHaveLength(1);
    expect(Buffer.from(uploaded[0]?.bytes ?? []).includes("SMUGGLED-FILE")).toBe(false);
    expect(uploaded[0]?.contentType).toBe("image/jpeg");
  });
});
