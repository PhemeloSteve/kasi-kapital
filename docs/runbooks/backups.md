# Backups and getting data back

## Where things stand

On the free Supabase plan **there are no automatic backups and no point-in-time recovery.** If the database
is damaged or deleted by a mistake, an attacker, or a bad migration, the data is gone. The Supabase dashboard
shows "No backups".

Decide before real money or real identity documents are held. The straightforward answer is to move the
project to a paid Supabase plan, which includes daily backups (check the current terms, and whether you want
point-in-time recovery on top). Until then, take your own copies.

## What there is to lose

| What                                 | Where                    | Included in a database dump? |
| ------------------------------------ | ------------------------ | ---------------------------- |
| Accounts, businesses, goals, money   | Database                 | Yes                          |
| Uploaded documents (ID, bank, proof) | Supabase Storage buckets | **No**, files are separate   |
| The code                             | GitHub                   | n/a (this is the copy)       |

## A manual database backup

Needs Docker running and the project linked (`npx supabase link`). From the repository:

```bash
mkdir -p ~/kasi-backups
npx supabase db dump --linked -f ~/kasi-backups/schema-$(date +%F).sql
npx supabase db dump --linked --data-only -f ~/kasi-backups/data-$(date +%F).sql
```

The data file contains **personal information**. Treat it that way:

```bash
gpg --symmetric --cipher-algo AES256 ~/kasi-backups/data-$(date +%F).sql
shred -u ~/kasi-backups/data-$(date +%F).sql          # remove the unencrypted copy
```

- Keep the passphrase in your password manager, not next to the file.
- Keep at least one copy off your laptop (an encrypted drive, or an encrypted cloud folder you control).
- Do it weekly, and before every migration that changes data.
- Old copies of someone's data must not outlive your retention rules: delete backups older than you can
  justify (a few weeks), and remember that a restored backup can bring back people who asked for deletion.
  After any restore, run `erase_account` again for accounts that were deleted since the backup (find them in
  the audit log by `account.deleted`).

## Documents (files)

Storage files are not in the database dump. Until you are on a plan with its own storage backups, copy the
two buckets (`identity-documents`, `business-documents`) with the Supabase CLI (see
`npx supabase storage --help` for the current commands) into an encrypted location. If copying identity
documents out of Supabase is itself a risk you do not want, record that decision and accept that documents
cannot be restored (founders would be asked to upload them again).

## Getting data back

1. Create a **new** Supabase project; do not restore over the live one.
2. Apply the schema, then the data (`psql` against the new project's connection string, or the SQL Editor
   for small files).
3. Point a **preview** deployment at it and check the site works.
4. Only then decide whether to switch production over (new keys in Vercel, redeploy, update the webhooks and
   the Turnstile and Supabase redirect URLs).

**Practise this once, with a throwaway project, before you need it.** A backup you have never restored is a
hope, not a backup.
