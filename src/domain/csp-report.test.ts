import { describe, expect, it } from "vitest";
import { describeCspReport } from "./csp-report";

describe("describeCspReport", () => {
  it("reads the classic report format", () => {
    expect(
      describeCspReport({
        "csp-report": {
          "document-uri": "https://kasi.example/login",
          "violated-directive": "script-src-elem",
          "effective-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js",
          "source-file": "https://kasi.example/login",
        },
      }),
    ).toEqual({
      directive: "script-src-elem",
      blocked: "https://evil.example/x.js",
      page: "https://kasi.example/login",
      source: "https://kasi.example/login",
    });
  });

  it("reads the Reporting API format (a list)", () => {
    expect(
      describeCspReport([
        {
          type: "csp-violation",
          body: {
            documentURL: "https://kasi.example/",
            effectiveDirective: "img-src",
            blockedURL: "https://tracker.example/pixel.gif",
          },
        },
      ]),
    ).toEqual({
      directive: "img-src",
      blocked: "https://tracker.example/pixel.gif",
      page: "https://kasi.example/",
      source: "",
    });
  });

  it("drops the query and fragment of every address", () => {
    const result = describeCspReport({
      "csp-report": {
        "document-uri": "https://kasi.example/reset?token=secret123#frag",
        "effective-directive": "script-src",
        "blocked-uri": "https://evil.example/a.js?stolen=cookie",
      },
    });
    expect(result?.page).toBe("https://kasi.example/reset");
    expect(result?.blocked).toBe("https://evil.example/a.js");
    expect(JSON.stringify(result)).not.toContain("secret123");
    expect(JSON.stringify(result)).not.toContain("stolen");
  });

  it("never keeps the content of a data: or blob: address", () => {
    const result = describeCspReport({
      "csp-report": {
        "effective-directive": "script-src-elem",
        "blocked-uri": "data:text/javascript;base64,YWxlcnQoMSk=",
      },
    });
    expect(result?.blocked).toBe("data:");
  });

  it("keeps the plain words browsers use for inline and eval", () => {
    const result = describeCspReport({
      "csp-report": { "effective-directive": "script-src-attr", "blocked-uri": "inline" },
    });
    expect(result?.blocked).toBe("inline");
  });

  it("limits length and removes control characters", () => {
    const result = describeCspReport({
      "csp-report": {
        "effective-directive": `script-src${"x".repeat(500)}\nFAKE LOG LINE`,
        "blocked-uri": "inline\r\nforged",
      },
    });
    expect(result?.directive.length).toBeLessThanOrEqual(60);
    expect(result?.directive).not.toMatch(/[\r\n]/);
    expect(result?.blocked).not.toMatch(/[\r\n]/);
  });

  it("returns null for anything that is not a violation report", () => {
    for (const body of [
      null,
      undefined,
      "text",
      42,
      [],
      {},
      { "csp-report": {} },
      [{ type: "other" }],
    ]) {
      expect(describeCspReport(body)).toBeNull();
    }
  });
});
