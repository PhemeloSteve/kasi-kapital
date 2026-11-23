# Suspected account takeover

Signs: a person says they did not do something; sign-in alerts from the person; actions at odd hours; an
administrator action nobody recognises (you get an email for suspensions and payouts once alerts are set up).

## A supporter or a founder

1. **Lock the account.** Supabase, Authentication, Users, find the person, **Ban user** (or remove them from
   the dashboard if you are sure). Banned people cannot sign in; sessions stop working when they expire.
2. **If their business may be involved,** suspend it (Admin, Businesses, Suspend) so nothing new reaches it.
3. **Check what the account did** (replace the id):

   ```sql
   select created_at, action, entity, entity_id from public.audit_log
    where actor_id = '<user id>' order by created_at desc limit 100;
   ```

4. **Look at money.** Contributions, goals and payouts tied to the account:

   ```sql
   select id, goal_id, amount_cents, status, created_at from public.contributions
    where contributor_id = '<user id>' order by created_at desc;
   ```

5. **Contact the real owner by another route,** confirm who they are, then reset their password and lift the
   ban.

## An administrator account (more serious)

1. **Take their powers away at once.** In the Supabase SQL Editor:

   ```sql
   update public.profiles set role = 'investor', admin_level = null where id = '<admin user id>';
   ```

   (Both columns in one statement: an administrator level only makes sense for an administrator.)

2. **Ban the user** as above and remove their authenticator: Authentication, Users, the user, remove the
   multi-factor entries.
3. **Review everything they did,** especially document views and payouts:

   ```sql
   select created_at, action, entity, entity_id, details from public.audit_log
    where actor_id = '<admin user id>' order by created_at desc limit 300;
   ```

4. **Treat it as an incident:** open [incident-response.md](incident-response.md). Identity documents may have
   been viewed, which brings in the data breach steps.
5. If the project owner's own Supabase or Vercel account is the one at risk, change that password and enable
   two-factor on it first, then rotate keys ([secret-rotation.md](secret-rotation.md)).

## Afterwards

Ask the person what they think happened (reused password, phishing, a shared device). Every administrator
must use an authenticator app; check nobody is left without one.
