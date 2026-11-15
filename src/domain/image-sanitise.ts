import { err, ok, type Result } from "./result";

export type ImageProblem = "malformed";

/** One byte. Every caller has already checked it is inside the data, so past the end reads as 0. */
const at = (data: Uint8Array, index: number): number => data[index] ?? 0;

function join(pieces: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
  let offset = 0;
  for (const piece of pieces) {
    out.set(piece, offset);
    offset += piece.length;
  }
  return out;
}

// ---------------------------------------------------------------- JPEG
const SOS = 0xda;
const EOI = 0xd9;

const isStandalone = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/**
 * JPEG metadata lives in numbered "application" segments and comments. Keep the ones that affect how the
 * picture looks (JFIF header, colour profile, Adobe colour transform); drop camera/GPS/software details
 * (APP1 holds EXIF and XMP), other vendor segments and comments.
 */
function keepJpegSegment(marker: number): boolean {
  if (marker === 0xe0 || marker === 0xe2 || marker === 0xee) return true;
  if (marker >= 0xe0 && marker <= 0xef) return false;
  return marker !== 0xfe;
}

/** The rotation a phone recorded in a photo's EXIF block (1 to 8; 1 means upright or unknown). */
export function exifOrientation(segment: Uint8Array): number {
  const n = segment.length;
  const isExif =
    n >= 14 &&
    at(segment, 0) === 0x45 &&
    at(segment, 1) === 0x78 &&
    at(segment, 2) === 0x69 &&
    at(segment, 3) === 0x66 &&
    at(segment, 4) === 0 &&
    at(segment, 5) === 0;
  if (!isExif) return 1;

  const tiff = 6;
  const little = at(segment, tiff) === 0x49 && at(segment, tiff + 1) === 0x49;
  const big = at(segment, tiff) === 0x4d && at(segment, tiff + 1) === 0x4d;
  if (!little && !big) return 1;

  const u16 = (offset: number) =>
    little
      ? at(segment, offset) | (at(segment, offset + 1) << 8)
      : (at(segment, offset) << 8) | at(segment, offset + 1);
  const u32 = (offset: number) =>
    little
      ? at(segment, offset) +
        at(segment, offset + 1) * 2 ** 8 +
        at(segment, offset + 2) * 2 ** 16 +
        at(segment, offset + 3) * 2 ** 24
      : at(segment, offset) * 2 ** 24 +
        at(segment, offset + 1) * 2 ** 16 +
        at(segment, offset + 2) * 2 ** 8 +
        at(segment, offset + 3);

  if (u16(tiff + 2) !== 42) return 1;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > n) return 1;
  const entries = Math.min(u16(ifd), 64);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > n) return 1;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/** A tiny EXIF block holding only the rotation, so a sideways phone photo still opens upright. */
function orientationSegment(orientation: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xe1,
    0x00,
    0x22, // APP1, length 34
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif"
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // big-endian TIFF header, first block at 8
    0x00,
    0x01, // one entry
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00, // orientation
    0x00,
    0x00,
    0x00,
    0x00, // no further blocks
  ]);
}

/**
 * Checks that a JPEG is structurally sound and removes what it should not carry: location and camera
 * details, comments, and anything appended after the end of the picture (a classic way to smuggle a
 * second file inside an image). The picture data itself is copied untouched. This validates structure; it
 * does not decode the pixels.
 */
