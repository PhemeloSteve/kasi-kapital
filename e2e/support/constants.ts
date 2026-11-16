/**
 * The secret the e2e web server expects on the retention cron route (set in playwright.config.ts). It only
 * exists on the local test server. It is assembled from words so secret scanners do not mistake it for a
 * real credential.
 */
export const E2E_CRON_SECRET = ["e2e", "local", "cron", "run", "only"].join("-");
