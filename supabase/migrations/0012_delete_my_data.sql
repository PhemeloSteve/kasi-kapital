-- Step 11b: "delete my data". A supporter or founder can delete their own account.
--
-- What happens (all in one transaction, by erase_account, which only the server can call):
--   * the person's name becomes "Deleted user" and the account is marked deleted;
--   * a founder's business is closed and its profile details are removed (name, description, suburb,
--     location, registration number, links), so the retention rules for a closed business take over:
--     unreviewed documents go at the next daily run, approved ones after 12 months;
--   * reports the person wrote are deleted;
--   * money records stay (contributions, payments, payouts, the audit log), with the name gone, because
--     they must be kept for years. The 5-year period is a policy setting from step 11a.
-- The server then clears the sign-in details (email) and signs the person out everywhere.
--
-- It is refused while money is still held for the person (as a supporter) or for their business, because
-- there is no refund process yet. Administrators are never deleted here.

-- ---------- 1. Marking an account as deleted ----------
alter table public.profiles add column deleted_at timestamptz;

-- ---------- 2. "Is money still in play?" ----------
-- For a business: money still held, a payout on its way, or a checkout that is still open.
create or replace function public.business_money_in_play(p_business uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.funding_goals g
                  where g.business_id = p_business and public.goal_escrow_balance(g.id) > 0)
      or exists (select 1 from public.payouts p join public.funding_goals g on g.id = p.goal_id
                  where g.business_id = p_business and p.status = 'pending')
      or exists (select 1 from public.contributions c join public.funding_goals g on g.id = c.goal_id
                  where g.business_id = p_business and c.status = 'pending'
                    and c.created_at > now() - make_interval(mins => public.setting('checkout_minutes')::integer));
$$;
revoke all on function public.business_money_in_play(uuid) from public, anon, authenticated;

-- For a person: their own checkouts and held money, and (for a founder) the business above.
create or replace function public.person_money_in_play(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.contributions c
                  where c.contributor_id = p_user
                    and ((c.status = 'pending'
                          and c.created_at > now() - make_interval(mins => public.setting('checkout_minutes')::integer))
                         or (c.status = 'held' and public.goal_escrow_balance(c.goal_id) > 0)))
      or exists (select 1 from public.businesses b
                  where b.owner_id = p_user and public.business_money_in_play(b.id));
$$;
revoke all on function public.person_money_in_play(uuid) from public, anon, authenticated;

-- What the "delete my account" page asks, so it can explain a refusal before anyone types anything.
create or replace function public.my_money_in_play()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.person_money_in_play(auth.uid());
$$;
revoke all on function public.my_money_in_play() from public, anon, authenticated;
grant execute on function public.my_money_in_play() to authenticated;

-- ---------- 3. Closing a business uses the same rule ----------
-- Same function as 0011; the money check now lives in business_money_in_play so both paths share it.
create or replace function public.close_business(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  b public.businesses;
  v_goals integer;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'A reason of 1 to 300 characters is required' using errcode = '22023';
  end if;

  select * into b from public.businesses where id = p_id for update;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  if b.closed_at is not null then
    raise exception 'Business is already closed' using errcode = '55000';
  end if;

  if public.business_money_in_play(p_id) then
    raise exception 'Money is still held for this business' using errcode = '55006';
  end if;

  update public.funding_goals set is_open = false where business_id = p_id and is_open;
  get diagnostics v_goals = row_count;

  update public.businesses set closed_at = now(), verification = 'suspended' where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'business.closed', 'businesses', p_id::text,
          jsonb_build_object('reason', v_reason, 'goals_closed', v_goals));
end;
$$;

revoke all on function public.close_business(uuid, text) from public, anon, authenticated;
grant execute on function public.close_business(uuid, text) to authenticated;

-- ---------- 4. Erase an account (the server calls this for the person who is signed in) ----------
-- Error codes the app relies on:  42501 an administrator  P0002 no such account  55006 money still held.
-- Running it again for an account that is already erased does nothing.
create or replace function public.erase_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  v_business uuid;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if p.role = 'admin' then
    raise exception 'Administrator accounts are not deleted here' using errcode = '42501';
  end if;
  if p.deleted_at is not null then
    return;
  end if;
  if public.person_money_in_play(p_user) then
    raise exception 'Money is still held' using errcode = '55006';
  end if;

  select id into v_business from public.businesses where owner_id = p_user;
  if v_business is not null then
    update public.funding_goals set is_open = false where business_id = v_business and is_open;
    -- Closes the business if it is not closed yet, and removes what identifies the person either way.
    update public.businesses
       set closed_at = coalesce(closed_at, now()),
           verification = case when closed_at is null then 'suspended' else verification end,
           name = 'Deleted business',
           description = null,
           suburb = null,
           location = null,
           cipc_number = null,
           youtube_url = null,
           facebook_url = null,
           linkedin_url = null
     where id = v_business;
  end if;

  delete from public.reports where reporter_id = p_user;

  update public.profiles set full_name = 'Deleted user', deleted_at = now() where id = p_user;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (null, 'account.deleted', 'profiles', p_user::text,
          jsonb_build_object('had_business', v_business is not null));
end;
$$;

revoke all on function public.erase_account(uuid) from public, anon, authenticated;
grant execute on function public.erase_account(uuid) to service_role;
