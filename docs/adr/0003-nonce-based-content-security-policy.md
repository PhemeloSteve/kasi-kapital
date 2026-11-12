# 3. Nonce-based Content Security Policy

## Status

Accepted

## Context

The first policy allowed `'unsafe-inline'` scripts because Next.js adds small inline scripts to every
page. That removes most of the protection a CSP gives: a script injected into a page would be allowed
to run, and could act as the signed-in person.

## Decision

- `src/middleware.ts` creates a fresh random nonce for every request and sends the policy
  (`src/config/csp.ts`) both to the browser and to Next.js, which puts the nonce on its own scripts.
- Scripts run only with the nonce, or when loaded by a script that has it (`'strict-dynamic'`).
  There is no `'unsafe-inline'` or `'unsafe-eval'` for scripts on a live site.
- A script that already has the nonce may load further scripts ('strict-dynamic'), and those are trusted
  too. So the policy stops hostile script from getting in; it cannot stop code that is already running.
- Styles still allow inline rules. React sets some styles directly and the map library does too; the
  risk is far smaller than for scripts.
- The root layout is `force-dynamic`, because a page built ahead of time cannot carry a per-request nonce.
- The Playwright suite loads the main pages as each role and fails on any policy violation, and checks
  that an inline script put into the page by the server (as a real XSS flaw would) and an injected inline
  event handler are both refused.

## Consequences

- Every page is rendered per request. That costs some speed and removes static caching of public pages.
- A new third-party script must be loaded from code that already has the nonce (or through `next/script`).
- Vercel's preview toolbar may be blocked on preview deployments. That does not affect the live site.
- Violation reporting is added with monitoring (step 5).
