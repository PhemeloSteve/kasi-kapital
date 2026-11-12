# Kasi Kapital

![CI](https://github.com/PhemeloSteve/kasi-kapital/actions/workflows/ci.yml/badge.svg)
[![MIT License](https://img.shields.io/badge/licence-MIT-green.svg)](LICENSE)

> **Your kasi, your capital.** Community funding for South Africa's small businesses. Young founders build a verified track record; neighbours, donors and companies discover, back and follow them.

Built for the **FNB 2026 Hackathon** — theme: _Youth entrepreneurship and small-business growth_. Solo build.

---

## The problem

South Africa has a **47.4% youth unemployment rate** (Stats SA, Q2 2026) and an estimated **R350 billion SME funding gap**. Starting a business is one of the few real ways out, but young founders in townships and rural areas have no collateral, no credit history, and no way for their community to see their work. People who would gladly back a local business cannot tell the genuine ones from the scams.

## The idea

Inspired by the stokvel tradition of pooling resources, Kasi Kapital brings that community trust to a verified digital platform.

- **Founders** create a business profile, state a funding goal (chickens, an oven, stock) and upload proof of spending at each milestone.
- **Supporters** (individuals, investors and corporate donors) discover verified businesses nearby or by category, review their track record and fund a goal.
- **Money is released against proof** — an invoice or quote checked by an administrator — not up front. A later milestone never gets paid before an earlier one.
- **Every business is checked** before it appears to supporters: identity, bank statement and company registration.

---

## Screenshots

| Sign in                             | Supporter dashboard                          | Founder dashboard                               |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Green panel + cream card, your logo | Stat cards, business grid with progress bars | Active goal, milestone rows, verification panel |

---

## Account types

| Role       | What they can do                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `business` | Create and verify a business, set goals, upload milestone proof                                           |
| `investor` | Browse verified businesses, contribute to goals, track contributions                                      |
| `donor`    | Corporate or individual donations, nothing expected back                                                  |
| `admin`    | Review documents and proof. Super admins also pay out, read the audit log and manage businesses and users |

## Funding types (phased by legal risk)

1. **Donations** — nothing expected back
2. **Community pre-sales** — supporters get goods or vouchers
3. **Equity or revenue-share** through a licensed partner — roadmap only, see [Legal notes](#legal-notes)

---

## Tech stack

| Layer      | Technology                                                              |
| ---------- | ----------------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router), React, TypeScript, PWA                         |
| UI         | Tailwind CSS, custom green/cream design system                          |
| Maps       | Leaflet + OpenStreetMap                                                 |
| Backend    | Supabase (PostgreSQL, Auth, Storage, Row Level Security)                |
| Geo search | PostGIS                                                                 |
| Validation | Zod 4                                                                   |
| Testing    | Vitest unit tests and SQL database checks                               |
| CI         | GitHub Actions (lint, typecheck, tests, build, audit, CodeQL, DB tests) |
| Hosting    | Vercel + Supabase                                                       |

Payment providers, identity verification and open banking are **mock implementations** behind swappable interfaces. Nothing in this repository moves real money.

---

## Getting started

### Prerequisites

- Node.js 22.12+
- A Supabase project (free tier works)

### Setup

```bash
git clone https://github.com/PhemeloSteve/kasi-kapital.git
cd kasi-kapital
npm install
cp .env.example .env.local   # fill in your values
```

### Environment variables

| Variable                        | Where to find it                                                           | Required            |
| ------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API                                          | Yes                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API                                          | Yes                 |
| `NEXT_PUBLIC_APP_URL`           | Your deployed URL or `http://localhost:3000`                               | Yes                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Project Settings → API                                          | Yes (demo payments) |
| `PAYMENT_PROVIDER`              | Set to `mock`                                                              | Yes                 |
| `ALLOW_MOCK_PAYMENTS`           | `true` on demo sites only; production refuses the mock provider without it | Optional            |
| `ALLOW_DEMO_KYC`                | Set to `true` for demos only                                               | Optional            |
| `WEBHOOK_SECRET`                | A random value of 16+ characters you choose                                | For admin emails    |
| `RESEND_API_KEY`                | resend.com → API Keys                                                      | For admin emails    |
| `ADMIN_NOTIFY_EMAIL`            | The address that receives admin alerts                                     | For admin emails    |

Never commit `.env.local`. The `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never reach the browser.

### Database

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Create two **private** storage buckets in the Supabase dashboard: `business-documents` and `identity-documents`.

### Run

```bash
npm run dev        # http://localhost:3000
npm run check      # lint + typecheck + format + tests
npm run build
```

### Database tests (needs local PostgreSQL with PostGIS)

```bash
PGHOST=localhost PGUSER=postgres ./supabase/tests/run_tests.sh
```

Each test file runs on its own throwaway database. Your Supabase project is never touched.

### End-to-end tests (needs Docker)

Playwright drives a real browser through the whole story: a founder is verified by an administrator
(with two-factor login), raises money through the demo checkout, proves the spending, and the payout
is released. A second file checks that each role can only reach what it should.

```bash
npx supabase start          # local database, applies every migration
npm run e2e:install         # one-off: downloads the test browser
npm run e2e                 # builds the app, seeds fresh test accounts, runs the tests
npm run e2e -- --ui         # watch it run
```

The tests refuse to run against anything but a local Supabase stack, because they create accounts with
the service key. Test accounts use `@example.test` addresses and a run id, so reruns never collide.
`npx supabase db reset` clears them.

---

## Supabase dashboard setup (one-off)

1. **Authentication → Email:** turn off **Confirm email** while developing. Turn it back on before real users sign up.
2. **Authentication → URL Configuration:** set Site URL to `http://localhost:3000`, add `http://localhost:3000/auth/callback` to Redirect URLs.
3. **Authentication → Multi-Factor:** make sure TOTP is enabled (required for admin accounts).
4. **Storage:** create private buckets `business-documents` and `identity-documents`.
5. **First admin:** sign up normally, then in the SQL Editor:

```sql
update public.profiles set role = 'admin', admin_level = 'super_admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Admins have one of two levels. A `reviewer` can review documents and proof. A `super_admin` can also pay out, read the audit log and suspend businesses. An admin with no level recorded counts as a reviewer. Only a super admin, or the SQL Editor, can change a level.

---

## Administrator two-factor login

Admins must complete an authenticator app setup before they can use any admin powers. The database enforces this — a stolen password alone gives nothing.

- Set it up immediately after promoting an account to admin.
- **Lost your phone?** Run this in the SQL Editor, then set up a new authenticator at next login:

```sql
delete from auth.mfa_factors
where user_id = (select id from auth.users where email = 'you@example.com');
```

---

## Admin email notifications

When a business is submitted for verification or milestone proof arrives, `/api/webhooks/admin-notify` emails the administrator through Resend. It refuses every call until `WEBHOOK_SECRET` is set.

1. Add `WEBHOOK_SECRET`, `RESEND_API_KEY` and `ADMIN_NOTIFY_EMAIL` to your hosting settings.
2. In Supabase, go to Database → Webhooks and create two webhooks that `POST` to `https://<your-app>/api/webhooks/admin-notify` with the header `Authorization: Bearer <WEBHOOK_SECRET>`: one for table `businesses` (event `UPDATE`) and one for table `milestones` (event `UPDATE`).

The route ignores every change except a business becoming `pending` and a milestone becoming `proof_submitted`. More detail is in `docs/admin-improvements/`.

---

## Payments in this build

Payments are **simulated**. No real money moves. The demo checkout calls a mock provider that confirms instantly. To enable it locally, add `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_PROVIDER=mock` and `ALLOW_DEMO_KYC=true` to `.env.local`.

A production server refuses the mock provider unless `ALLOW_MOCK_PAYMENTS=true` is also set, so forgetting to configure a real provider switches payments off instead of letting anyone pay with pretend money. Set it only on a demo site, and remove `ALLOW_DEMO_KYC` before going to production.

---

## Security design

- Row Level Security on every table; the browser only ever uses the anon key.
- Roles, verification status and money rules are enforced in the database — not just the app.
- Admin powers require two-factor login, enforced in the database as well as the UI.
- Two admin levels: reviewers handle documents and proof; only super admins can pay out, read the audit log, and suspend businesses or list users. Nobody can promote themselves.
- Every suspension, reinstatement and admin document view is written to the audit log.
- The demo payment provider is refused in production unless explicitly allowed.
- The admin webhook checks a shared secret and refuses all calls when none is set.
- Private documents served through 60-second signed URLs; every admin view is audit-logged.
- Per-person rate limits on contributions, uploads and proof submissions.
- Open checkouts capped at 5 per supporter; expired ones stop counting.
- Strict security headers in `next.config.mjs`, plus a nonce-based Content Security Policy built for every request in `src/middleware.ts`: no inline scripts can run.
- Locations rounded to ~1 km before storage; never a home address.
- `npm audit` gate, CycloneDX SBOM, Dependabot, gitleaks and CodeQL in CI.

---

## POPIA compliance

- Data minimisation: only what is needed for each purpose.
- Explicit consent at sign-up and before document upload, timestamped by the database.
- Short-lived signed URLs for private documents; every admin access is logged.
- Retention and deletion rules for identity and banking documents.
- A designated Information Officer and published privacy policy are required before launch.
- Prefer South African hosting regions; cross-border transfers must meet POPIA section 72.

---

## Legal notes

Not legal advice. Before going live:

- Equity offerings trigger the Companies Act prospectus rules. Small-offer exemption: up to 50 people, R1 million, 6 months.
- Platforms that pool or move funds may fall under FAIS, the Financial Markets Act, the National Credit Act or the Banks Act. Never hold investor money directly — use a licensed payment provider.
- FICA and KYC obligations apply for identity verification.

---

## Architecture

Layered architecture (domain → application → infrastructure → UI) with ports and adapters. The dependency direction is enforced by ESLint. See [ARCHITECTURE.md](ARCHITECTURE.md) and `docs/adr/`.

```
src/
  domain/          # pure business rules, no framework imports
  application/     # use cases + ports (interfaces)
  infrastructure/  # Supabase, payment, KYC, banking adapters
  config/          # Zod-validated environment variables
  app/             # Next.js App Router pages and server actions
  components/      # UI components
supabase/
  migrations/      # 9 migrations (schema, RLS, functions, triggers)
  tests/           # SQL checks across 7 test files
.github/
  workflows/       # CI: quality, security, database
```

| Practice           | How it is applied                                                                 |
| ------------------ | --------------------------------------------------------------------------------- |
| DRY / KISS / YAGNI | One rule per concern in `domain`; equity disabled until a licensed partner exists |
| Testing            | Vitest unit tests (with coverage) + SQL database checks in CI                     |
| Security           | RLS, MFA, rate limits, signed URLs, audit log, secret scanning                    |
| CI/CD              | GitHub Actions: lint, typecheck, format, test, build, audit, CodeQL, DB tests     |
| Supply chain       | `npm audit`, CycloneDX SBOM, Dependabot, gitleaks                                 |

---

## Roadmap

- [x] Auth, roles and POPIA consent
- [x] Business profiles with approximate map location
- [x] Document upload, admin verification queue and trust levels
- [x] Discovery: search, category filter, near me with a map
- [x] Funding goals with milestones (locked once funded)
- [x] Contributions, demo checkout, milestone proof, admin approval and payouts
- [x] Supporter dashboard with stat cards and business grid
- [x] Founder dashboard with goal card, milestone rows and verification panel
- [x] Admin two-factor login (enforced in the database)
- [x] Per-person rate limits and unpaid-checkout cap
- [x] Full UI — green/cream design, your logo, responsive on mobile and desktop
- [x] Database tests in CI
- [x] Admin levels, audit log page, business suspension, user list and platform stats
- [x] Admin email notifications through a secured webhook
- [ ] Production hardening: secure cookies, CSP nonces, login CAPTCHA
- [ ] Deploy to Vercel
- [ ] Seed data for the demo
- [ ] Live KYC, open-banking and payment providers
- [ ] Supply circles: bulk buying and stock swaps
- [ ] Licensed equity / revenue-share partnership

---

## Licence

[MIT](LICENSE) © 2026 PhemeloSteve
