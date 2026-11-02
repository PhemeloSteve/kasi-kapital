# Architecture

Kasi Kapital uses a **layered (clean) architecture** so that business rules stay small, testable and independent of frameworks, databases and payment providers. This matters for a fintech-style product: the rules that protect money and people must be easy to read, test and audit.

## Layers and dependency rule

```
app / components  ->  application  ->  domain
                          ^
infrastructure  ----------+   (implements the ports defined by application)
```

Dependencies only point inwards. This is enforced by ESLint (`no-restricted-imports` in `.eslintrc.json`), so a violation fails CI.

| Layer          | Folder                      | Contains                                                                      | May import                |
| -------------- | --------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| Domain         | `src/domain`                | Pure business rules: contribution limits, milestone release, location privacy | Nothing outside the layer |
| Application    | `src/application`           | Use cases (e.g. `contribute`) and **ports** (interfaces)                      | Domain, Zod               |
| Infrastructure | `src/infrastructure`        | Supabase clients, KYC, banking and payment adapters (mock/sandbox/live)       | Application ports, Domain |
| Presentation   | `src/app`, `src/components` | Next.js routes, server actions, UI. Thin: parse, call a use case, render      | Application, Domain       |
| Config         | `src/config`                | Zod-validated environment variables (fail fast)                               | Zod                       |

## Why these choices

- **Swappable providers (ports and adapters):** KYC, open banking and payments are interfaces. The hackathon runs on mocks; going live means writing an adapter, not changing business rules.
- **Rules in one place (DRY):** `checkContribution` is the single source of truth for whether money may move. UI and API both go through the `contribute` use case.
- **Result type, not exceptions:** failures are explicit values, which keeps control flow simple (KISS) and makes every rejection path testable.
- **Validate at the boundary:** all external input is parsed with Zod before it reaches business logic.
- **Defence in depth:** database Row Level Security is the last line of defence; application and domain rules are the first. Neither replaces the other.
- **Build only what is needed (YAGNI):** equity and revenue-share contributions are rejected by the use case until a licensed partner exists. Collaboration features start as roadmap items.

## Security principles

1. Least privilege: the browser only uses the anon key; the service-role key is server-only.
2. Never trust the client: authorisation is enforced in RLS and re-checked in use cases.
3. Private by default: documents live in private buckets and are served by short-lived signed URLs.
4. Auditability: verification decisions and money movements are written to `audit_log`.
5. Privacy by design (POPIA): collect the minimum, show approximate locations only, keep retention rules.
6. Supply chain: lockfile committed, dependencies audited in CI, SBOM generated on every build, Dependabot keeps packages current, secrets scanned with gitleaks, CodeQL for static analysis.

## Authentication flow

