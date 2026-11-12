import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

// The tests drive a production build (`next build` + `next start`), the same way the site runs for real,
// against a local Supabase stack. `E2E_DEV=1` uses the dev server instead, which starts faster.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The tests tell one story in order and share the data they create, so no parallel runs or retries.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_DEV
      ? `npm run dev -- -p ${port}`
      : `npm run build && npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...(process.env as Record<string, string>),
      NEXT_PUBLIC_APP_URL: baseURL,
      PAYMENT_PROVIDER: "mock",
      // A production build refuses the demo payment provider unless this is set (hardening step).
      ALLOW_MOCK_PAYMENTS: "true",
    },
  },
});
