import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parsePublicEnv } from "@/config/env";
import { KEEP_COOKIE, sessionCookieOptions } from "./cookie-policy";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Refreshes the Supabase session cookie on every request and reports whether a user is signed in. */
export async function updateSession(request: NextRequest) {
  const env = parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  const persist = request.cookies.get(KEEP_COOKIE)?.value === "1";
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items: CookieToSet[]) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, sessionCookieOptions(value, options, persist)),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  return { response, isAuthenticated: data.user !== null };
}
