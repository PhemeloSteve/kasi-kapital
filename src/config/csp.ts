/**
 * The Content Security Policy sent with every page. It tells the browser exactly which scripts may run,
 * so a script an attacker manages to slip into a page (cross-site scripting) is refused.
 *
 * Scripts are allowed only when they carry this request's one-time nonce, or were loaded by a script that
 * does ('strict-dynamic'). A nonce is a fresh random value for every request, so an attacker cannot guess
 * it. There is no 'unsafe-inline' for scripts. Styles still allow inline rules, because React sets some
 * styles directly (progress bars) and the map library does too; that is a much smaller risk than scripts.
 */

/** A fresh, unguessable value for one request (16 random bytes, base64). */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** The websocket address matching an http(s) address (https becomes wss, http becomes ws). */
function websocketOriginOf(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return parsed.origin;
  } catch {
    return "";
  }
}

export type CspInput = {
  nonce: string;
  /** The Supabase project address (NEXT_PUBLIC_SUPABASE_URL). */
  supabaseUrl: string;
  /** The Next.js development server needs eval for hot reloading. Never true on a live site. */
  development: boolean;
};

export function buildCsp({ nonce, supabaseUrl, development }: CspInput): string {
  const supabase = originOf(supabaseUrl);
  const supabaseSocket = websocketOriginOf(supabaseUrl);

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
      supabase,
    ]
      .filter(Boolean)
      .join(" "),
    "font-src 'self'",
    ["connect-src 'self'", supabase, supabaseSocket].filter(Boolean).join(" "),
    "frame-src https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
