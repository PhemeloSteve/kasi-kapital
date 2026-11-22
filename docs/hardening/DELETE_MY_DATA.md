# Deleting an account ("delete my data")

A supporter or a founder can delete their own account from the account menu, **Delete my account**. They
type the word DELETE to confirm. It cannot be undone. Administrator accounts are never deleted this way.

## What happens

Straight away, in one database transaction (`erase_account`, which only the server can call):

- the name becomes "Deleted user" and the account is marked deleted;
- for a founder, the business is **closed** and its profile details are removed (name, description,
  suburb, location, registration number and links), so the closed-business rules in
  [RETENTION.md](RETENTION.md) take over: documents that were never approved are deleted at the next daily
  run, approved ones 12 months after closing;
- reports the person wrote are deleted;
- one audit-log entry (`account.deleted`) records that it happened, with no name or email.

Then the server clears the sign-in details: the email is replaced by `deleted-<id>@deleted.invalid`, the
account is banned, and every session is ended. From the moment the profile is marked deleted the app
treats the account as signed out, even if the clean-up after it were to fail.

## What is kept

Contribution, payment and payout records and the audit log stay, without the person's name, because they
must be kept for years (`retention_financial_record_years`, 5 by default). Nothing deletes them yet.

## When it is refused

While **money is still held** for the person (as a supporter) or for their business, a payout is on its
way, or a checkout is open. There is no refund process yet, so the money has to be paid out first. The
page says so before anyone types anything.

## Checking it after the first real deletion

In the Supabase dashboard, Authentication, Users, the account should show the `deleted-...@deleted.invalid`
email and a ban. If it still shows the real email, the clean-up step failed: look for
`[account] could not clear the sign-in details` in the Vercel logs. The person cannot sign in either way,
but you should fix the email by hand.

## Not covered here

Requests from people who have no account (for example a supporter's contact details held elsewhere), and
an export of someone's data. The Information Officer handles those until they are built.
