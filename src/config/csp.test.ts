import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "./csp";

const live = { nonce: "abc123", supabaseUrl: "https://proj.supabase.co", development: false };

function directive(csp: string, name: string): string {
  return (
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `)) ?? ""
  );
}

describe("generateNonce", () => {
  it("is base64 and long enough to be unguessable", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(nonce.length).toBeGreaterThanOrEqual(22);
  });

  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(seen.size).toBe(50);
  });
});

describe("buildCsp scripts", () => {
  it("only allows scripts with this request's nonce, and the scripts they load", () => {
    const script = directive(buildCsp(live), "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
  });

  it("never allows inline or eval scripts on a live site", () => {
    const script = directive(buildCsp(live), "script-src");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("allows eval only for the development server", () => {
    const script = directive(buildCsp({ ...live, development: true }), "script-src");
    expect(script).toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
  });
});

describe("buildCsp everything else", () => {
  it("locks down plugins, framing, the base tag and form targets", () => {
    const csp = buildCsp(live);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("lets the page talk to Supabase, including websockets, and nothing else", () => {
    const connect = directive(buildCsp(live), "connect-src");
    expect(connect).toBe("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co");
  });

  it("uses plain websockets for a local http Supabase", () => {
    const local = buildCsp({ ...live, supabaseUrl: "http://127.0.0.1:54321" });
    expect(directive(local, "connect-src")).toBe(
      "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321",
    );
  });

  it("allows map tiles and Supabase images only", () => {
    const img = directive(buildCsp(live), "img-src");
    expect(img).toContain("https://tile.openstreetmap.org");
    expect(img).toContain("https://proj.supabase.co");
  });

  it("still produces a valid policy if the Supabase address is missing", () => {
    const csp = buildCsp({ ...live, supabaseUrl: "" });
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(csp).not.toContain("undefined");
  });

  it("changes only the nonce between requests", () => {
    const a = buildCsp({ ...live, nonce: "AAAA" });
    const b = buildCsp({ ...live, nonce: "BBBB" });
    expect(a.replace("AAAA", "X")).toBe(b.replace("BBBB", "X"));
  });
});
