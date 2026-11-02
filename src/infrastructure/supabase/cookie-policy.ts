/** Remembers, in a small cookie, whether the person ticked "Keep me logged in". */
export const KEEP_COOKIE = "kk-keep";

type Options = { maxAge?: number; expires?: Date | number | string };

/**
 * Supabase marks its sign-in cookies as long-lived. When the person did not choose "Keep me logged in",
 * the expiry is removed so the browser forgets the sign-in when it closes. Cookies being deleted
 * (empty value, or a lifetime of zero) are left alone, so signing out still works.
 */
export function sessionCookieOptions<T extends Options>(
  value: string,
  options: T,
  persist: boolean,
): T {
  if (persist || value === "" || options.maxAge === 0) return options;
  return { ...options, maxAge: undefined, expires: undefined };
}
