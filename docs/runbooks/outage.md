# When Supabase, Vercel or Cloudflare is down

Your uptime monitor (see [MONITORING.md](../hardening/MONITORING.md)) will tell you the site is down. First
find out whose fault it is.

1. **Check the status pages:** status.supabase.com, www.vercel-status.com, www.cloudflarestatus.com.
2. **Check the health endpoint:** `https://kasi-kapital.vercel.app/api/health`.
   - Page loads but health says 503: the database (Supabase) is the likely problem.
   - Nothing loads: Vercel, or a bad deployment.
3. **A bad deployment?** In Vercel, Deployments, find the last good one, **Promote to Production** (or
   Instant Rollback). Then fix the problem on a branch.

## What each outage breaks

| Down                 | What stops                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Supabase             | Everything that needs data: sign-in, search, contributions, admin pages. Pages may show errors.   |
| Vercel               | The whole site, and the daily retention job.                                                      |
| Cloudflare Turnstile | Sign-in and sign-up (the robot check cannot load). Do not switch the check off to "fix" it; wait. |
| Resend               | Alert emails only. Nothing else.                                                                  |

## While it lasts

- Do not approve milestones or record payouts if you cannot see the database properly.
- If it is long, put a short notice on your social channels and reply to anyone who writes in.

## After it is back

1. Check the health endpoint and sign in as a test supporter and as an administrator.
2. **Money:** look for contributions stuck as `pending` that were paid, and payouts left `pending`:

   ```sql
   select id, goal_id, amount_cents, created_at from public.contributions
    where status = 'pending' and created_at > now() - interval '1 day' order by created_at;
   select id, goal_id, amount_cents, created_at from public.payouts
    where status = 'pending' order by created_at;
   ```

3. **The daily job:** if the outage covered its time, call it by hand with the `curl` command in
   [RETENTION.md](../hardening/RETENTION.md). It is safe to run twice.
4. Write down what happened and how long it took.
