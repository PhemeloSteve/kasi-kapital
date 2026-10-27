import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { reviewMilestone, submitMilestoneProof } from "./milestones";
import type { BusinessRecord, BusinessStore, DocumentStore, MilestoneStore } from "./ports";

const MILESTONE = "11111111-1111-4111-8111-111111111111";
const DOC = "33333333-3333-4333-8333-333333333333";
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
  verification: "verified",
  trustTier: 2,
};

const businessStore: BusinessStore = {
  getMyBusiness: async () => business,
  saveMyBusiness: async () => ok({ id: "biz-1" }),
  createGoal: async () => ok({ id: "g" }),
  listGoals: async () => [],
};

function makeDocs(overrides: Partial<DocumentStore> = {}): DocumentStore {
  return {
    listMyDocuments: async () => [],
    upload: async () => ok(true as const),
    createRecord: async () => ok(true as const),
    removeFile: async () => {},
    getDocument: async () => null,
    deleteRecord: async () => ok(true as const),
    submitForReview: async () => ok(true as const),
    listReviewQueue: async () => [],
    reviewDocument: async () => ok({ businessStatus: "verified" as const, trustTier: 2 as const }),
    createViewUrl: async () => ok({ url: "https://example.test" }),
    ...overrides,
  };
}

function makeMilestones(overrides: Partial<MilestoneStore> = {}): MilestoneStore {
  return {
    submitProof: async () => ok(true as const),
    listProofQueue: async () => [],
    review: async () => ok({ payoutCreated: false }),
    listPendingPayouts: async () => [],
    ...overrides,
  };
}

describe("submitMilestoneProof", () => {
  const newId = () => DOC;

  it("stores the invoice privately, then attaches it to the milestone", async () => {
    const upload = vi.fn(async () => ok(true as const));
    const createRecord = vi.fn(async () => ok(true as const));
    const submitProof = vi.fn(async () => ok(true as const));
    const result = await submitMilestoneProof(
      {
        business: businessStore,
        documents: makeDocs({ upload, createRecord }),
        milestones: makeMilestones({ submitProof }),
        newId,
      },
      "u1",
      { milestoneId: MILESTONE, bytes: pdf },
    );
    expect(result).toEqual({ ok: true, value: true });
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "business-documents", path: `biz-1/${DOC}.pdf` }),
    );
    expect(createRecord).toHaveBeenCalledWith({
      id: DOC,
      businessId: "biz-1",
      type: "invoice",
      path: `biz-1/${DOC}.pdf`,
    });
    expect(submitProof).toHaveBeenCalledWith({ milestoneId: MILESTONE, documentId: DOC });
  });

  it("removes the file and its record when the proof is refused", async () => {
    const removeFile = vi.fn(async () => {});
    const deleteRecord = vi.fn(async () => ok(true as const));
    const result = await submitMilestoneProof(
      {
        business: businessStore,
        documents: makeDocs({ removeFile, deleteRecord }),
        milestones: makeMilestones({ submitProof: async () => err("not_allowed" as const) }),
        newId,
      },
      "u1",
      { milestoneId: MILESTONE, bytes: pdf },
    );
    expect(result).toEqual({ ok: false, error: "not_allowed" });
    expect(removeFile).toHaveBeenCalledWith("business-documents", `biz-1/${DOC}.pdf`);
    expect(deleteRecord).toHaveBeenCalledWith(DOC);
  });

  it.each([
    ["a malformed milestone id", { milestoneId: "../x", bytes: pdf }, "invalid_milestone"],
    ["no file", { milestoneId: MILESTONE, bytes: null }, "no_file"],
    [
      "a web page instead of a document",
      { milestoneId: MILESTONE, bytes: new TextEncoder().encode("<script>1</script>") },
      "unsupported_type",
    ],
  ])("rejects %s before storing anything", async (_label, input, code) => {
    const upload = vi.fn();
    const result = await submitMilestoneProof(
      {
        business: businessStore,
        documents: makeDocs({ upload }),
        milestones: makeMilestones(),
        newId,
      },
      "u1",
      input,
    );
    expect(result).toEqual({ ok: false, error: code });
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("reviewMilestone", () => {
  it("approves with no note and reports whether money was released", async () => {
    const review = vi.fn(async () => ok({ payoutCreated: true }));
    const result = await reviewMilestone(
      { milestones: makeMilestones({ review }) },
      { milestoneId: MILESTONE, decision: "approve", note: "" },
    );
    expect(result).toEqual({ ok: true, value: { approved: true, payoutCreated: true } });
    expect(review).toHaveBeenCalledWith({ milestoneId: MILESTONE, approve: true, note: null });
  });

  it("insists on a reason to reject, before calling the database", async () => {
    const review = vi.fn();
    expect(
      await reviewMilestone(
        { milestones: makeMilestones({ review }) },
        { milestoneId: MILESTONE, decision: "reject", note: "  " },
      ),
    ).toEqual({
      ok: false,
      error: "note_required",
    });
    expect(review).not.toHaveBeenCalled();
  });

  it.each([
    ["a bad id", { milestoneId: "x", decision: "approve", note: "" }],
    ["an unknown decision", { milestoneId: MILESTONE, decision: "pay", note: "" }],
    ["an over-long note", { milestoneId: MILESTONE, decision: "reject", note: "x".repeat(301) }],
  ])("rejects %s", async (_label, input) => {
    expect(await reviewMilestone({ milestones: makeMilestones() }, input)).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });

  it("reports a milestone that is not waiting for review", async () => {
    const milestones = makeMilestones({ review: async () => err("not_waiting" as const) });
    expect(
      await reviewMilestone(
        { milestones },
        { milestoneId: MILESTONE, decision: "approve", note: "" },
      ),
    ).toEqual({ ok: false, error: "not_waiting" });
  });
});
