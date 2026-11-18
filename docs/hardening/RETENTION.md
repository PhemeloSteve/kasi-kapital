# How long documents are kept

Identity documents and bank statements are among the most sensitive things the platform holds, so they
are not kept longer than they are needed. POPIA asks for this directly: personal information must not be
kept longer than necessary for the purpose it was collected for.

## What is deleted automatically

| What                                  | When                                        | Setting                            |
| ------------------------------------- | ------------------------------------------- | ---------------------------------- |
| A rejected document or rejected proof | 30 days after the administrator rejected it | `retention_rejected_document_days` |

Once a day, a scheduled job (Vercel Cron, `vercel.json`) calls `/api/cron/retention`. For each expired
document it deletes the stored **file first**, then the **database record**, and writes one entry to the
audit log (`document.purged`, with the reason and the document type, and no file name or personal detail).

- If a file cannot be deleted, its record is kept and it is tried again the next day.
- If a milestone still pointed at a deleted rejected proof, the founder simply has to send new proof.
- The database re-checks every document itself, so an approved or recent document is never deleted, even if
  something passed its id in by mistake.

## When a business is closed

A super administrator can close a business for good (Admin, Businesses, **Close business**). It is hidden
from supporters, its goals stop taking money, and it cannot be reinstated from the app. Closing needs a
reason, which goes in the audit log.

- It is **refused while money is still held** for the business, while a payout is on its way, or while a
  checkout is open, because there is no refund process yet. Pay it out first.
- Documents that nobody approved (pending or rejected) are deleted **the next time the daily job runs**.
- **Approved documents** (identity, bank statement and so on) are deleted **12 months** after closing
  (`retention_closed_document_months`).
- Every deletion is logged with its reason (`closed_business_unreviewed`, `closed_business_retention` or
  `rejected_retention`) and never with a file name.

## What is kept

- **Approved documents** stay while the business is active, and for 12 months after it is closed.
- **Money records** (contributions, payments, payouts) and the **audit log** are never touched by this job.
  Financial records normally have to be kept for several years (FICA is commonly read as five years).
  Confirm the exact period with your Information Officer before launch.

## Not built yet (needs decisions)

- A "delete my data" request. This cannot be a plain wipe: money records may have to be kept, so it needs a
  design that removes what can go and anonymises what must stay. See the questions at the end of the step 3
  summary.

## Setting it up

1. In Vercel, Settings, Environment Variables, add `CRON_SECRET` with a long random value
   (`openssl rand -hex 32`), for **Production** only. Vercel sends it automatically with every cron call.
2. Redeploy. The job then appears under the project's **Cron Jobs** tab, and runs daily around 02:17 UTC.
   (On the Hobby plan, Vercel may run it at any time within that hour.)
3. Without `CRON_SECRET` the route refuses every request and nothing is deleted.

Run it by hand to test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/retention
```

The answer is a count only, for example `{"ok":true,"found":2,"filesRemoved":2,"recordsDeleted":2,"failed":0}`.

## Changing the period

```sql
update public.platform_settings
   set int_value = 60
 where key = 'retention_rejected_document_days';
```

## Money records

Contribution, payment and payout records are kept for at least **5 years** (`retention_financial_record_years`).
Nothing deletes them in this build: the setting records the policy, and a purge job for records older than
that is a later task. Confirm the period with your Information Officer before launch.

```sql
update public.platform_settings set int_value = 24 where key = 'retention_closed_document_months';
```
