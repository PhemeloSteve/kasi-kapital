import { expect, test } from "@playwright/test";
import { logIn, newActor } from "./support/actors";
import { clientFor, loadSeed, serviceClient } from "./support/seed";

const seed = loadSeed();

test.describe("people only reach what their role allows", () => {
  test("a signed-out visitor is sent to sign in", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    for (const path of ["/business", "/investor", "/contributions", "/admin"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    await context.close();
  });

  test("a supporter cannot open the admin pages", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await logIn(page, seed.supporter.email);
    for (const path of ["/admin", "/admin/audit", "/admin/users", "/admin/businesses"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/admin/);
    }
    await context.close();
  });

  test("a founder cannot open the admin pages or the supporter pages", async ({ browser }) => {
    const { context, page } = await newActor(browser);
    await logIn(page, seed.founder.email);
    for (const path of ["/admin", "/admin/audit", "/investor"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
    }
    await context.close();
  });
});

test.describe("the database refuses a supporter who calls it directly", () => {
  test("admin functions and private tables are closed to them", async () => {
    const supporter = await clientFor(seed.supporter.email);

    for (const call of [
      supporter.rpc("platform_stats"),
      supporter.rpc("admin_list_users"),
      supporter.rpc("suspend_business", { p_id: seed.business.id, p_reason: "test" }),
      supporter.rpc("unsuspend_business", { p_id: seed.business.id }),
    ]) {
      const { error } = await call;
      expect(error?.code).toBe("42501");
    }

    // Private tables return nothing, not an error: the rows simply are not theirs to see.
    const { count } = await serviceClient()
      .from("documents")
      .select("id", { count: "exact", head: true });
    expect(count ?? 0).toBeGreaterThan(0);

    const documents = await supporter.from("documents").select("id");
    expect(documents.data ?? []).toHaveLength(0);
    const audit = await supporter.from("audit_log").select("id");
    expect(audit.data ?? []).toHaveLength(0);
  });

  test("they cannot make themselves an administrator", async () => {
    const supporter = await clientFor(seed.supporter.email);
    await supporter
      .from("profiles")
      .update({ role: "admin", admin_level: "super_admin" })
      .eq("id", seed.supporter.id);

    const { data } = await serviceClient()
      .from("profiles")
      .select("role, admin_level")
      .eq("id", seed.supporter.id)
      .single();
    expect(data).toEqual({ role: "investor", admin_level: null });
  });
});
