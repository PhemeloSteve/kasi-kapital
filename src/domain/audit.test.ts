import { describe, expect, it } from "vitest";
import { auditActionTone, parseAuditFilter, parseAuditPage, shortId } from "./audit";

describe("auditActionTone", () => {
  it("marks harmful actions red", () => {
    expect(auditActionTone("business.suspended")).toBe("red");
    expect(auditActionTone("document.rejected")).toBe("red");
    expect(auditActionTone("payout.failed")).toBe("red");
  });

  it("marks approvals and reinstatements green, not red", () => {
    expect(auditActionTone("business.unsuspended")).toBe("green");
    expect(auditActionTone("milestone.approved")).toBe("green");
    expect(auditActionTone("payout.paid")).toBe("green");
  });

  it("marks changes amber and everything else grey", () => {
    expect(auditActionTone("business.verification_changed")).toBe("amber");
    expect(auditActionTone("contribution.started")).toBe("amber");
    expect(auditActionTone("document.viewed")).toBe("slate");
    expect(auditActionTone("something-new")).toBe("slate");
    expect(auditActionTone("")).toBe("slate");
  });
});

describe("shortId", () => {
  it("keeps the first 8 characters", () => {
    expect(shortId("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567");
    expect(shortId("abc")).toBe("abc");
  });
});

describe("parseAuditFilter", () => {
  it("accepts code-like words and trims them", () => {
    expect(parseAuditFilter(" business.suspended ")).toBe("business.suspended");
    expect(parseAuditFilter("businesses")).toBe("businesses");
  });

  it("ignores empty, odd or over-long values", () => {
    expect(parseAuditFilter("")).toBeNull();
    expect(parseAuditFilter("a b")).toBeNull();
    expect(parseAuditFilter("x),or(1=1")).toBeNull();
    expect(parseAuditFilter("a".repeat(61))).toBeNull();
    expect(parseAuditFilter(undefined)).toBeNull();
    expect(parseAuditFilter(["a"])).toBeNull();
  });
});

describe("parseAuditPage", () => {
  it("accepts whole numbers from 1 to 1000", () => {
    expect(parseAuditPage("1")).toBe(1);
    expect(parseAuditPage("7")).toBe(7);
    expect(parseAuditPage("1000")).toBe(1000);
  });

  it("falls back to page 1 for anything else", () => {
    expect(parseAuditPage("0")).toBe(1);
    expect(parseAuditPage("-3")).toBe(1);
    expect(parseAuditPage("2.5")).toBe(1);
    expect(parseAuditPage("1001")).toBe(1);
    expect(parseAuditPage("abc")).toBe(1);
    expect(parseAuditPage(undefined)).toBe(1);
  });
});
