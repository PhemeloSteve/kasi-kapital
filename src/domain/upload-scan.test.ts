import { describe, expect, it } from "vitest";
import { crc32 } from "./image-sanitise";
import { scanUpload } from "./upload-scan";

const enc = (text: string) => new TextEncoder().encode(text);

const be32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
function chunk(type: string, data: number[]): number[] {
  const body = Uint8Array.from([...enc(type), ...data]);
  return [...be32(data.length), ...body, ...be32(crc32(body))];
}
const png = (...extra: number[][]) =>
  Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk("IHDR", [...be32(1), ...be32(1), 8, 0, 0, 0, 0]),
    ...extra.flat(),
    ...chunk("IDAT", [0x78, 0x9c, 0x63, 0x60, 0, 0, 0, 2, 0, 1]),
    ...chunk("IEND", []),
  ]);

const jpeg = (trailing = "") =>
  Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xda,
    0x00,
    0x08,
    1,
    1,
    0,
    0,
    0x3f,
    0,
    0x12,
    0xff,
    0xd9,
    ...enc(trailing),
  ]);

describe("scanUpload", () => {
  it("passes a clean PDF through exactly as uploaded", async () => {
    const file = enc("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
    const result = await scanUpload("pdf", file);
    expect(result.ok && result.value === file).toBe(true);
  });

  it("refuses a PDF with a script, and reports why", async () => {
    const file = enc("%PDF-1.4\n<< /S /JavaScript /JS (x) >>\n%%EOF\n");
    expect(await scanUpload("pdf", file)).toEqual({ ok: false, error: "active_content" });
  });

  it("returns a cleaned JPEG, without what was appended to it", async () => {
    const result = await scanUpload("jpeg", jpeg("HIDDEN-PAYLOAD"));
    expect(result.ok).toBe(true);
    expect(result.ok && Buffer.from(result.value).includes("HIDDEN-PAYLOAD")).toBe(false);
  });

  it("returns a cleaned PNG, without its text chunks", async () => {
    const result = await scanUpload(
      "png",
      png(chunk("tEXt", [...enc("Comment"), 0, ...enc("hi")])),
    );
    expect(result.ok).toBe(true);
    expect(result.ok && Buffer.from(result.value).includes("tEXt")).toBe(false);
  });

  it("refuses an image that is not really one", async () => {
    expect(await scanUpload("jpeg", Uint8Array.from([0xff, 0xd8, 0xff]))).toEqual({
      ok: false,
      error: "malformed",
    });
    expect(await scanUpload("png", png().slice(0, 30))).toEqual({ ok: false, error: "malformed" });
  });
});
