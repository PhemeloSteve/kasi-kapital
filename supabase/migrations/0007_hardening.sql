-- Step 7: hardening.
--  1. Administrators must have passed two-factor login (assurance level aal2) for admin powers to work.
--  2. Per-person rate limits for actions that are easy to spam, with the limits held in the database.
--  3. A cap on how many unpaid checkouts one supporter may have open at once.

-- ---------- 1. Administrator powers require two-factor login ----------
-- Supabase puts the login strength in the signed token: 'aal1' = password only, 'aal2' = password plus
-- authenticator code. Every admin check in the database (policies, triggers, review functions, storage rules)
-- goes through is_admin(), so changing it here protects all of them at once, even if a screen is bypassed.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- ---------- 2. Rate limits ----------
insert into public.platform_settings (key, int_value, note) values
  ('rate_contribute_per_hour', 20, 'Contributions one supporter may start per hour'),
  ('rate_upload_per_hour', 30, 'Document uploads one founder may make per hour'),
  ('rate_proof_per_hour', 20, 'Milestone proofs one founder may send per hour'),
  ('max_pending_contributions', 5, 'Unpaid checkouts one supporter may have open at once');

create table public.rate_limit_hits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, action, window_start)
);
alter table public.rate_limit_hits enable row level security;   -- no policies: only rate_limit() touches it

-- Counts one attempt by the signed-in person and says whether it is allowed. The limits come from the
-- settings table, never from the caller, and only known action names are accepted.
create or replace function public.rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit bigint;
  v_hits integer;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  v_limit := case p_action
    when 'contribute' then public.setting('rate_contribute_per_hour')
    when 'upload' then public.setting('rate_upload_per_hour')
    when 'proof' then public.setting('rate_proof_per_hour')
  end;
  if v_limit is null then
    raise exception 'Unknown action' using errcode = '22023';
  end if;

  insert into public.rate_limit_hits (user_id, action, window_start, hits)
  values (v_user, p_action, date_trunc('hour', now()), 1)
  on conflict (user_id, action, window_start) do update set hits = public.rate_limit_hits.hits + 1
  returning hits into v_hits;

  -- keep the table small: now and then, forget counters older than a day
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= v_limit;
end;
$$;
revoke all on function public.rate_limit(text) from public, anon;
grant execute on function public.rate_limit(text) to authenticated;

-- ---------- 3. Cap on unpaid checkouts ----------
-- Same function as 0006, plus the new cap (error code KK006). Checkouts older than the expiry no longer count.
create or replace function public.start_contribution(p_goal_id uuid, p_amount_cents bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role user_role;
  v_kyc verification_status;
  g record;
  v_taken bigint;
  v_mine bigint;
  v_limit bigint;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Lock the supporter first, so two quick requests cannot slip past their limits together.
  select role, kyc_status into v_role, v_kyc from public.profiles where id = v_user for update;
  if v_role is null or v_role not in ('investor', 'donor') then
    raise exception 'Only supporter accounts can contribute' using errcode = '42501';
  end if;
  if v_kyc in ('rejected', 'suspended') then
    raise exception 'This account cannot contribute' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < public.setting('min_contribution_cents')
     or p_amount_cents > public.setting('max_contribution_cents') then
    raise exception 'Amount out of range' using errcode = 'KK004';
  end if;

  if (select count(*) from public.contributions
       where contributor_id = v_user and status = 'pending'
         and created_at > now() - make_interval(mins => public.setting('checkout_minutes')::integer))
     >= public.setting('max_pending_contributions') then
    raise exception 'Too many unpaid checkouts' using errcode = 'KK006';
  end if;

  select fg.id, fg.target_cents, fg.kind, fg.is_open, b.verification as business_status
    into g
    from public.funding_goals fg
    join public.businesses b on b.id = fg.business_id
   where fg.id = p_goal_id
     for update of fg;
  if not found or g.business_status <> 'verified' then
    raise exception 'Goal not found' using errcode = 'P0002';
  end if;
  if not g.is_open then
    raise exception 'This goal is closed' using errcode = 'KK003';
  end if;

  update public.contributions set status = 'failed'
   where goal_id = p_goal_id and status = 'pending'
     and created_at < now() - make_interval(mins => public.setting('checkout_minutes')::integer);

  if v_kyc <> 'verified' then
    v_limit := public.setting('unverified_total_limit_cents');
    select coalesce(sum(amount_cents), 0) into v_mine
      from public.contributions where contributor_id = v_user and status in ('pending', 'held');
    if v_mine + p_amount_cents > v_limit then
      raise exception 'Identity not verified: contribution limit reached' using errcode = 'KK002', detail = greatest(v_limit - v_mine, 0)::text;
    end if;
  end if;

  select coalesce(sum(amount_cents), 0) into v_taken
    from public.contributions where goal_id = p_goal_id and status in ('pending', 'held');
  if v_taken + p_amount_cents > g.target_cents then
    raise exception 'This goal needs less than that' using errcode = 'KK001', detail = greatest(g.target_cents - v_taken, 0)::text;
  end if;

  insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status)
  values (p_goal_id, v_user, p_amount_cents, g.kind, 'pending')
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (v_user, 'contribution.started', 'contributions', v_id::text, jsonb_build_object('goal_id', p_goal_id, 'amount_cents', p_amount_cents));
  return v_id;
end;
$$;
