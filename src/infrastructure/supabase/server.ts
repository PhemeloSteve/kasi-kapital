import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parsePublicEnv } from "@/config/env";
import { KEEP_COOKIE, sessionCookieOptions } from "./cookie-policy";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * A Supabase client that acts as the signed-in person. `persist` says whether sign-in cookies should
 * outlive the browser session; when left out it follows the person's "Keep me logged in" choice.
 */
export async function createClient(options?: { persist?: boolean }) {
  const env = parsePublicEnv();
  const cookieStore = await cookies();
  const persist = options?.persist ?? cookieStore.get(KEEP_COOKIE)?.value === "1";

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: CookieToSet[]) => {
        try {
          items.forEach(({ name, value, options: cookieOptions }) =>
            cookieStore.set(name, value, sessionCookieOptions(value, cookieOptions, persist)),
          );
        } catch {
          // Called from a Server Component; safe to ignore if middleware refreshes sessions.
        }
      },
    },
  });
}
