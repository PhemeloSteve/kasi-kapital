import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeNameEscapes, scanPdf } from "./pdf-scan";

const enc = (text: string) => new TextEncoder().encode(text);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const pdf = (body: string) => enc(`%PDF-1.4\n${body}\n%%EOF\n`);

/** An object holding one stream of data, laid out the way PDF writers do. */
function streamObject(data: Uint8Array, dict = "/Filter /FlateDecode"): Uint8Array {
  return concat(
    enc(`4 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`),
    data,
    enc("\nendstream\nendobj\n"),
  );
}

const withStream = (data: Uint8Array) =>
  concat(enc("%PDF-1.4\n"), streamObject(data), enc("%%EOF\n"));
const flate = (text: string) => new Uint8Array(deflateSync(Buffer.from(text, "latin1")));

describe("scanPdf: a plain PDF", () => {
  it("accepts an ordinary document", async () => {
    const result = await scanPdf(pdf("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj"));
    expect(result).toEqual({ ok: true, value: true });
  });

  it("accepts one whose pages are in a compressed stream", async () => {
    const result = await scanPdf(withStream(flate("BT /F1 12 Tf (Statement) Tj ET")));
    expect(result.ok).toBe(true);
  });

  it("accepts links, which statements and invoices often contain", async () => {
    const result = await scanPdf(pdf("<< /S /URI /URI (https://bank.example/help) >>"));
    expect(result.ok).toBe(true);
  });

  it("does not flag a longer name that only starts the same way", async () => {
    const result = await scanPdf(pdf("<< /JSON 1 /Launcher 2 /JSX 3 /Encrypted 4 >>"));
    expect(result.ok).toBe(true);
  });
});

describe("scanPdf: active content", () => {
  it.each([
    ["JavaScript", "<< /S /JavaScript /JS (app.alert(1)) >>"],
    ["a /JS entry", "<< /Type /Action /JS 7 0 R >>"],
    ["a launch action", "<< /S /Launch /F (cmd.exe) >>"],
    ["an embedded file", "<< /Type /EmbeddedFile /Length 5 >>"],
    ["embedded files", "<< /Names << /EmbeddedFiles 3 0 R >> >>"],
    ["a form that submits data", "<< /S /SubmitForm /F (https://evil.example) >>"],
    ["rich media", "<< /Subtype /RichMedia >>"],
    ["an XFA form", "<< /XFA [ (a) 4 0 R ] >>"],
  ])("refuses %s", async (_name, body) => {
    expect(await scanPdf(pdf(body))).toEqual({ ok: false, error: "active_content" });
  });

  it("sees through names written with hex escapes", async () => {
    expect(decodeNameEscapes("/Java#53cript")).toBe("/JavaScript");
    expect(await scanPdf(pdf("<< /S /Java#53cript >>"))).toEqual({
      ok: false,
      error: "active_content",
    });
    expect(await scanPdf(pdf("<< /#4a#53 (x) >>"))).toEqual({ ok: false, error: "active_content" });
  });

  it("finds a script hidden inside a compressed stream", async () => {
    const hidden = withStream(flate("<< /S /JavaScript /JS (this.exportDataObject()) >>"));
    expect(await scanPdf(hidden)).toEqual({ ok: false, error: "active_content" });
  });

  it("does not search the raw bytes of a stream that is not compressed text", async () => {
    // Random-looking binary can contain any pattern by chance; only real PDF structure counts.
    const binary = withStream(concat(enc("\x00\x01 /JS "), new Uint8Array([0xff, 0xfe, 0x00])));
    expect((await scanPdf(binary)).ok).toBe(true);
  });
});

describe("scanPdf: locked PDFs", () => {
  it("refuses a password-protected PDF, whose contents cannot be checked", async () => {
    expect(await scanPdf(pdf("trailer\n<< /Root 1 0 R /Encrypt 5 0 R >>"))).toEqual({
      ok: false,
      error: "encrypted_pdf",
    });
  });
});

describe("scanPdf: limits", () => {
  it("refuses a PDF made of an absurd number of streams", async () => {
    const parts: Uint8Array[] = [enc("%PDF-1.4\n")];
    for (let i = 0; i < 2001; i++) parts.push(streamObject(enc("x")));
    expect(await scanPdf(concat(...parts, enc("%%EOF\n")))).toEqual({
      ok: false,
      error: "too_complex",
    });
  });

  it("refuses a stream that expands into something enormous", async () => {
    const bomb = new Uint8Array(deflateSync(Buffer.alloc(20 * 1024 * 1024)));
    expect(bomb.length).toBeLessThan(200_000);
    expect(await scanPdf(withStream(bomb))).toEqual({ ok: false, error: "too_complex" });
  });
});
