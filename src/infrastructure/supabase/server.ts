import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parsePublicEnv } from "@/config/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const env = parsePublicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: CookieToSet[]) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; safe to ignore if middleware refreshes sessions.
        }
      },
    },
  });
}
