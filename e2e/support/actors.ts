import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { lastAdminStep, loadSeed, PASSWORD, recordAdminStep } from "./seed";
import { freshTotpCode } from "./totp";

/** A separate browser profile, so several people can be signed in at the same time. */
export async function newActor(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: e2eEnv().baseUrl });
  const page = await context.newPage();
  return { context, page };
}

export async function logIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Password first, then the authenticator code, exactly as an administrator does. */
export async function logInAsAdmin(page: Page): Promise<void> {
  const { admin } = loadSeed();
  await logIn(page, admin.email);

  await page.goto("/admin/mfa");
  const { code, step } = await freshTotpCode(admin.totpSecret, lastAdminStep());
  await page.getByLabel(/6-digit code/).fill(code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  recordAdminStep(step);

  await page.waitForURL((url) => url.pathname === "/admin");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
}
