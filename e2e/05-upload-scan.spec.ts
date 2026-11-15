import { expect, test } from "@playwright/test";
import { logIn, newActor } from "./support/actors";
import { loadSeed, serviceClient } from "./support/seed";

const seed = loadSeed();
const db = serviceClient();

test.describe("uploads are checked when they arrive", () => {
  test("a PDF that can run scripts is refused, with a clear message", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await logIn(page, seed.founder.email);
    await page.goto("/business/documents");

    await page.locator("#type").selectOption("tax_return");
    await page.locator("#file").setInputFiles({
      name: "statement.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n<< /S /JavaScript /JS (app.alert(1)) >>\n%%EOF\n"),
    });
    await page.getByRole("button", { name: "Upload document" }).click();

    await expect(page.getByText(/can run scripts or carries attachments/)).toBeVisible();
    await context.close();
  });

  test("a photo is stored without what was hidden inside it", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await logIn(page, seed.founder.email);
    await page.goto("/business/documents");

    // A tiny valid JPEG with a second file appended after its end.
    const photo = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0xff, 0xd9]),
      Buffer.from("SMUGGLED-FILE"),
    ]);
    await page.locator("#type").selectOption("tax_return");
    await page
      .locator("#file")
      .setInputFiles({ name: "letter.jpg", mimeType: "image/jpeg", buffer: photo });
    await page.getByRole("button", { name: "Upload document" }).click();
    await expect(page.getByText(/Document uploaded/)).toBeVisible();

    // The one tax-return document this business has (the refused PDF above was never stored).
    const { data: record, error: lookupError } = await db
      .from("documents")
      .select("storage_path")
      .eq("business_id", seed.business.id)
      .eq("type", "tax_return")
      .single();
    expect(lookupError, "the stored document should be in the database").toBeNull();

    const { data: file, error: downloadError } = await db.storage
      .from("business-documents")
      .download(record?.storage_path ?? "");
    expect(downloadError, "the stored file should be downloadable").toBeNull();
    const stored = Buffer.from(await (file as Blob).arrayBuffer());

    expect(stored.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(stored.includes("SMUGGLED-FILE")).toBe(false);
    await context.close();
  });
});
