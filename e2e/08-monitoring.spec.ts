import { expect, test } from "@playwright/test";

test.describe("monitoring", () => {
  test("the health check answers for an uptime monitor and is never cached", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("every page tells the browser where to send policy violation reports", async ({
    request,
  }) => {
    const response = await request.get("/login");
    expect(response.headers()["content-security-policy"]).toContain("report-uri /api/csp-report");
  });

  test("the report endpoint takes a report, and refuses junk and oversized bodies", async ({
    request,
  }) => {
    const headers = { "content-type": "application/csp-report" };

    const accepted = await request.post("/api/csp-report", {
      headers,
      data: JSON.stringify({
        "csp-report": {
          "document-uri": "https://example.test/login?token=abc",
          "effective-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js",
        },
      }),
    });
    expect(accepted.status()).toBe(204);

    const notJson = await request.post("/api/csp-report", { headers, data: "this is not json" });
    expect(notJson.status()).toBe(400);

    const tooBig = await request.post("/api/csp-report", { headers, data: "x".repeat(20_000) });
    expect(tooBig.status()).toBe(413);
  });
});
