# Security policy

## Reporting a vulnerability

Please do **not** open a public issue. Use [GitHub's private vulnerability reporting](https://github.com/PhemeloSteve/kasi-kapital/security/advisories/new) (the repository's **Security** tab, then **Report a vulnerability**) with a description and steps to reproduce. The same address is published at `/.well-known/security.txt`. You will get an acknowledgement within 72 hours.

## Scope and practices

- Authentication via Supabase Auth; MFA required for admin accounts.
- Row Level Security on all tables; money movement happens only server-side.
- Private storage with signed URLs for identity and bank documents.
- Uploaded documents are checked by content type and size, stored privately and opened only through short-lived links; administrator access to documents is logged.
- Administrators need two-factor login, enforced in the database as well as the app; spam-prone actions are rate limited per person.
- Money rules are enforced in the database; only the server can confirm a payment or record a payout, and the service-role key is confined to one server-only file.
- Uploads are checked before they are stored: PDFs that can run scripts, carry attachments or are password protected are refused, and photos are rewritten without hidden location data.
- A nonce-based Content Security Policy blocks injected scripts, and sign-in cookies cannot be read by scripts.
- Sign-in and sign-up are protected by a Cloudflare Turnstile check that Supabase verifies.
- Rejected documents and proof files are deleted automatically 30 days after rejection.
- Dependencies that ship to users are audited (a failure blocks the build), an SBOM is generated and secrets are scanned in CI.
- Personal information is handled under POPIA; breaches will be reported to the Information Regulator and affected users as required.

## Never commit

API keys, the Supabase service-role key, `.env.local`, identity documents or any real personal data. If a secret is exposed, rotate it immediately; deleting it from git history is not enough.
