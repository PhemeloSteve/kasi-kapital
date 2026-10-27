import { err, ok, type Result } from "./result";

export type SocialPlatform = "youtube" | "facebook" | "linkedin";

const allowedDomains: Record<SocialPlatform, readonly string[]> = {
  youtube: ["youtube.com", "youtu.be"],
  facebook: ["facebook.com", "fb.com"],
  linkedin: ["linkedin.com"],
};

/**
 * Accepts only real https links to the named platform. Anything else (other sites,
 * javascript: links, links with embedded passwords) is rejected, so a profile can never
 * be used to send visitors somewhere unexpected.
 */
export function normalizeSocialUrl(
  platform: SocialPlatform,
  input: string,
): Result<string, "invalid_url"> {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 300) return err("invalid_url");

  let candidate = trimmed;
  if (/^http:\/\//i.test(candidate)) candidate = `https://${candidate.slice(7)}`;
  else if (!/^https:\/\//i.test(candidate)) {
    // A bare "www.facebook.com/page" is fine; anything with another scheme (javascript:, data:) is not.
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(candidate))
      return err("invalid_url");
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return err("invalid_url");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return err("invalid_url");

  const host = url.hostname.toLowerCase();
  const allowed = allowedDomains[platform].some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
  if (!allowed) return err("invalid_url");

  url.hash = "";
  return ok(url.toString());
}
