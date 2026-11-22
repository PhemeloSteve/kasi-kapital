# Rotating a secret

Do this when a key, token or password may have been seen by someone else (pasted in a chat, committed to
Git, shown in a screenshot, or a laptop was lost). Rotate first, investigate after. Menu names in the
dashboards change now and then; the idea stays the same.

**The pattern for every key:** create a new one, put it where it is used, redeploy, check the site, then
delete the old one.

| Secret                                      | Where it lives                                     | What changing it affects                                                |
| ------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                 | Vercel (server only)                               | Everything the server does for payments, retention and account deletion |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | Vercel (public by design)                          | The whole site; rotating the project's JWT secret signs everyone out    |
| Database password                           | Supabase, and your machine for `db push`           | Only things that connect to the database directly                       |
| `CRON_SECRET`                               | Vercel, Production                                 | The daily retention job                                                 |
| `WEBHOOK_SECRET`                            | Vercel **and** the header of the Supabase webhooks | The alert and notification emails                                       |
| `RESEND_API_KEY`                            | Vercel                                             | Alert emails                                                            |
| Turnstile secret key                        | Supabase dashboard only                            | Sign-in and sign-up robot check                                         |
| Turnstile site key                          | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel         | Public; rotate with the secret key                                      |
| GitHub access (personal tokens, your login) | GitHub                                             | Pushing code; revoke tokens, change the password, check the sessions    |

## Steps by secret

**`CRON_SECRET`, `WEBHOOK_SECRET`:** generate a new value (`openssl rand -hex 32`). Update Vercel, then (for
the webhook) update the `Authorization` header on **every** Supabase webhook that uses it. Redeploy. Test
with the `curl` call in [RETENTION.md](../hardening/RETENTION.md) (cron) or by suspending and reinstating a
throwaway business (webhook).

**`RESEND_API_KEY`:** create a new key in Resend, update Vercel, redeploy, delete the old key in Resend.

**`SUPABASE_SERVICE_ROLE_KEY`:** this key bypasses every access rule, so treat a leak as serious. In the
Supabase dashboard, open the project's API settings and rotate or regenerate the service role key (or the JWT
secret, if that is the only option your plan shows; that also changes the anon key and signs everyone out).
Update Vercel with the new key, redeploy, then check a sign-in, a contribution (demo) and the retention
`curl`. If the old key was ever public, also read [incident-response.md](incident-response.md): someone may have
read or changed anything.

**Database password:** Supabase, Database settings, reset the password. Update anything that stores it (your
machine's saved login for `npx supabase db push`; run `npx supabase login` and `npx supabase link` again if
asked).

**Turnstile:** in the Cloudflare dashboard, create a new widget (or roll the secret), put the new **secret**
in Supabase (Authentication, Attack Protection) and the new **site key** in Vercel, redeploy. Keep the old
widget until the new one works, so sign-in is never open without the check for long.

**A secret committed to Git:** deleting the file does not remove it from history. Rotate the secret first.
The repository runs `gitleaks` on every change, which should have caught it; check why it did not.

## Afterwards

Write down which secret, when, and why in your incident notes. If you cannot tell whether a secret was used
by someone else, assume it was and follow the incident steps.
