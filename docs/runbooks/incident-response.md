# Incident response

For anything that looks like a break-in, a leak, money going where it should not, or the site being used
against people. Stay calm; write things down as you go.

## 1. First 30 minutes

1. **Write the time and what you saw.** Keep a plain text file for the whole incident: time, what you did, why.
2. **Save the evidence before it expires.** Vercel runtime logs are kept only briefly on the Hobby plan.
   Copy the relevant lines now. Do not delete anything.
3. **Stop it getting worse**, with the smallest step that works:
   - one business looks fraudulent: suspend it (Admin, Businesses, Suspend);
   - one account is compromised: [account-takeover.md](account-takeover.md);
   - a key may have leaked: [secret-rotation.md](secret-rotation.md);
   - money is moving wrongly: stop approving milestones (Admin, Review queue) until you understand why. If
     needed, remove `PAYMENT_PROVIDER` or `ALLOW_MOCK_PAYMENTS` in Vercel and redeploy so new contributions
     stop.
   - the site itself must be offline: in Vercel, pause the project's production deployment.
4. **Find out how far it went.** Use the audit log (Admin, Audit log) and the queries below.

## 2. Questions to answer

- What happened, and since when?
- Whose personal information could have been seen or changed (supporters, founders, identity documents)?
- Was money affected? Which contributions, goals and payouts?
- Is it still happening?

Useful queries (Supabase, SQL Editor; read-only):

```sql
-- What did one account do recently?
select created_at, action, entity, entity_id from public.audit_log
 where actor_id = '<user id>' order by created_at desc limit 100;

-- Every sensitive action in the last day
select created_at, actor_id, action, entity, entity_id from public.audit_log
 where created_at > now() - interval '1 day'
   and action in ('business.suspended','business.unsuspended','business.closed',
                  'payout.created','payout.paid','kyc.status_set','document.viewed')
 order by created_at desc;

-- Who opened identity or bank documents recently?
select created_at, actor_id, entity_id from public.audit_log
 where action = 'document.viewed' and created_at > now() - interval '7 days'
 order by created_at desc;
```

## 3. If personal information may have been exposed

South Africa's POPIA (section 22) requires the responsible party to tell the **Information Regulator** and the
**people affected** as soon as reasonably possible after discovering that personal information may have been
accessed or acquired by an unauthorised person. Do not wait to be certain.

1. Contact the Information Officer (and a lawyer) the same day.
2. Note what was exposed, how many people, and what you have done to stop it.
3. The Regulator accepts breach notifications through its published channels; use the current form from its
   website.
4. Tell affected people in plain language: what happened, what information, what they should do (for example
   change their password), and who to contact.

## 4. After it is over

- Rotate anything that may have been seen ([secret-rotation.md](secret-rotation.md)).
- Write down what happened, what worked, what did not, and what will change. Add a test or an alert if one
  would have caught it earlier.
- Update these runbooks.
