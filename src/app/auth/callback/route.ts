import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { createClient } from "@/infrastructure/supabase/server";

/** Completes email-confirmation links: swaps the one-time code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
