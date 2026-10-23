# Kasi Kapital

> Community funding for South Africa's small businesses. Young founders build a verified track record; neighbours, donors and companies discover, back and follow them.

Built for the **FNB 2026 Hackathon**, theme: *Youth entrepreneurship and small-business growth*.

## The problem

South Africa has some of the highest youth unemployment in the world, and starting a business is one of the few real ways out. Young founders, especially in townships and rural areas, usually have no collateral, no credit history and no way for their community to see their work. People who would gladly back a local business cannot tell the genuine ones from the scams.

## The idea

Inspired by a community-funded local bakery, Kasi Kapital brings the stokvel spirit of pooling resources to a trusted digital platform.

- **Entrepreneurs** create a business profile, state a funding goal (chickens, an oven, stock) and keep a living record of progress.
- **Individuals and corporate donors** discover businesses nearby or by type, review the track record and fund a goal.
- **Funds are released against proof** (for example a supplier invoice), not up front.
- **Businesses collaborate** through bulk buying and stock swaps (roadmap).

## Account types

| Role | What they can do |
| --- | --- |
| `business` | Create and verify a business, set goals, upload proof, post updates |
| `investor` | Browse, verify identity, contribute to goals |
| `donor` | Corporate or individual donations, impact reporting |
| `admin` | Review verification, handle reports, view the audit log |

## Funding types (phased by legal risk)

1. **Donations** (no return expected)
2. **Rewards / community pre-sales** (vouchers, future goods)
3. **Equity or revenue-share** through a licensed partner (roadmap, see [Legal notes](#legal-notes))

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React, TypeScript, PWA |
| UI | Tailwind CSS |
| Maps | Leaflet + OpenStreetMap |
| Backend | Supabase (PostgreSQL, Auth, Storage, Row Level Security) |
| Geo search | PostGIS |
| Validation | Zod |
| Testing | Vitest |
| CI | GitHub Actions |
| Hosting | Vercel or a South African cloud region (AWS af-south-1 / Azure South Africa North) |

External providers for identity verification, open banking and payments are **sandbox or mock implementations** behind swappable interfaces in `src/lib/providers/`. Nothing in this repository moves real money.

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (or the Supabase CLI for local development)

### Setup

```bash
git clone <your-repo-url> kasi-kapital
cd kasi-kapital
npm install
cp .env.example .env.local     # then fill in the values
```

### Database

Apply the schema in `supabase/migrations/0001_init.sql` using the Supabase SQL editor or the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Create two **private** storage buckets: `business-documents` and `identity-documents`.

### Run

```bash
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment variables

See `.env.example`. Never commit `.env.local`. The `SUPABASE_SERVICE_ROLE_KEY` must only be used in server code and must never be exposed to the browser.

## Security design

- Row Level Security enabled on every table; the browser only ever uses the anon key.
- Roles are enforced in the database, and users cannot change their own role or verification status.
- Private documents (ID, bank statements) are stored in private buckets and served by short-lived signed URLs.
- MFA required for admin accounts.
- Strict security headers and a Content Security Policy (`next.config.mjs`).
- Input validation with Zod on every server action and API route.
- Audit log for verification decisions and money-related actions.
- No off-platform payments: only the platform moves funds, and funds are released on verified milestones.

### Protecting businesses from bad actors

- Locations are shown at suburb or ward level only, never a home address.
- No public phone numbers or personal contact details; all contact is in-app.
- Users can block and report; admins can suspend accounts.
- New investors have contribution limits until verified.

## POPIA compliance

- Collect only what is needed for the stated purpose (data minimisation).
- Explicit consent captured at sign-up and before document upload.
- Retention and deletion rules for identity and banking documents.
- A designated Information Officer and a published privacy policy are required before launch.
- Breach-notification process for the Information Regulator and affected users.
- Prefer South African hosting regions; cross-border transfers must meet POPIA section 72.

## Legal notes

This is a design summary, **not legal advice**. Before going live, get a corporate attorney to confirm:

- Only a CIPC-registered company can issue shares. Offering shares to the public triggers the Companies Act prospectus rules, with a small-offer exemption (up to 50 people, R1 million, six months, not repeated within 12 months).
- Platforms that arrange equity, lending or pool funds may fall under FAIS, the Financial Markets Act, the National Credit Act or the Banks Act. The platform should never hold investor money directly; use a licensed payment provider or an attorney's trust account.
- FICA and KYC obligations for verifying users.

## Project structure

```
kasi-kapital/
  src/
    app/                 # Next.js routes
    components/
    lib/
      supabase/          # browser and server clients
      providers/         # kyc, banking, payments (mock/sandbox)
  supabase/
    migrations/          # SQL schema + RLS
  public/                # PWA manifest and icons
  .github/workflows/     # CI
```

## Roadmap

- [ ] Auth, roles and business profiles
- [ ] Document upload and admin verification queue
- [ ] Discovery: map and category filters
- [ ] Funding goals, milestones and escrow-style release
- [ ] Investor and donor views
- [ ] Supply circles: bulk buying and stock swaps
- [ ] YouTube, Facebook and LinkedIn link-outs
- [ ] Live KYC, open-banking and payment providers
- [ ] Licensed equity / revenue-share partnership

## Licence

TBD
