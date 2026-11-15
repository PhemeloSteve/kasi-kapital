import { describe, expect, it } from "vitest";
import { crc32, exifOrientation, sanitiseJpeg, sanitisePng } from "./image-sanitise";

const enc = (text: string) => Array.from(new TextEncoder().encode(text));
const join = (...parts: number[][]) => new Uint8Array(parts.flat());
const has = (haystack: Uint8Array, needle: number[] | string) =>
  Buffer.from(haystack).includes(
    typeof needle === "string" ? Buffer.from(needle, "latin1") : Buffer.from(needle),
  );

// ---------------------------------------------------------------- JPEG helpers
function segment(marker: number, data: number[]): number[] {
  const length = data.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...data];
}

/** An EXIF block with a rotation and, like many phone photos, a GPS location. */
function exif(orientation: number, order: "little" | "big" = "little"): number[] {
  const u16 = (v: number) => (order === "little" ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (order === "little" ? [v & 0xff, 0, 0, 0] : [0, 0, 0, v & 0xff]);
  return [
    ...enc("Exif"),
    0,
    0,
    ...(order === "little" ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42),
    ...u32(8),
    ...u16(1), // one entry
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientation),
    0,
    0,
    ...u32(0),
    ...enc("GPSLatitude=-26.2041 GPSLongitude=28.0473"),
  ];
}

const SCAN_DATA = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78]; // includes a stuffed FF and a restart
const SOS = segment(0xda, [1, 1, 0, 0, 0x3f, 0]);

