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

## Testing strategy

- **Unit tests (domain):** fast, no mocks needed. Target 90%+ coverage (enforced in `vitest.config.ts`).
- **Use-case tests (application):** in-memory fakes for the ports; assert that rejected requests never reach the store.
- **Database policy tests (built, run manually):** `supabase/tests/rls_smoke_test.sql` has assertions run as a non-superuser against a throwaway Postgres: no self-assigned admin, no self-changed role or KYC status, investors cannot read documents, clients cannot insert contributions, anonymous users see only verified businesses. Running them in CI is planned.
- **End-to-end (planned):** one happy path (register, verify, fund, release) with Playwright.

## Adding a feature

1. Write the rule in `domain` with a test.
2. Add a use case in `application`, depending on ports only, with a test using fakes.
3. Implement or extend an adapter in `infrastructure`.
4. Add a thin route or server action in `app`.
5. If a table changes, add a new migration with its RLS policies. Never edit an applied migration.
6. Record significant decisions as an ADR in `docs/adr/`.
