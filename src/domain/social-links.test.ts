import { describe, expect, it } from "vitest";
import { normalizeSocialUrl } from "./social-links";

describe("normalizeSocialUrl", () => {
  it.each([
    ["youtube", "https://www.youtube.com/@mybakery", "https://www.youtube.com/@mybakery"],
    ["youtube", "https://youtu.be/abc123", "https://youtu.be/abc123"],
    ["facebook", "www.facebook.com/mybakery", "https://www.facebook.com/mybakery"],
    ["facebook", "http://m.facebook.com/mybakery", "https://m.facebook.com/mybakery"],
    [
      "linkedin",
      "https://za.linkedin.com/company/mybakery#about",
      "https://za.linkedin.com/company/mybakery",
    ],
  ] as const)("accepts %s link %s", (platform, input, expected) => {
    expect(normalizeSocialUrl(platform, input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["youtube", "https://evil.example/youtube.com"],
    ["youtube", "https://youtube.com.evil.example/x"],
    ["youtube", "https://notyoutube.com/x"],
    ["facebook", "javascript:alert(1)"],
    ["facebook", "data:text/html,<script>alert(1)</script>"],
    ["linkedin", "https://user:pass@linkedin.com/in/x"],
    ["linkedin", "https://linkedin.com:8443/in/x"],
    ["linkedin", "https://facebook.com/x"],
    ["youtube", ""],
    ["youtube", "https://youtube.com/" + "a".repeat(300)],
  ] as const)("rejects %s link %j", (platform, input) => {
    expect(normalizeSocialUrl(platform, input)).toEqual({ ok: false, error: "invalid_url" });
  });
});
