import { NextResponse, type NextRequest } from "next/server";
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
  const { response, isAuthenticated } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const needsLogin = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (needsLogin && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
