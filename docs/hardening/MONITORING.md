# Monitoring and alerts

What is in place in the code, and what you set up in the dashboards. Nothing here needs a paid plan.

## In the code

| What                           | Where                        | What it does                                                                                                       |
| ------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Health check                   | `GET /api/health`            | 200 `{"ok":true}` when the site is up and can reach the database, 503 otherwise. Public, says nothing else.        |
| Policy violation reports       | `POST /api/csp-report`       | Browsers send a report when the Content Security Policy blocks something. One trimmed log line, `[csp] violation`. |
| Alert: sensitive admin actions | `/api/webhooks/admin-notify` | Email when a business is suspended, reinstated or closed, or a payout is created or paid.                          |
| Alert: failed retention run    | `/api/cron/retention`        | Email when the daily clean-up fails or leaves documents behind. A normal run sends nothing.                        |

Alert emails only go out once the email settings exist (below). Until then they are logged as
`[email] not configured; would have sent: ...`.

## Set up (about 20 minutes, in the dashboards)

1. **Uptime monitor.** Use any free one (for example UptimeRobot or Better Stack). Add three checks, every 5
   minutes, with your email as the contact:
   - `https://kasi-kapital.vercel.app/api/health`, and tell it to look for the text `"ok":true`;
   - `https://kasi-kapital.vercel.app/`;
   - `https://kasi-kapital.vercel.app/login`.
2. **Alert emails.** In Vercel, Production, add `WEBHOOK_SECRET` (random, 16+ characters), `RESEND_API_KEY`,
   `ADMIN_NOTIFY_EMAIL` and, once you have your own domain on Resend, `NOTIFY_FROM_EMAIL`. Redeploy.
3. **Webhook for the audit log.** Supabase, Database, Webhooks: create a webhook on the table `audit_log`,
   event **Insert**, method POST, URL `https://kasi-kapital.vercel.app/api/webhooks/admin-notify`, header
   `Authorization: Bearer <WEBHOOK_SECRET>`. (The two webhooks from `docs/admin-improvements` for new
   submissions and proof stay as they are.) The code decides which actions deserve an email.
4. **Check it.** Suspend and reinstate a throwaway business and confirm two emails arrive. Delete nothing you
   cannot get back.

## Reading the logs

Search the Vercel runtime logs for these prefixes: `[csp]`, `[retention]`, `[health]`, `[email]`, `[account]`,
`[webhook]`, `[admin]`. Messages carry an error code or a count, never a name, email or document.

**Retention of logs is short.** On the Hobby plan Vercel keeps runtime logs for about an hour (check the
current limit in the Vercel pricing page). For anything you may need later, copy the lines into your incident
notes straight away. A log drain or an error-tracking service (for example Sentry, which has a free tier)
fixes this properly; it needs an account and a small change to the Content Security Policy, so it is a
separate step.

## A burst of `[csp] violation` lines

On a page that used to be clean this means either a script is being injected, or a change broke the policy.
Look at `directive`, `blocked` and `page` in the line. A one-off from a browser extension (blocked address
starting with `chrome-extension:` or `moz-extension:`) is normal noise.

## Not covered yet

- Error tracking with history (see above), and alerts for repeated failed sign-ins or a new admin session:
  Supabase keeps those in its own Auth logs, not in our database.
- Backups: see [the backups runbook](../runbooks/backups.md). This is the biggest open item before real
  money or real identity documents are held.
