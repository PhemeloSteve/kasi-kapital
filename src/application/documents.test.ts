import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { deleteDocument, reviewDocument, submitForReview, uploadDocument } from "./documents";
import type { BusinessRecord, BusinessStore, DocumentRecord, DocumentStore } from "./ports";

const DOC = "11111111-1111-4111-8111-111111111111";
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

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

function makeBusiness(overrides: Partial<BusinessRecord> = {}): BusinessStore {
  return {
    getMyBusiness: async () => ({ ...business, ...overrides }),
    saveMyBusiness: async () => ok({ id: "biz-1" }),
    createGoal: async () => ok({ id: "g" }),
    listGoals: async () => [],
  };
}

function makeDocs(overrides: Partial<DocumentStore> = {}): DocumentStore {
  return {
    listMyDocuments: async () => [],
    upload: async () => ok(true as const),
    createRecord: async () => ok(true as const),
    removeFile: async () => {},
    getDocument: async () => ({
      id: DOC,
      type: "bank_statement",
      path: `biz-1/${DOC}.pdf`,
      status: "pending",
    }),
    deleteRecord: async () => ok(true as const),
    submitForReview: async () => ok(true as const),
    listReviewQueue: async () => [],
    reviewDocument: async () => ok({ businessStatus: "verified" as const, trustTier: 2 as const }),
    createViewUrl: async () => ok({ url: "https://example.test/signed" }),
    ...overrides,
  };
}

const rec = (type: string, status: DocumentRecord["status"]): DocumentRecord => ({
  id: type,
  type,
  status,
  reviewNote: null,
  createdAt: "2026-01-01",
});

describe("uploadDocument", () => {
  const newId = () => DOC;

  it("stores the file in the business folder, in the right bucket, then records it", async () => {
    const upload = vi.fn(async () => ok(true as const));
    const createRecord = vi.fn(async () => ok(true as const));
    const result = await uploadDocument(
      { business: makeBusiness(), documents: makeDocs({ upload, createRecord }), newId },
      "u1",
      { type: "id", bytes: pdf },
    );

    expect(result).toEqual({ ok: true, value: { id: DOC } });
    expect(upload).toHaveBeenCalledWith({
      bucket: "identity-documents",
      path: `biz-1/${DOC}.pdf`,
      bytes: pdf,
      contentType: "application/pdf",
    });
    expect(createRecord).toHaveBeenCalledWith({
      id: DOC,
      businessId: "biz-1",
      type: "id",
      path: `biz-1/${DOC}.pdf`,
    });
  });

  it("puts business paperwork in the business bucket", async () => {
    const upload = vi.fn(async () => ok(true as const));
    await uploadDocument(
      { business: makeBusiness(), documents: makeDocs({ upload }), newId },
      "u1",
      { type: "bank_statement", bytes: pdf },
    );
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ bucket: "business-documents" }));
  });

  it.each([
    ["an unknown document type", { type: "invoice", bytes: pdf }, "invalid_type"],
    ["a path-like type", { type: "../etc", bytes: pdf }, "invalid_type"],
    ["no file", { type: "id", bytes: null }, "no_file"],
    ["an empty file", { type: "id", bytes: new Uint8Array() }, "empty"],
    [
      "a web page pretending to be a document",
      { type: "id", bytes: new TextEncoder().encode("<script>alert(1)</script>") },
      "unsupported_type",
    ],
  ])("rejects %s before touching storage", async (_label, input, code) => {
    const upload = vi.fn();
    const result = await uploadDocument(
      { business: makeBusiness(), documents: makeDocs({ upload }), newId },
      "u1",
      input,
    );
    expect(result).toEqual({ ok: false, error: code });
    expect(upload).not.toHaveBeenCalled();
  });

  it("requires a business, and refuses suspended ones", async () => {
    const none: BusinessStore = { ...makeBusiness(), getMyBusiness: async () => null };
    expect(
      await uploadDocument({ business: none, documents: makeDocs(), newId }, "u", {
        type: "id",
        bytes: pdf,
      }),
    ).toEqual({ ok: false, error: "no_business" });
    expect(
      await uploadDocument(
        { business: makeBusiness({ verification: "suspended" }), documents: makeDocs(), newId },
        "u",
        { type: "id", bytes: pdf },
      ),
    ).toEqual({ ok: false, error: "suspended" });
  });

  it("removes the uploaded file again if recording it fails", async () => {
    const removeFile = vi.fn(async () => {});
    const docs = makeDocs({ createRecord: async () => err("limit_reached" as const), removeFile });
    const result = await uploadDocument(
      { business: makeBusiness(), documents: docs, newId },
      "u1",
      { type: "id", bytes: pdf },
    );
    expect(result).toEqual({ ok: false, error: "limit_reached" });
    expect(removeFile).toHaveBeenCalledWith("identity-documents", `biz-1/${DOC}.pdf`);
  });

  it("does not record anything if the upload itself fails", async () => {
    const createRecord = vi.fn();
    const docs = makeDocs({ upload: async () => err("failed" as const), createRecord });
    expect(
      await uploadDocument({ business: makeBusiness(), documents: docs, newId }, "u1", {
        type: "id",
        bytes: pdf,
      }),
    ).toEqual({ ok: false, error: "upload_failed" });
    expect(createRecord).not.toHaveBeenCalled();
  });
});

