import { expect, test } from "@playwright/test";
import { logIn, newActor } from "./support/actors";
import { loadSeed } from "./support/seed";

const seed = loadSeed();

test("sign-in cookies cannot be read by scripts on the page", async ({ browser }) => {
  const { context, page } = await newActor(browser);
  await logIn(page, seed.supporter.email);

  const session = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(session.length).toBeGreaterThan(0);
  for (const cookie of session) {
    expect(cookie.httpOnly, `${cookie.name} should be HttpOnly`).toBe(true);
    expect(cookie.sameSite, `${cookie.name} should be SameSite=Lax`).toBe("Lax");
  }

  // What a script injected into the page could see: no session cookie among them.
  const visibleToScripts = await page.evaluate(() => document.cookie);
  expect(visibleToScripts).not.toContain("sb-");
  await context.close();
});