function jpeg(options: {
  exifBlock?: number[];
  comment?: string;
  trailing?: string;
  scans?: number;
}) {
  const pieces: number[][] = [
    [0xff, 0xd8],
    segment(0xe0, [...enc("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
  ];
  if (options.exifBlock) pieces.push(segment(0xe1, options.exifBlock));
  if (options.comment) pieces.push(segment(0xfe, enc(options.comment)));
  pieces.push(segment(0xdb, new Array(65).fill(8)), segment(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]));
  for (let scan = 0; scan < (options.scans ?? 1); scan++) {
    if (scan > 0) pieces.push(segment(0xc4, [0, 1, 2, 3]));
    pieces.push(SOS, SCAN_DATA);
  }
  pieces.push([0xff, 0xd9], enc(options.trailing ?? ""));
  return join(...pieces);
}

describe("sanitiseJpeg", () => {
  it("removes location, camera details, comments and appended files", () => {
    const file = jpeg({
      exifBlock: exif(1),
      comment: "secret note",
      trailing: "<?php system($_GET['c']); ?>",
    });
    expect(has(file, "GPSLatitude")).toBe(true);

    const result = sanitiseJpeg(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(has(result.value, "GPS")).toBe(false);
    expect(has(result.value, "Exif")).toBe(false);
    expect(has(result.value, "secret note")).toBe(false);
    expect(has(result.value, "<?php")).toBe(false);
    expect([...result.value.slice(-2)]).toEqual([0xff, 0xd9]);
    expect([...result.value.slice(0, 2)]).toEqual([0xff, 0xd8]);
  });

  it("copies the picture itself untouched, including stuffed bytes and restart markers", () => {
    const result = sanitiseJpeg(jpeg({ exifBlock: exif(1) }));
    expect(result.ok && has(result.value, SCAN_DATA)).toBe(true);
    expect(result.ok && has(result.value, "JFIF")).toBe(true);
    expect(result.ok && has(result.value, [0xff, 0xdb])).toBe(true);
  });

  it("keeps the rotation, so a sideways phone photo still opens upright", () => {
    const result = sanitiseJpeg(jpeg({ exifBlock: exif(6) }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const at = Buffer.from(result.value).indexOf(Buffer.from([0xff, 0xe1]));
    expect(at).toBeGreaterThan(0);
    const length = Buffer.from(result.value).readUInt16BE(at + 2);
    expect(exifOrientation(result.value.slice(at + 4, at + 2 + length))).toBe(6);
    expect(has(result.value, "GPS")).toBe(false);
  });

  it("adds no EXIF at all when the photo is upright or has none", () => {
    for (const file of [jpeg({ exifBlock: exif(1) }), jpeg({})]) {
      const result = sanitiseJpeg(file);
      expect(result.ok && has(result.value, [0xff, 0xe1])).toBe(false);
    }
  });

  it("keeps every scan of a progressive picture", () => {
    const result = sanitiseJpeg(jpeg({ scans: 3 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const scans = Buffer.from(result.value).toString("latin1").split("\xff\xda").length - 1;
    expect(scans).toBe(3);
  });

  it("tolerates padding bytes between segments", () => {
    const file = jpeg({});
    const padded = join([...file.slice(0, 2)], [0xff, 0xff], [...file.slice(2)]);
    expect(sanitiseJpeg(padded).ok).toBe(true);
  });

  it.each([
    ["not a JPEG", join(enc("hello world, definitely not a picture"))],
    ["only the signature", join([0xff, 0xd8, 0xff])],
    ["no picture data", join([0xff, 0xd8], segment(0xdb, [1, 2, 3]), [0xff, 0xd9])],
    ["cut off before the end", jpeg({}).slice(0, -3)],
    ["a segment longer than the file", join([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 1, 2])],
    ["garbage after the signature", join([0xff, 0xd8, 0x00, 0x11, 0x22, 0x33])],
  ])("refuses %s", (_name, file) => {
    expect(sanitiseJpeg(file)).toEqual({ ok: false, error: "malformed" });
  });
});

describe("exifOrientation", () => {
  it("reads both byte orders", () => {
    expect(exifOrientation(Uint8Array.from(exif(3, "little")))).toBe(3);
    expect(exifOrientation(Uint8Array.from(exif(8, "big")))).toBe(8);
  });

  it("treats anything odd as upright instead of failing", () => {
    expect(exifOrientation(Uint8Array.from(enc("nonsense")))).toBe(1);
    expect(exifOrientation(Uint8Array.from(exif(9)))).toBe(1);
    expect(exifOrientation(Uint8Array.from(exif(6).slice(0, 12)))).toBe(1);
  });
});

// ---------------------------------------------------------------- PNG helpers
const be32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];

function chunk(type: string, data: number[], crcOverride?: number): number[] {
  const body = Uint8Array.from([...enc(type), ...data]);
  return [...be32(data.length), ...body, ...be32(crcOverride ?? crc32(body))];
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = chunk("IHDR", [...be32(1), ...be32(1), 8, 0, 0, 0, 0]);
const IDAT = chunk("IDAT", [0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]);
const IEND = chunk("IEND", []);

const png = (...parts: number[][]) => join(SIGNATURE, ...parts);

describe("crc32", () => {
  it("matches the standard test value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("sanitisePng", () => {
  it("removes text, EXIF, timestamps and appended files, keeping what draws the picture", () => {
    const file = png(
      IHDR,
      chunk("gAMA", be32(45455)),
      chunk("tEXt", enc("Comment\0secret note")),
      chunk("eXIf", enc("GPSLatitude=-26.2")),
      chunk("tIME", [7, 234, 1, 1, 0, 0, 0]),
      chunk("zzzz", [1, 2, 3]),
      IDAT,
      IEND,
      enc("<script>alert(1)</script>"),
    );
    const result = sanitisePng(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const secret of ["secret note", "GPSLatitude", "<script>", "tEXt", "eXIf", "tIME"]) {
      expect(has(result.value, secret)).toBe(false);
    }
    for (const kept of ["IHDR", "gAMA", "IDAT", "IEND"]) expect(has(result.value, kept)).toBe(true);
    expect(sanitisePng(result.value)).toEqual(result);
  });

  it("returns the same image when there is nothing to remove", () => {
    const file = png(IHDR, IDAT, IEND);
    const result = sanitisePng(file);
    expect(result.ok && Buffer.from(result.value).equals(Buffer.from(file))).toBe(true);
  });

  it.each([
    ["not a PNG", join(enc("GIF89a-this-is-not-a-png-file-at-all"))],
    ["a damaged chunk", png(IHDR, chunk("IDAT", [1, 2, 3], 12345), IEND)],
    ["no end chunk", png(IHDR, IDAT)],
    ["no picture data", png(IHDR, IEND)],
    ["a missing header chunk", png(IDAT, IEND)],
    ["an unknown required chunk", png(IHDR, chunk("ABCD", [1]), IDAT, IEND)],
    ["a chunk longer than the file", png(IHDR, [0x7f, 0xff, 0xff, 0xff, ...enc("IDAT")], IEND)],
    ["cut off mid-chunk", png(IHDR, IDAT, IEND).slice(0, -6)],
  ])("refuses %s", (_name, file) => {
    expect(sanitisePng(file)).toEqual({ ok: false, error: "malformed" });
  });
});
