# Admin improvements: what was built, and where it differs from the brief

Everything in `ADMIN_IMPROVEMENTS.md` is implemented. A few places were changed on purpose, because the
brief's version would have been insecure or would not have run against this codebase.

## Differences from the brief

| Brief                                                    | What was done                                                                                                                                            | Why                                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Add policy `audit_log_admin_only`                        | Dropped the existing `audit_admin_read` policy and added `audit_log_super_admin_read`                                                                    | `0001` already lets every admin read the log. Policies combine with OR, so adding a second would leave reviewers able to read it. |
| `is_super_admin()` created before the column             | Column is added first                                                                                                                                    | A SQL-language function fails to create if its column does not exist yet.                                                         |
| Nothing stops a reviewer editing their own `admin_level` | `protect_profile_columns` now locks `admin_level` (only a super admin, the SQL editor or server code can change it); a check ties it to `role = 'admin'` | The "update own profile" policy would otherwise let a reviewer promote themselves.                                                |
| `platform_stats()` open to every signed-in user          | Raises 42501 unless `is_admin()`                                                                                                                         | It returns escrow and payout totals.                                                                                              |
| `unsuspend_business` sets `pending` unconditionally      | Only works on a suspended business (else 22023)                                                                                                          | Otherwise it could downgrade a verified business.                                                                                 |
| Users page "query profiles"                              | New `admin_list_users()` function (super admin only)                                                                                                     | Email lives in `auth.users`, which the app cannot read.                                                                           |
| Businesses page: any admin                               | Super admin only                                                                                                                                         | Matches the nav and the database functions.                                                                                       |
| Reviewers hide the payout button                         | Also enforced in `processPayoutsAction`, and a reviewer's proof approval no longer auto-pays                                                             | Payouts use the service role, so the database cannot stop a reviewer; only the app can.                                           |
| Webhook: "verify secret in production"                   | Always verified, fails closed when `WEBHOOK_SECRET` is unset                                                                                             | An open endpoint that sends email is an abuse risk.                                                                               |
| Webhook conditions in the Supabase dashboard             | Filtering is done in code (`describeAdminNotification`)                                                                                                  | The dashboard's webhook screen has no row condition field, and `UPDATE` fires on every edit.                                      |
| `generateMetadata` queries separately                    | Page and title share one cached query per request                                                                                                        | Avoids running each queue twice.                                                                                                  |

An administrator with no `admin_level` recorded is treated as a reviewer, in both the database and the app.
Existing admins were set to `super_admin` by the migration; admins you add later start as reviewers.

## Things to know

- Suspending also fires the existing `audit_business_changes` trigger, so each suspend or reinstate
  produces two audit rows: `business.verification_changed` and `business.suspended` (with the reason).
- Suspending a business does not close its open goals or refund held money. It stops the business being
  seen and stops new contributions. Decide separately what should happen to money already held.
- To promote an admin, run in the SQL editor:
  `update public.profiles set admin_level = 'super_admin' where id = '<user id>';`
- `src/components/ui/StatCard.tsx` already existed and was reused.

## Webhook setup

1. Add to Vercel: `WEBHOOK_SECRET` (random, 16+ characters), `RESEND_API_KEY`, `ADMIN_NOTIFY_EMAIL`.
2. Supabase, Database, Webhooks: create two webhooks, both `POST` to
   `https://<your-app>/api/webhooks/admin-notify` with header `Authorization: Bearer <WEBHOOK_SECRET>`:
   table `businesses` (event `UPDATE`) and table `milestones` (event `UPDATE`).
3. The route ignores everything except a business becoming `pending` and a milestone becoming `proof_submitted`.

## Not verified in the build environment

The build environment had no network access (no `npm install`) and no PostgreSQL. So `npm run check`
and `supabase/tests/run_tests.sh` were **not run**. Run both before merging.
