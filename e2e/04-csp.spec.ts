import { expect, test, type Page } from "@playwright/test";
import { logIn, logInAsAdmin, newActor } from "./support/actors";
import { loadSeed } from "./support/seed";

const seed = loadSeed();

type Spy = { __cspViolations?: string[]; __pwned?: number };

/** Records every Content Security Policy violation the page reports, from the very start of each page. */
async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const spy = window as unknown as Spy;
    spy.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      spy.__cspViolations?.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as Spy).__cspViolations ?? []);

async function expectCleanPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  expect(await violations(page), `CSP violations on ${path}`).toEqual([]);
}

function scriptDirective(csp: string): string {
  return (
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src ")) ?? ""
  );
}

test.describe("the content security policy", () => {
  test("every page is sent with a nonce and no unsafe-inline scripts", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    for (const path of ["/", "/login", "/signup", "/privacy"]) {
      const response = await page.goto(path);
      const csp = response?.headers()["content-security-policy"] ?? "";
      const script = scriptDirective(csp);
      expect(script, `script-src on ${path}`).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
      expect(script).toContain("'strict-dynamic'");
      expect(script).not.toContain("'unsafe-inline'");
      expect(script).not.toContain("'unsafe-eval'");
    }
    await context.close();
  });

  test("every request gets a different nonce", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    const nonces: string[] = [];
    for (let i = 0; i < 3; i++) {
      const response = await page.goto("/login");
      const csp = response?.headers()["content-security-policy"] ?? "";
      nonces.push(/'nonce-([^']+)'/.exec(csp)?.[1] ?? "");
    }
    expect(nonces.every(Boolean)).toBe(true);
    expect(new Set(nonces).size).toBe(3);
    await context.close();
  });

  test("the app still works under it: scripts run and nothing is blocked", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await watchViolations(page);

    for (const path of ["/", "/privacy", "/signup"]) await expectCleanPage(page, path);

    // Proof that the page's own scripts ran (the page became interactive), not just that it loaded.
    await page.goto("/login");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");

    await logIn(page, seed.supporter.email);
    for (const path of ["/investor", `/businesses/${seed.business.id}`, "/contributions"]) {
      await expectCleanPage(page, path);
    }
    await context.close();
  });

  test("the admin pages work under it too", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await watchViolations(page);
    await logInAsAdmin(page);
    for (const path of ["/admin", "/admin/audit", "/admin/users", "/admin/businesses"]) {
      await expectCleanPage(page, path);
    }
    await context.close();
  });

  test("an injected inline event handler is refused", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await watchViolations(page);
    await page.goto("/login");

    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<img src="/nothing.png" onerror="window.__pwned = 1">',
      );
    });
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => (window as unknown as Spy).__pwned)).toBeUndefined();
    expect((await violations(page)).length).toBeGreaterThan(0);
    await context.close();
  });

  test("an injected inline script, as from a real XSS flaw, is refused", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await watchViolations(page);

    // Simulates a flaw that lets an attacker get a script into the page the server sends.
    await page.route("**/login", async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        "</body>",
        "<script>window.__pwned = 1</script></body>",
      );
      await route.fulfill({ response, body: html });
    });
    await page.goto("/login");

    // The script really is in the page (Playwright's text matching skips script elements, so look directly)...
    const injected = await page.evaluate(() =>
      Array.from(document.scripts).some((script) => script.textContent?.includes("__pwned")),
    );
    expect(injected, "the test's injected script should be present in the page").toBe(true);
    // ...but the browser refused to run it.
    expect(await page.evaluate(() => (window as unknown as Spy).__pwned)).toBeUndefined();
    expect((await violations(page)).length).toBeGreaterThan(0);
    await context.close();
  });
});
