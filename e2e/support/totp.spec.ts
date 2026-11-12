import { expect, test } from "@playwright/test";
import { base32Decode, stepAt, totpCode } from "./totp";

// RFC 6238 appendix B: the shared secret is the ASCII string "12345678901234567890".
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test.describe("totp helper", () => {
  test("decodes base32", () => {
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe("12345678901234567890");
  });

  test("matches the RFC 6238 test vectors (8 digits)", () => {
    expect(totpCode(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totpCode(RFC_SECRET, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totpCode(RFC_SECRET, 2_000_000_000_000, 8)).toBe("69279037");
  });

  test("produces 6 digits by default and changes each 30-second window", () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe("287082");
    expect(stepAt(29_999)).toBe(0);
    expect(stepAt(30_000)).toBe(1);
    expect(totpCode(RFC_SECRET, 0)).not.toBe(totpCode(RFC_SECRET, 30_000));
  });
});