- **Sign-up** (`signUp` use case): validates input with Zod, requires explicit POPIA consent, and offers only the `business`, `investor` and `donor` roles. The Supabase adapter passes the chosen role and a consent flag as metadata; the database trigger `handle_new_user` is the real authority: it never accepts `admin`, trims the name, and timestamps consent itself.
- **Login** (`logIn` use case): one generic "incorrect email or password" message so attackers cannot discover which emails exist; users without recorded consent are sent to `/consent` first.
- **Sessions:** `middleware.ts` refreshes the session cookie and redirects signed-out visitors away from protected pages. Pages then re-check role and consent on the server with `requireUser()`, using `auth.getUser()` (validated with Supabase), never an unverified cookie.
- **Redirects:** every `?next=` value passes through `safeRedirectPath`, which allows only same-site paths (open-redirect protection).
- **First admin:** created by an out-of-band SQL update, never through the app.
- **Known gaps (planned in the hardening step):** MFA enrolment for admins, app-level rate limiting (Supabase's built-in auth limits apply meanwhile), and confirm-email switched back on for production.

## Business profiles and funding goals

- **One business per account**, enforced by a unique index. Categories, social links and text lengths are checked in the database as well as in the app.
- **Location privacy twice over:** the app rounds coordinates to about 1 km (`coarsenLocation`), and the database function rounds them again, so an exact spot is never stored. The app reads only a `has_location` flag, never the point itself.
- **Founders cannot verify themselves:** a trigger blocks changes to `verification`, `trust_tier` and `owner_id` unless the caller is an administrator. The same applies to approving or rejecting milestones; founders can only submit proof.
- **Goals are created atomically:** `create_funding_goal` inserts the goal and its milestones in one transaction and refuses anything where the milestones do not add up exactly to the target, there are more than six, or the kind is equity (disabled until a licensed partner exists).
- **Funded goals are locked:** once a goal has received a contribution, its target, kind and milestone amounts cannot change, and it cannot be deleted. Approved milestones are frozen.
- **Server actions re-check the caller** with `requireUser(["business"])`, take the business from the signed-in session (never from the form), and run Supabase calls as the user, so row level security stays in force.

## Documents and verification

- **Private by construction:** ID documents go to the `identity-documents` bucket and business paperwork to `business-documents`. Both are private. Files live at `<business id>/<file>`, and storage rules let a founder add, read or delete only inside their own business folder, administrators read everything, and nobody can overwrite or rename a file.
- **The file's content decides, not its name:** the server checks the first bytes of every upload (PDF, JPEG or PNG), enforces a 4 MB limit and reads at most one byte beyond it. The browser's claimed type is ignored.
- **Open on demand, never shared:** documents are opened through `/documents/<id>/view`, which makes a fresh 60-second link per click and only for people the database lets see that document. When an administrator opens one, the audit log records it.
- **Founders cannot forge approval:** inserted documents are forced to `pending`, review fields are cleared, and a business can only be submitted for review when an ID and a bank statement are uploaded (enforced by a database trigger, not just the screen). Only an administrator can approve, and `review_document` recomputes the trust level in the same transaction.
- **Trust levels:** 1 = identity approved; 2 = identity plus proof of trading (a bank statement), which makes the business public; 3 = also CIPC-registered. Unregistered businesses can still reach level 2, so informal founders are not shut out.
- **Everything is audited:** document decisions, status and trust-level changes, and administrator views are written to `audit_log`, which only administrators can read.
- **Known gaps:** no virus scanning of uploads yet, uploads pass through the server (hence the 4 MB limit; signed upload URLs would lift it), admin accounts do not yet require MFA, and retention or deletion of approved documents when an account closes still needs a process.

## Discovery

- **Public fields only:** supporters search through two database functions (`discover_businesses`, `get_public_business`) that return only name, category, description, suburb, trust level, approximate map position, public links and a summary of open goals. They never return the owner, registration number, documents or review details, and they only ever return businesses with status `verified`.
- **Search is plain text:** `%`, `_` and `\` typed into the search box are treated as ordinary characters, not wildcards.
- **Near me:** the browser rounds the position to about 1 km before sending it, the app rounds it again, and it is only used for that one search (never stored). Results are ordered nearest first and businesses with no map area are left out of distance searches.
- **Safe URLs:** every search is a normal link. Unknown or malformed parameters (a made-up category, half a location, a page number of 9999) are ignored instead of causing errors.
- **Paging:** the database returns one row more than a page so the app knows whether a next page exists, and the page size is capped at 50.
- **Known gaps:** investors can still read verified business rows directly through the API (the app does not), which is acceptable until registration numbers are stored; discovery needs a signed-in account, and a public browse page is a possible later addition.

## Funding: contributions, escrow and payouts

- **Money model:** a contribution is `pending` while checkout is open and `held` once payment is confirmed. A goal's escrow balance is held contributions minus payouts. A milestone is paid out only after an administrator approves its proof **and** the balance covers it; approved milestones are paid in order, so a later one never jumps ahead of an earlier one. If money is short, the payout is created automatically when more arrives.
- **All money rules live in the database** (`start_contribution`, `confirm_contribution`, `review_milestone`, `settle_goal`) and run under row locks: no over-funding, a minimum and maximum amount, a R1 000 running total for supporters whose identity is not verified, checkouts that expire after 15 minutes, one payout per milestone ever, and payouts that can never exceed the money held. The limits are in a settings table the browser cannot read or change.
- **Only the server can confirm a payment.** `confirm_contribution`, recording payout results and setting identity status are executable by the service role alone, so no browser can mark itself as paid. The service-role key is used in one file (`infrastructure/supabase/service.ts`), which imports `server-only` so the build fails if it is ever pulled into browser code.
- **Payment provider behind a port:** `PaymentGateway` has `createCheckout` and `payOut`. Only a demo (mock) provider exists. A real one plugs into `infrastructure/providers`, and a real provider would confirm payments through a signed webhook instead of the demo checkout. Payouts use their own id as an idempotency key and are recorded as paid only once, so retries never pay twice.
- **Platform never holds funds in the real product:** this build only simulates escrow. Before real money moves, a licensed payment or escrow partner must hold the funds (see the legal notes in the README).
- **Proof of spending:** founders attach an invoice or quote to a milestone (stored privately like other documents). A trigger accepts proof only from the milestone's own business and only as an invoice, and founders cannot approve their own proof. Rejection needs a reason the founder can read.
- **Everything is audited:** contribution starts and confirmations, approvals, rejections, payouts and identity changes are written to `audit_log`.
- **Known gaps:** no refunds yet (a failed or expired checkout simply never counts), no real identity provider (a demo switch exists and is off by default), no payout destination (bank details) collected from founders yet, and no rate limiting beyond the database rules.

## Hardening

- **Administrator two-factor login, enforced twice.** The app sends administrators who have not passed the authenticator step to `/admin/mfa`. More importantly, `is_admin()` in the database now also requires the login token to be `aal2` (password plus authenticator code). Every administrator rule (access policies, triggers, review functions, file-storage rules) goes through it, so a stolen password alone gives no admin powers at all, even if a screen were bypassed.
- **No second authenticator for an existing one.** Setup is refused when a verified authenticator already exists, and the code is always checked against that existing one, so someone with only a stolen password cannot enroll their own.
- **Rate limits held in the database.** `rate_limit(action)` counts attempts per person per hour for contributions, uploads and milestone proofs. The limits live in the settings table the browser cannot read, only known action names are accepted, and if the check itself fails the answer is "no".
- **Unpaid checkouts are capped** at 5 open at a time per supporter, so nobody can tie up a goal's capacity; expired checkouts stop counting.
- **CI runs the database tests** against PostgreSQL with PostGIS on every pull request.
- **Known gaps:** uploads are not virus-scanned (needs an external scanner such as ClamAV); the content-security policy still allows inline scripts, which Next.js needs until nonces are added; password-guessing relies on Supabase's built-in sign-in limits (review them under Authentication, Rate Limits); and admin accounts cannot be recovered by another admin.

## Testing strategy

- **Unit tests (domain):** fast, no mocks needed. Target 90%+ coverage (enforced in `vitest.config.ts`).
- **Use-case tests (application):** in-memory fakes for the ports; assert that rejected requests never reach the store.
- **Database policy tests (built, run manually):** the SQL files in `supabase/tests/` run as a non-superuser against a throwaway Postgres, each in its own fresh database (`supabase/tests/run_tests.sh`). They cover signup rules, access control and the step-2 rules above, including attempts to cheat: no self-assigned admin, no self-changed role or KYC status, investors cannot read documents, clients cannot insert contributions, anonymous users see only verified businesses. Running them in CI is planned.
- **End-to-end (planned):** one happy path (register, verify, fund, release) with Playwright.

## Adding a feature

1. Write the rule in `domain` with a test.
2. Add a use case in `application`, depending on ports only, with a test using fakes.
3. Implement or extend an adapter in `infrastructure`.
4. Add a thin route or server action in `app`.
5. If a table changes, add a new migration with its RLS policies. Never edit an applied migration.
6. Record significant decisions as an ADR in `docs/adr/`.
