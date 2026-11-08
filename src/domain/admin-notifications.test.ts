import { describe, expect, it } from "vitest";
import { describeAdminNotification } from "./admin-notifications";

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
