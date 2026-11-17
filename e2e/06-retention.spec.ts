import { expect, test } from "@playwright/test";
import { E2E_CRON_SECRET } from "./support/constants";
import { loadSeed, serviceClient } from "./support/seed";

const seed = loadSeed();
const db = serviceClient();
const BUCKET = "business-documents";
const DAY_MS = 24 * 60 * 60 * 1000;

/** A rejected document with a real stored file, rejected the given number of days ago. */
async function plantRejectedDocument(daysAgo: number) {
  const path = `${seed.business.id}/retention-${seed.runId}-${daysAgo}d.pdf`;
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from("%PDF-1.4\n% old\n%%EOF\n"), { contentType: "application/pdf" });
  expect(uploadError, "planting the file").toBeNull();

  const { data, error } = await db
    .from("documents")
    .insert({
      business_id: seed.business.id,
      type: "other",
      storage_path: path,
      status: "rejected",
      reviewed_at: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
    })
    .select("id")
    .single();
  expect(error, "planting the record").toBeNull();
  return { id: data?.id as string, path };
}

const recordExists = async (id: string) => {
  const { data } = await db.from("documents").select("id").eq("id", id);
  return (data ?? []).length === 1;
};

const fileExists = async (path: string) => {
  const { error } = await db.storage.from(BUCKET).download(path);
  return error === null;
};

test.describe("retention of rejected documents", () => {
  test("the cron route refuses anyone without the secret", async ({ request }) => {
    expect((await request.get("/api/cron/retention")).status()).toBe(401);
    const wrong = await request.get("/api/cron/retention", {
      headers: { authorization: "Bearer not-the-secret-at-all-0123456789" },
    });
    expect(wrong.status()).toBe(401);
  });

  test("an expired rejected document is deleted, file and record, and a recent one is kept", async ({
    request,
  }) => {
    const expired = await plantRejectedDocument(40);
    const recent = await plantRejectedDocument(1);
    expect(await fileExists(expired.path)).toBe(true);

    const response = await request.get("/api/cron/retention", {
      headers: { authorization: `Bearer ${E2E_CRON_SECRET}` },
    });
    expect(response.status()).toBe(200);
    const summary = await response.json();
    expect(summary.ok).toBe(true);
    expect(summary.recordsDeleted).toBeGreaterThanOrEqual(1);

    expect(await recordExists(expired.id), "the expired record").toBe(false);
    expect(await fileExists(expired.path), "the expired file").toBe(false);
    expect(await recordExists(recent.id), "the recent record").toBe(true);
    expect(await fileExists(recent.path), "the recent file").toBe(true);

    const { data: audit } = await db
      .from("audit_log")
      .select("details")
      .eq("action", "document.purged")
      .eq("entity_id", expired.id);
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(".pdf");
  });
});
