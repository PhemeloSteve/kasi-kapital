import { timingSafeEqual } from "node:crypto";

/** Pulls the secret out of "Authorization: Bearer <secret>" or an "x-webhook-secret" header. */
export function extractWebhookSecret(headers: Pick<Headers, "get">): string | null {
  const auth = headers.get("authorization");
  if (auth && /^Bearer\s+\S+$/i.test(auth)) return auth.replace(/^Bearer\s+/i, "");
  return headers.get("x-webhook-secret");
}

/**
 * True only when a secret is configured AND the caller sent exactly that secret. With no secret
 * configured it fails closed (refuses everyone) rather than leaving the endpoint open. The comparison
 * takes the same time however many characters match.
 */
export function isValidWebhookSecret(
  provided: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
