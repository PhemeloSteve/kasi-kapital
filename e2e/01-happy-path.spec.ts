import { expect, test, type Page } from "@playwright/test";
import { logIn, logInAsAdmin, newActor } from "./support/actors";
import { samplePdf } from "./support/files";
import { loadSeed, serviceClient } from "./support/seed";

// One story, told in order: a founder gets verified, raises money, proves how it was spent, and the
// supporter's money is released. Each step depends on the one before, so they run in sequence.
test.describe.configure({ mode: "serial" });

const seed = loadSeed();
const db = serviceClient();

async function uploadDocument(page: Page, type: "id" | "bank_statement") {
  await page.locator("#type").selectOption(type);
  await page.locator("#file").setInputFiles(samplePdf(type));
  await page.getByRole("button", { name: "Upload document" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
}

test("1. the founder uploads documents and submits the business for review", async ({
  browser,
}) => {
  const { context, page } = await newActor(browser);
  await logIn(page, seed.founder.email);
  await page.goto("/business/documents");

  await uploadDocument(page, "id");
  await uploadDocument(page, "bank_statement");

  const submit = page.getByRole("button", { name: "Submit for review" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Submitted.")).toBeVisible();

  const { data } = await db
    .from("businesses")
    .select("verification")
    .eq("id", seed.business.id)
    .single();
  expect(data?.verification).toBe("pending");
  await context.close();
});

test("2. an administrator signs in with two-factor and approves the documents", async ({
  browser,
}) => {
  const { context, page } = await newActor(browser);
  await logInAsAdmin(page);

  const forms = page
    .locator("form")
    .filter({ has: page.getByLabel(new RegExp(`Reason for ${seed.business.name}`)) });
  await expect(forms).toHaveCount(2);

  for (const remaining of [2, 1]) {
    await expect(forms).toHaveCount(remaining);
    await forms.first().getByRole("button", { name: "Approve" }).click();
    await expect(forms).toHaveCount(remaining - 1);
  }

  const { data } = await db
    .from("businesses")
    .select("verification, trust_tier")
    .eq("id", seed.business.id)
    .single();
  expect(data?.verification).toBe("verified");
  expect(data?.trust_tier).toBeGreaterThanOrEqual(2);
  await context.close();
});

test("3. the verified founder creates a funding goal with two steps", async ({ browser }) => {
  const { context, page } = await newActor(browser);
  await logIn(page, seed.founder.email);
  await page.goto("/business/goals/new");

  await page.locator("#title").fill(seed.goal.title);
  await page.locator("#target").fill("1000");
  await page.locator("#milestoneTitle_1").fill(seed.goal.milestone1);
  await page.locator("#milestoneAmount_1").fill("500");
  if ((await page.locator("#milestoneTitle_2").count()) === 0) {
    await page.getByRole("button", { name: "Add another step" }).click();
  }
  await page.locator("#milestoneTitle_2").fill(seed.goal.milestone2);
  await page.locator("#milestoneAmount_2").fill("500");
  await page.getByRole("button", { name: "Create goal" }).click();

  await page.waitForURL((url) => url.pathname === "/business");
  await expect(page.getByText(seed.goal.title).first()).toBeVisible();
  await context.close();
});

test("4. a supporter finds the business and funds the goal through the demo checkout", async ({
  browser,
}) => {
  const { context, page } = await newActor(browser);
  await logIn(page, seed.supporter.email);
  await page.goto("/investor");

  const search = page.locator('input[name="q"]');
  await search.fill(seed.business.name);
  await search.press("Enter");
  await page
    .getByRole("link", { name: new RegExp(seed.business.name) })
    .first()
    .click();
  await page.waitForURL(`**/businesses/${seed.business.id}`);

  await page.locator('input[name="amount"]').fill("1000");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page.waitForURL("**/mock-checkout/**");
  await page.getByRole("button", { name: /^Pay .* \(demo\)$/ }).click();

  await page.waitForURL("**/contributions**");
  await expect(page.getByText(/Thank you!/)).toBeVisible();
  await expect(page.getByText("Held safely").first()).toBeVisible();

  const { data } = await db
    .from("contributions")
    .select("status, amount_cents")
    .eq("contributor_id", seed.supporter.id)
    .single();
  expect(data).toEqual({ status: "held", amount_cents: 100000 });
  await context.close();
});

test("5. the founder sends proof of spending for the first step", async ({ browser }) => {
  const { context, page } = await newActor(browser);
  await logIn(page, seed.founder.email);
  const { data: goal } = await db
    .from("funding_goals")
    .select("id")
    .eq("title", seed.goal.title)
    .single();
  await page.goto(`/business/goals/${goal?.id}`);

  const step = page.getByRole("listitem").filter({ hasText: seed.goal.milestone1 });
  await step.locator('input[type="file"]').setInputFiles(samplePdf("invoice"));
  await step.getByRole("button", { name: "Send proof" }).click();

  await expect
    .poll(async () => {
      const { data } = await db
        .from("milestones")
        .select("status")
        .eq("title", seed.goal.milestone1)
        .single();
      return data?.status;
    })
    .toBe("proof_submitted");
  await context.close();
});

test("6. the administrator approves the proof and the money is paid out", async ({ browser }) => {
  const { context, page } = await newActor(browser);
  await logInAsAdmin(page);

  const proof = page
    .locator("form")
    .filter({ has: page.getByLabel(new RegExp(`Reason for ${seed.goal.milestone1}`)) });
  await proof.getByRole("button", { name: "Approve" }).click();
  await expect(
    page.getByText("Proof approved and the money for that milestone was paid out."),
  ).toBeVisible();

  const { data: milestone } = await db
    .from("milestones")
    .select("id, status")
    .eq("title", seed.goal.milestone1)
    .single();
  expect(milestone?.status).toBe("approved");

  const { data: payout } = await db
    .from("payouts")
    .select("status, amount_cents")
    .eq("milestone_id", milestone?.id)
    .single();
  expect(payout).toEqual({ status: "paid", amount_cents: 50000 });

  // Everything above left a trail the audit page can show to a super admin.
  await page.goto("/admin/audit?action=business.verification_changed");
  await expect(page.getByRole("link", { name: "Audit log" })).toBeVisible();
  await expect(page.getByText("business.verification_changed").first()).toBeVisible();
  await context.close();
});

test("7. the supporter still sees their contribution", async ({ browser }) => {
  const { context, page } = await newActor(browser);
  await logIn(page, seed.supporter.email);
  await page.goto("/contributions");
  await expect(page.getByText(/Held safely|Released/).first()).toBeVisible();
  await context.close();
});
