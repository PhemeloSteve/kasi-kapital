import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { describeCspReport } from "@/domain/csp-report";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024;

/**
 * Browsers send a short report here whenever our Content Security Policy blocks something. It is public by
 * nature (the browser sends it without signing in), so it only ever writes one trimmed log line, refuses
 * large bodies, and keeps no state. A burst of violations on a page that used to be clean means a script is
 * being injected, or a change broke the policy.
 */
export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return new NextResponse(null, { status: 413 });

  const text = await request.text();
  if (text.length > MAX_BYTES) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const violation = describeCspReport(body);
  if (violation) console.warn("[csp] violation", violation);
  return new NextResponse(null, { status: 204 });
}
