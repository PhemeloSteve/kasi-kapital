# Security policy

## Reporting a vulnerability

Please do **not** open a public issue. Email the maintainer (add your contact address here) with a description and steps to reproduce. You will get an acknowledgement within 72 hours.

## Scope and practices

- Authentication via Supabase Auth; MFA required for admin accounts.
- Row Level Security on all tables; money movement happens only server-side.
- Private storage with signed URLs for identity and bank documents.
- Dependencies audited, SBOM generated and secrets scanned in CI.
- Personal information is handled under POPIA; breaches will be reported to the Information Regulator and affected users as required.

## Never commit

API keys, the Supabase service-role key, `.env.local`, identity documents or any real personal data. If a secret is exposed, rotate it immediately; deleting it from git history is not enough.
