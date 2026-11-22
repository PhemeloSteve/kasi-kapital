// Turns what a browser sends when it blocks something (a Content Security Policy violation report) into a
// short, safe line for the logs. Pure, so it can be tested without a browser.

export type CspViolation = {
  /** Which rule was broken, for example "script-src-elem". */
  directive: string;
  /** What was blocked: an address without its query, "inline", "eval", or the kind of address ("data:"). */
  blocked: string;
  /** The page it happened on, without its query. */
  page: string;
  /** The script or file that tried it, without its query. */
  source: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Printable ASCII only and a hard length limit, so a report can never fill or forge a log line. */
function clean(value: unknown, max: number): string {
  return (typeof value === "string" ? value : "")
    .replace(/[^\x20-\x7e]/g, "")
    .trim()
    .slice(0, max);
}

/** Keeps where an address points, never its query or fragment, which can hold tokens or personal data. */
function placeOf(value: unknown): string {
  const text = clean(value, 500);
  if (text === "") return "";
  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${url.pathname}`.slice(0, 200);
    }
    return url.protocol.slice(0, 20); // "data:", "blob:", "chrome-extension:": never the content
  } catch {
    return clean(text, 40); // "inline", "eval", "self"
  }
}

/**
 * Reads either report format (the older `csp-report` object, or the Reporting API's list). Returns null for
 * anything that is not a violation report.
 */
export function describeCspReport(body: unknown): CspViolation | null {
  const entry = Array.isArray(body) ? asRecord(body[0]) : asRecord(body);
  if (!entry) return null;

  const report =
    asRecord(entry["csp-report"]) ?? (entry.type === "csp-violation" ? asRecord(entry.body) : null);
  if (!report) return null;

  const directive = clean(
    report["effective-directive"] ??
      report["violated-directive"] ??
      report.effectiveDirective ??
      report.violatedDirective,
    60,
  );
  if (directive === "") return null;

  return {
    directive,
    blocked: placeOf(report["blocked-uri"] ?? report.blockedURL),
    page: placeOf(report["document-uri"] ?? report.documentURL),
    source: placeOf(report["source-file"] ?? report.sourceFile),
  };
}
