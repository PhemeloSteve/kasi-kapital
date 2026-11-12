/** Remembers, in a small cookie, whether the person ticked "Keep me logged in". */
export const KEEP_COOKIE = "kk-keep";

type Options = {
  maxAge?: number;
  expires?: Date | number | string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
};

/** Sign-in cookies are only sent over HTTPS on a live site. Local development runs over plain HTTP. */
export const cookiesAreSecure = () => process.env.NODE_ENV === "production";

/**
 * The rules every sign-in cookie follows, whatever Supabase asks for:
 *
 * - `httpOnly`: scripts on the page can never read the session, so a script injected into a page
 *   (cross-site scripting) cannot steal it. The app signs in on the server and never needs the
 *   browser to read these cookies.
 * - `secure` on a live site: the browser never sends them over plain HTTP.
 * - `sameSite` lax (or stricter if asked): other sites cannot make the browser send them along with
 *   a request that changes anything. Lax still lets the emailed confirmation link sign people in.
 *
 * When the person did not choose "Keep me logged in", the expiry is removed so the browser forgets
 * the sign-in when it closes. Cookies being deleted (empty value, or a lifetime of zero) keep their
 * expiry, so signing out still works.
 */
export function sessionCookieOptions<T extends Options>(
  value: string,
  options: T,
  persist: boolean,
  secure = false,
): T {
  const hardened: T = {
    ...options,
    httpOnly: true,
    secure: secure || options.secure === true,
    sameSite: options.sameSite === "strict" ? "strict" : "lax",
  };
  if (persist || value === "" || options.maxAge === 0) return hardened;
  return { ...hardened, maxAge: undefined, expires: undefined };
}