describe("deleteDocument", () => {
  it("removes the file first, then the record", async () => {
    const order: string[] = [];
    const docs = makeDocs({
      removeFile: async () => void order.push("file"),
      deleteRecord: async () => (order.push("record"), ok(true as const)),
    });
    expect(await deleteDocument({ business: makeBusiness(), documents: docs }, DOC)).toEqual({
      ok: true,
      value: true,
    });
    expect(order).toEqual(["file", "record"]);
  });

  it("refuses approved documents and never touches storage", async () => {
    const removeFile = vi.fn();
    const docs = makeDocs({
      getDocument: async () => ({ id: DOC, type: "id", path: "p", status: "verified" as const }),
      removeFile,
    });
    expect(await deleteDocument({ business: makeBusiness(), documents: docs }, DOC)).toEqual({
      ok: false,
      error: "approved_locked",
    });
    expect(removeFile).not.toHaveBeenCalled();
  });

  it("treats someone else's document (not visible to this user) as not found", async () => {
    const docs = makeDocs({ getDocument: async () => null });
    expect(await deleteDocument({ business: makeBusiness(), documents: docs }, DOC)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("rejects malformed ids", async () => {
    expect(
      await deleteDocument({ business: makeBusiness(), documents: makeDocs() }, "not-a-uuid"),
    ).toEqual({ ok: false, error: "invalid_input" });
  });
});

describe("submitForReview", () => {
  it("lists what is missing instead of submitting", async () => {
    const submit = vi.fn();
    const docs = makeDocs({
      listMyDocuments: async () => [rec("id", "pending")],
      submitForReview: submit,
    });
    expect(await submitForReview({ business: makeBusiness(), documents: docs }, "u")).toEqual({
      ok: false,
      error: { code: "missing_documents", missing: ["bank_statement"] },
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits once an ID and a bank statement are uploaded", async () => {
    const submit = vi.fn(async () => ok(true as const));
    const docs = makeDocs({
      listMyDocuments: async () => [rec("id", "pending"), rec("bank_statement", "pending")],
      submitForReview: submit,
    });
    expect(await submitForReview({ business: makeBusiness(), documents: docs }, "u")).toEqual({
      ok: true,
      value: true,
    });
    expect(submit).toHaveBeenCalledWith("biz-1");
  });

  it("allows resubmitting after a rejection but not twice in a row", async () => {
    const docs = makeDocs({
      listMyDocuments: async () => [rec("id", "verified"), rec("bank_statement", "pending")],
    });
    expect(
      (
        await submitForReview(
          { business: makeBusiness({ verification: "rejected" }), documents: docs },
          "u",
        )
      ).ok,
    ).toBe(true);
    for (const verification of ["pending", "verified"] as const) {
      expect(
        await submitForReview({ business: makeBusiness({ verification }), documents: docs }, "u"),
      ).toEqual({ ok: false, error: { code: "already_submitted" } });
    }
  });

  it("falls back to a generic failure when the database refuses", async () => {
    const docs = makeDocs({
      listMyDocuments: async () => [rec("id", "pending"), rec("bank_statement", "pending")],
      submitForReview: async () => err("failed" as const),
    });
    expect(await submitForReview({ business: makeBusiness(), documents: docs }, "u")).toEqual({
      ok: false,
      error: { code: "failed" },
    });
  });
});

describe("reviewDocument", () => {
  it("approves with or without a note", async () => {
    const review = vi.fn(async () =>
      ok({ businessStatus: "verified" as const, trustTier: 2 as const }),
    );
    const result = await reviewDocument(
      { documents: makeDocs({ reviewDocument: review }) },
      { documentId: DOC, decision: "approve", note: "" },
    );
    expect(result).toEqual({
      ok: true,
      value: { approved: true, businessStatus: "verified", trustTier: 2 },
    });
    expect(review).toHaveBeenCalledWith({ documentId: DOC, approve: true, note: null });
  });

  it("insists on a reason when rejecting, before calling the database", async () => {
    const review = vi.fn();
    const docs = makeDocs({ reviewDocument: review });
    expect(
      await reviewDocument(
        { documents: docs },
        { documentId: DOC, decision: "reject", note: "   " },
      ),
    ).toEqual({ ok: false, error: "note_required" });
    expect(review).not.toHaveBeenCalled();
  });

  it("passes a rejection reason through", async () => {
    const review = vi.fn(async () =>
      ok({ businessStatus: "rejected" as const, trustTier: 1 as const }),
    );
    await reviewDocument(
      { documents: makeDocs({ reviewDocument: review }) },
      { documentId: DOC, decision: "reject", note: " Scan is blurry " },
    );
    expect(review).toHaveBeenCalledWith({
      documentId: DOC,
      approve: false,
      note: "Scan is blurry",
    });
  });

  it.each([
    ["a bad id", { documentId: "x", decision: "approve", note: "" }],
    ["an unknown decision", { documentId: DOC, decision: "maybe", note: "" }],
    ["an over-long note", { documentId: DOC, decision: "reject", note: "x".repeat(301) }],
  ])("rejects %s", async (_label, input) => {
    expect(await reviewDocument({ documents: makeDocs() }, input)).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });

  it("reports an already-reviewed document", async () => {
    const docs = makeDocs({ reviewDocument: async () => err("already_reviewed" as const) });
    expect(
      await reviewDocument({ documents: docs }, { documentId: DOC, decision: "approve", note: "" }),
    ).toEqual({ ok: false, error: "already_reviewed" });
  });
});
