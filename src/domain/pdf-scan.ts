import { err, ok, type Result } from "./result";

export type PdfProblem = "active_content" | "encrypted_pdf" | "too_complex";

// Limits that stop a hostile file from using up the server: how many compressed blocks we will open,
// and how much any one block, or all of them together, may expand to.
const MAX_STREAMS = 2000;
const MAX_STREAM_OUTPUT = 8 * 1024 * 1024;
const MAX_TOTAL_OUTPUT = 16 * 1024 * 1024;

// A PDF "name" such as /JavaScript ends at whitespace (which in PDF includes the NUL byte) or one of
// these delimiters. The NUL is added at run time so the pattern holds no literal control character.
const NAME_END = String.raw`(?=[\s()<>\[\]{}/%` + String.fromCharCode(0) + String.raw`]|$)`;
const ACTIVE = new RegExp(
  String.raw`/(?:JavaScript|JS|Launch|RichMedia|XFA|SubmitForm|ImportData|EmbeddedFiles?)` +
    NAME_END,
);
const ENCRYPTED = new RegExp(String.raw`/Encrypt` + NAME_END);

/** PDF lets any character in a name be written as #xx, so /Java#53cript is /JavaScript. Undo that first. */
export function decodeNameEscapes(text: string): string {
  return text.replace(/#([0-9A-Fa-f]{2})/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function problemIn(text: string): "active_content" | "encrypted_pdf" | null {
  const normalised = decodeNameEscapes(text);
  if (ACTIVE.test(normalised)) return "active_content";
  if (ENCRYPTED.test(normalised)) return "encrypted_pdf";
  return null;
}

/** Where each stream's data starts and ends (the bytes between "stream" and "endstream"). */
function streamRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const start = /(?<!end)stream\r?\n/g;
  let match = start.exec(text);
  while (match) {
    const from = match.index + match[0].length;
    const found = text.indexOf("endstream", from);
    const to = found === -1 ? text.length : found;
    ranges.push([from, to]);
    start.lastIndex = to;
    match = start.exec(text);
  }
  return ranges;
}

/** Opens one Flate (zlib) block. Null means it is not Flate data. "limit" means it expands too far. */
async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array | null | "limit"> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    const stream = new Blob([new Uint8Array(data)])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        return "limit";
      }
      chunks.push(value);
    }
  } catch {
    // Not Flate data, or damaged part-way. Whatever opened before the damage is still checked.
  }
  if (chunks.length === 0) return null;
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

/**
 * Looks for what a PDF can do besides show pages: run scripts, launch programs, carry hidden attachments,
 * or hide its content behind a password. Scripts are often tucked inside compressed blocks, so those are
 * opened and checked too. The raw bytes of the blocks themselves are not searched, because compressed
 * data can contain any byte pattern by chance.
 *
 * This is a strict filter for active content, not an antivirus. Blocks packed with other filters
 * (ASCII85, LZW) are not opened.
 */
export async function scanPdf(bytes: Uint8Array): Promise<Result<true, PdfProblem>> {
  const text = new TextDecoder("latin1").decode(bytes);
  const ranges = streamRanges(text);
  if (ranges.length > MAX_STREAMS) return err("too_complex");

  let outside = "";
  let cursor = 0;
  for (const [from, to] of ranges) {
    outside += text.slice(cursor, from);
    cursor = to;
  }
  outside += text.slice(cursor);

  const outsideProblem = problemIn(outside);
  if (outsideProblem === "active_content") return err(outsideProblem);

  let total = 0;
  for (const [from, to] of ranges) {
    let end = to;
    // One line break normally sits between the data and the word "endstream".
    if (end - from >= 2 && bytes[end - 2] === 0x0d && bytes[end - 1] === 0x0a) end -= 2;
    else if (end > from && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d)) end -= 1;

    const opened = await inflate(
      bytes.subarray(from, end),
      Math.min(MAX_STREAM_OUTPUT, MAX_TOTAL_OUTPUT - total),
    );
    if (opened === "limit") return err("too_complex");
    if (opened === null) continue;
    total += opened.length;
    if (problemIn(new TextDecoder("latin1").decode(opened)) === "active_content") {
      return err("active_content");
    }
  }

  return outsideProblem ? err(outsideProblem) : ok(true as const);
}
