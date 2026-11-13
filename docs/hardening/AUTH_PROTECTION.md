# Protecting sign-in and sign-up from automated attacks

Sign-in and sign-up are the doors bots try first: guessing passwords, stuffing in leaked credentials,
and creating thousands of fake accounts. Three layers protect them, and **the order you switch them on
matters**.

| Layer                      | Where                | What it stops                                          |
| -------------------------- | -------------------- | ------------------------------------------------------ |
| Cloudflare Turnstile check | Supabase (checks it) | Scripts and bots, including ones that skip the website |
| Supabase rate limits       | Supabase dashboard   | Floods of requests from one address                    |
| Vercel Firewall rate limit | Vercel dashboard     | Floods that never reach the app                        |

The website only shows the check and passes its answer on. **Supabase** is the one that verifies it, so
someone calling Supabase's sign-in address directly (the public key is in every page) is stopped too.

## 1. Create the Turnstile widget (Cloudflare, free)

1. Sign in at dash.cloudflare.com, then go to **Turnstile**, then **Add widget**.
2. Name it `Kasi Kapital`. Add your domains: `kasi-kapital.vercel.app` (and your own domain if you have
   one). `localhost` is accepted for local testing.
3. Widget mode: **Managed**. Create it, then copy the **Site key** (public) and **Secret key** (private).

## 2. Show the widget on the website first (nothing is enforced yet)

1. Vercel, your project, **Settings**, **Environment Variables**: add `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   with the **site key**, for **Production and Preview**.
2. Redeploy. Open the live `/login` and `/signup`: a small "Verify you are human" box should appear
   above the button, and signing in must still work.

Do **not** put the secret key in Vercel. It belongs only in Supabase (next step).

## 3. Make Supabase require it

1. Supabase, **Authentication**, **Attack Protection** (older dashboards: Authentication, Settings,
   "Bot and Abuse Protection"): turn on **Enable CAPTCHA protection**, choose **Cloudflare Turnstile**,
   and paste the **Secret key**. Save.
2. Test on the live site: sign in normally (works), then try sign-in with the box not yet solved (you
   should see "Please complete the security check").

**Never do step 3 before step 2.** If Supabase requires a check the website does not send, nobody can
sign in. Rollback: switch CAPTCHA protection off in the same Supabase screen.

## 4. Tighten Supabase rate limits

Supabase, **Authentication**, **Rate Limits**. Lower the sign-in and sign-up limits per IP from the
defaults to something a real person never hits (for example about 10 to 20 per 5 minutes), and keep the
authenticator-code (MFA) limit low. These limits already protect you even if someone bypasses the website.

## 5. Add a Vercel Firewall rate limit

Vercel, your project, **Firewall**, **Add Rule**:

- **If** request path equals `/login` **or** `/signup` **and** method is `POST`
  (the forms post to the same address as the page)
- **Then** rate limit: about 10 requests per minute per IP, action **Deny** (or Challenge)

Plan limits for rules vary, so check what your plan allows.

## Local development and tests

Leave `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset: the widget is not shown and nothing requires it, so
`npm run dev` and `npm run e2e` work as before. To try it locally, Cloudflare publishes test keys:
site key `1x00000000000000000000AA` (always passes) and secret `1x0000000000000000000000000000000AA`.
