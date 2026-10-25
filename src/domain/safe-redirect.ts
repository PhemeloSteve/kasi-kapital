const BASE = "http://redirect-check.invalid";

/**
 * Only allows same-site relative paths, so a crafted `?next=` link can never
 * send a user to another website after login (open-redirect protection).
 */
export function safeRedirectPath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 500) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(input)) return fallback;
  try {
    const url = new URL(input, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