export function sanitiseJpeg(bytes: Uint8Array): Result<Uint8Array, ImageProblem> {
  const n = bytes.length;
  if (n < 4 || at(bytes, 0) !== 0xff || at(bytes, 1) !== 0xd8) return err("malformed");

  const pieces: Uint8Array[] = [bytes.subarray(0, 2)];
  let insertAt = 1;
  let orientation = 1;
  let sawScan = false;
  let i = 2;

  while (i < n) {
    if (at(bytes, i) !== 0xff) return err("malformed");
    while (i + 1 < n && at(bytes, i + 1) === 0xff) i++; // fill bytes
    if (i + 1 >= n) return err("malformed");
    const marker = at(bytes, i + 1);

    if (marker === EOI) {
      if (!sawScan) return err("malformed");
      pieces.push(bytes.subarray(i, i + 2));
      if (orientation !== 1) pieces.splice(insertAt, 0, orientationSegment(orientation));
      return ok(join(pieces));
    }
    if (marker === 0x00 || marker === 0xd8) return err("malformed");
    if (isStandalone(marker)) {
      pieces.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (i + 4 > n) return err("malformed");
    const length = (at(bytes, i + 2) << 8) | at(bytes, i + 3);
    if (length < 2 || i + 2 + length > n) return err("malformed");
    const segmentEnd = i + 2 + length;

    if (marker === 0xe1 && orientation === 1) {
      orientation = exifOrientation(bytes.subarray(i + 4, segmentEnd));
    }
    if (keepJpegSegment(marker)) {
      pieces.push(bytes.subarray(i, segmentEnd));
      if (marker === 0xe0 && pieces.length === 2) insertAt = 2; // right after the JFIF header
    }
    i = segmentEnd;

    if (marker === SOS) {
      sawScan = true;
      // The compressed picture data runs until the next real marker. 0xFF 0x00 and the restart
      // markers belong to the data itself.
      let j = i;
      for (;;) {
        if (j + 1 >= n) return err("malformed");
        if (at(bytes, j) !== 0xff) {
          j++;
          continue;
        }
        const next = at(bytes, j + 1);
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          j += 2;
          continue;
        }
        if (next === 0xff) {
          j++;
          continue;
        }
        break;
      }
      pieces.push(bytes.subarray(i, j));
      i = j;
    }
  }
  return err("malformed"); // ran out of data before the end-of-image marker
}

// ---------------------------------------------------------------- PNG
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

let crcTable: Uint32Array | null = null;

/** The checksum PNG stores after every chunk. */
export function crc32(bytes: Uint8Array): number {
  const table = crcTable ?? (crcTable = makeCrcTable());
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (table[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Chunks that describe how to draw the picture. Everything else (text, EXIF, timestamps, animation
// frames, unknown extras) is dropped.
const KEEP_PNG_CHUNKS = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP",
  "sBIT",
  "pHYs",
  "bKGD",
]);
const REQUIRED_PNG_CHUNKS = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);

/**
 * Checks that a PNG is structurally sound (every chunk's checksum matches) and keeps only the chunks
 * needed to draw it, dropping text, EXIF and any bytes after the end of the image.
 */
export function sanitisePng(bytes: Uint8Array): Result<Uint8Array, ImageProblem> {
  const n = bytes.length;
  if (n < 8 + 12 || !PNG_SIGNATURE.every((value, index) => at(bytes, index) === value)) {
    return err("malformed");
  }

  const pieces: Uint8Array[] = [bytes.subarray(0, 8)];
  let pos = 8;
  let first = true;
  let sawData = false;

  while (pos + 12 <= n) {
    const length =
      at(bytes, pos) * 2 ** 24 +
      at(bytes, pos + 1) * 2 ** 16 +
      at(bytes, pos + 2) * 2 ** 8 +
      at(bytes, pos + 3);
    const end = pos + 12 + length;
    if (end > n) return err("malformed");

    const type = String.fromCharCode(
      at(bytes, pos + 4),
      at(bytes, pos + 5),
      at(bytes, pos + 6),
      at(bytes, pos + 7),
    );
    if (!/^[A-Za-z]{4}$/.test(type)) return err("malformed");

    const storedCrc =
      at(bytes, end - 4) * 2 ** 24 +
      at(bytes, end - 3) * 2 ** 16 +
      at(bytes, end - 2) * 2 ** 8 +
      at(bytes, end - 1);
    if (crc32(bytes.subarray(pos + 4, end - 4)) !== storedCrc) return err("malformed");

    if (first && (type !== "IHDR" || length !== 13)) return err("malformed");
    first = false;

    const critical = (at(bytes, pos + 4) & 0x20) === 0;
    if (critical && !REQUIRED_PNG_CHUNKS.has(type)) return err("malformed");
    if (type === "IDAT") sawData = true;
    if (KEEP_PNG_CHUNKS.has(type)) pieces.push(bytes.subarray(pos, end));

    pos = end;
    if (type === "IEND") return sawData ? ok(join(pieces)) : err("malformed");
  }
  return err("malformed"); // no end-of-image chunk
}
