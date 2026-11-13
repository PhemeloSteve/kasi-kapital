import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/config/csp";
import { updateSession } from "@/infrastructure/supabase/middleware";

// Pages that need a signed-in user. Role checks happen again server-side in each page.
const protectedPrefixes = [
  "/business",
  "/investor",
  "/donor",
  "/admin",
  "/consent",
  "/documents",
  "/businesses",
  "/contributions",
  "/mock-checkout",
  "/verify-identity",
];

export async function middleware(request: NextRequest) {
  // A fresh nonce per request. Next.js reads the policy from the forwarded request and puts the nonce on
  // its own scripts; the browser then refuses any script that does not carry it.
  const csp = buildCsp({
    nonce: generateNonce(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    development: process.env.NODE_ENV === "development",
    turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  });
  const { response, isAuthenticated } = await updateSession(request, {
    "content-security-policy": csp,
  });
  response.headers.set("Content-Security-Policy", csp);
  const { pathname } = request.nextUrl;

  const needsLogin = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (needsLogin && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
