import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

const base = { nonce: "abc123", supabaseUrl: "https://proj.supabase.co", development: false };

function directive(csp: string, name: string): string {
  return (
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `)) ?? ""
  );
}

describe("buildCsp and Turnstile", () => {
  it("lets the robot check load when it is switched on", () => {
    const csp = buildCsp({ ...base, turnstile: true });
    expect(directive(csp, "frame-src")).toContain("https://challenges.cloudflare.com");
    expect(directive(csp, "connect-src")).toContain("https://challenges.cloudflare.com");
  });

  it("allows nothing from Cloudflare when it is off, which is the default", () => {
    for (const csp of [buildCsp(base), buildCsp({ ...base, turnstile: false })]) {
      expect(csp).not.toContain("cloudflare");
    }
  });

  it("never loosens the rules for scripts", () => {
    const script = directive(buildCsp({ ...base, turnstile: true }), "script-src");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("cloudflare");
  });

  it("keeps the video frame allowance next to it", () => {
    const frame = directive(buildCsp({ ...base, turnstile: true }), "frame-src");
    expect(frame).toContain("https://www.youtube-nocookie.com");
  });
});
