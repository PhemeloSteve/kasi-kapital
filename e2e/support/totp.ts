import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decodes an authenticator secret written in base32 (the form Supabase shows for "enter by hand"). */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Not a base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const STEP_SECONDS = 30;

/** The 30-second window a moment in time falls into. */
export function stepAt(timeMs: number): number {
  return Math.floor(timeMs / 1000 / STEP_SECONDS);
}

/** A one-time code as an authenticator app computes it (RFC 6238: HMAC-SHA1, 6 digits, 30 seconds). */
export function totpCode(secret: string, timeMs: number = Date.now(), digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(stepAt(timeMs)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/**
 * A code from a window later than `usedStep`, waiting for the next window if needed. Each login in a
 * test needs a code the server has not seen yet, and a code is only valid inside its own window.
 */
export async function freshTotpCode(
  secret: string,
  usedStep: number,
): Promise<{ code: string; step: number }> {
  while (stepAt(Date.now()) <= usedStep) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const now = Date.now();
  return { code: totpCode(secret, now), step: stepAt(now) };
}
