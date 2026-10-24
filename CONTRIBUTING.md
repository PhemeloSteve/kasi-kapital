# Contributing

Even as a solo project, we work as if a team will review it.

## Workflow

1. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
2. Keep changes small and focused; one concern per pull request.
3. Use [Conventional Commits](https://www.conventionalcommits.org): `feat: add milestone approval`, `fix: reject negative amounts`.
4. Run `npm run check` before pushing. CI runs lint, types, formatting, tests with coverage, build, dependency audit, SBOM and secret scan.
5. Open a pull request using the template. Review your own diff first; AI-generated code gets extra scrutiny on security-critical paths (access rules, documents, money).
6. Squash-merge to keep history readable. `main` should always be deployable.

## Style

- Descriptive names; functions do one thing.
- Prettier formats, ESLint lints. Do not argue with the tools.
- DRY: reuse a rule rather than copying it. KISS: choose the simplest thing that works. YAGNI: do not add features or abstractions "just in case".
- No `console.log` in committed code; no secrets, tokens or personal data in the repo, tests or logs.

## Dependencies

- Add a dependency only when it clearly earns its place. Prefer well-maintained packages.
- Commit the lockfile. Review Dependabot PRs; do not ignore audit failures.
- Generate the SBOM with `npm run sbom` when preparing a release.

## Database changes

Add a new numbered file in `supabase/migrations/`. Every new table must enable RLS and include policies in the same migration.
