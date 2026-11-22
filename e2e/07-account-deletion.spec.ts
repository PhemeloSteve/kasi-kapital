import { expect, test } from "@playwright/test";
import { logIn, newActor } from "./support/actors";
import { loadSeed, PASSWORD, serviceClient } from "./support/seed";

const seed = loadSeed();
const db = serviceClient();

/** A supporter created just for the test, so nobody else's account is touched. */
async function createSupporter(tag: string) {
  const email = `leaving-${tag}-${seed.runId}@example.com`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "investor", full_name: "Leaving Supporter", popia_consent: true },
  });
  expect(error, "creating the supporter").toBeNull();
  return { email, userId: data.user?.id as string };
}

const profileOf = async (userId: string) => {
  const { data } = await db
    .from("profiles")
    .select("full_name, deleted_at")
    .eq("id", userId)
    .single();
  return data;
};

test.describe("deleting an account", () => {
  test("a supporter with no money in play deletes their account and cannot sign in again", async ({
    browser,
  }) => {
    const { email, userId } = await createSupporter("gone");
    const { context, page } = await newActor(browser);

    await logIn(page, email);
    await page.goto("/account/delete");
    await expect(page.getByRole("heading", { name: "Delete my account" })).toBeVisible();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.waitForURL((url) => url.pathname === "/");

    const profile = await profileOf(userId);
    expect(profile?.full_name).toBe("Deleted user");
    expect(profile?.deleted_at).not.toBeNull();

    // The sign-in details are gone too: the old email no longer belongs to anyone.
    const { data: authUser } = await db.auth.admin.getUserById(userId);
    expect(authUser.user?.email).not.toBe(email);

    // The old email and password no longer work ...
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/login");

    // ... and the page that deletes accounts is closed to a signed-out visitor.
    await page.goto("/account/delete");
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test("typing the wrong word deletes nothing", async ({ browser }) => {
    const { email, userId } = await createSupporter("stays");
    const { context, page } = await newActor(browser);

    await logIn(page, email);
    await page.goto("/account/delete");
    await page.getByLabel("Type DELETE to confirm").fill("not now");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText("Please type DELETE in the box to confirm.")).toBeVisible();

    const profile = await profileOf(userId);
    expect(profile?.full_name).toBe("Leaving Supporter");
    expect(profile?.deleted_at).toBeNull();

    await context.close();
    await db.auth.admin.deleteUser(userId);
  });

  test("an administrator has no way to delete their account here", async ({ browser }) => {
    const { admin } = seed;
    const { context, page } = await newActor(browser);
    await logIn(page, admin.email);
    await page.goto("/account/delete");
    await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
    await context.close();
  });
});
