import { describe, expect, it } from "vitest";
import { describeAdminNotification, describeRetentionAlert } from "./admin-notifications";

describe("describeAdminNotification", () => {
  it("notifies when a business becomes pending", () => {
    const n = describeAdminNotification({
      type: "UPDATE",
      table: "businesses",
      record: { name: "Mama T Bakery", verification: "pending" },
      old_record: { name: "Mama T Bakery", verification: "unverified" },
    });
    expect(n?.subject).toBe("New business submitted for verification: Mama T Bakery");
  });

  it("does not notify for other edits of a business that is already pending", () => {
    expect(
      describeAdminNotification({
        type: "UPDATE",
        table: "businesses",
        record: { name: "Mama T Bakery", verification: "pending" },
        old_record: { name: "Mama T", verification: "pending" },
      }),
    ).toBeNull();
  });

  it("does not notify for other statuses", () => {
    for (const verification of ["unverified", "verified", "rejected", "suspended"]) {
      expect(
        describeAdminNotification({
          type: "UPDATE",
          table: "businesses",
          record: { name: "X", verification },
          old_record: { name: "X", verification: "pending" },
        }),
      ).toBeNull();
    }
  });

  it("notifies when milestone proof arrives, but only once", () => {
    const first = describeAdminNotification({
      type: "UPDATE",
      table: "milestones",
      record: { title: "Buy the oven", status: "proof_submitted" },
      old_record: { title: "Buy the oven", status: "pending" },
    });
    expect(first?.subject).toBe("Milestone proof submitted");
    expect(first?.text).toContain("Buy the oven");
    expect(
      describeAdminNotification({
        type: "UPDATE",
        table: "milestones",
        record: { title: "Buy the oven", status: "proof_submitted" },
        old_record: { title: "Buy the oven", status: "proof_submitted" },
      }),
    ).toBeNull();
  });

  it("ignores other tables, other events and malformed bodies", () => {
    expect(
      describeAdminNotification({ type: "UPDATE", table: "profiles", record: { x: 1 } }),
    ).toBeNull();
    expect(
      describeAdminNotification({
        type: "DELETE",
        table: "businesses",
        record: { verification: "pending" },
      }),
    ).toBeNull();
    expect(describeAdminNotification({ type: "UPDATE", table: "businesses" })).toBeNull();
    expect(
      describeAdminNotification({ type: "UPDATE", table: "businesses", record: [1, 2] }),
    ).toBeNull();
    expect(describeAdminNotification({})).toBeNull();
  });

  it("keeps line breaks out of the subject", () => {
    const n = describeAdminNotification({
      type: "UPDATE",
      table: "businesses",
      record: { name: "Evil\r\nBcc: someone@example.com", verification: "pending" },
      old_record: { verification: "unverified" },
    });
    expect(n?.subject).not.toMatch(/[\r\n]/);
  });
});

describe("describeAdminNotification: audit log alerts", () => {
  const insert = (record: Record<string, unknown>, type = "INSERT") =>
    describeAdminNotification({ type, table: "audit_log", record });

  it("alerts on the actions that move money or hide a business", () => {
    for (const [action, words] of [
      ["business.suspended", "suspended"],
      ["business.unsuspended", "reinstated"],
      ["business.closed", "closed"],
      ["payout.created", "created"],
      ["payout.paid", "paid"],
    ] as const) {
      const n = insert({ action, entity: "businesses", entity_id: "abc" });
      expect(n?.subject.toLowerCase()).toContain(words);
    }
  });

  it("leaves the reason an administrator typed out of the email", () => {
    const n = insert({
      action: "business.suspended",
      entity: "businesses",
      entity_id: "abc",
      details: { reason: "private reason text" },
    });
    expect(n?.text).not.toContain("private reason text");
  });

  it("ignores every other action, and anything that is not an insert", () => {
    expect(insert({ action: "document.viewed", entity: "documents", entity_id: "1" })).toBeNull();
    expect(
      insert({ action: "contribution.held", entity: "contributions", entity_id: "1" }),
    ).toBeNull();
    expect(insert({ action: "constructor" })).toBeNull();
    expect(insert({ action: "business.suspended" }, "UPDATE")).toBeNull();
    expect(insert({ action: "business.suspended" }, "DELETE")).toBeNull();
  });

  it("keeps an entity name on one line", () => {
    const n = insert({
      action: "payout.paid",
      entity: "payouts\nBcc: x@evil.example",
      entity_id: "1",
    });
    expect(n?.text).not.toMatch(/\n.*Bcc/);
  });
});

describe("describeRetentionAlert", () => {
  it("says nothing about a clean run, even an empty one", () => {
    expect(
      describeRetentionAlert({ ok: true, found: 0, filesRemoved: 0, recordsDeleted: 0, failed: 0 }),
    ).toBeNull();
    expect(
      describeRetentionAlert({ ok: true, found: 3, filesRemoved: 3, recordsDeleted: 3, failed: 0 }),
    ).toBeNull();
  });

  it("alerts when some documents could not be deleted", () => {
    const n = describeRetentionAlert({
      ok: true,
      found: 5,
      filesRemoved: 3,
      recordsDeleted: 3,
      failed: 2,
    });
    expect(n?.subject).toBe("Retention run left documents behind");
    expect(n?.text).toContain("5");
    expect(n?.text).toContain("2");
  });

  it("alerts when the run itself failed", () => {
    expect(describeRetentionAlert({ ok: false })?.subject).toBe("Retention run failed");
  });
});
