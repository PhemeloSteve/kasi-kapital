-- Step 9: admin improvements.
--  1. Two administrator levels: 'reviewer' (documents and proof) and 'super_admin' (everything).
--  2. Only super administrators may read the audit log.
--  3. Suspend / reinstate a business (super admin only, always audited).
--  4. Platform statistics for the admin home page.
--  5. A user directory (with email) for super administrators.
--
-- Order matters: the column must exist before the functions that read it are created.

-- ---------- 1. Administrator levels ----------
alter table public.profiles
  add column if not exists admin_level text
  check (admin_level in ('reviewer', 'super_admin'));

-- Only administrators have a level.
alter table public.profiles
  add constraint profiles_admin_level_only_admin
  check (admin_level is null or role = 'admin');

-- Everyone who is an administrator today keeps full powers. Administrators added later start with no
-- level, which the database and the app both treat as 'reviewer' (least privilege) until a super admin
-- (or the project owner, in the SQL editor) promotes them.
update public.profiles set admin_level = 'super_admin' where role = 'admin';

-- Nobody may change an administrator level from the app except a super admin. Without this, a reviewer
-- could simply promote themselves: the "update own row" policy lets them write their own profile.
-- Server-side code and the SQL editor have no signed-in user (auth.uid() is null) and may change it.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.kyc_status := old.kyc_status;
  end if;
  if auth.uid() is not null and not public.is_super_admin() then
    new.admin_level := old.admin_level;
  end if;
  return new;
end;
$$;

-- True only for a super administrator whose token also proves two-factor login (aal2).
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and admin_level = 'super_admin'
  ) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- ---------- 2. Audit log: super administrators only ----------
-- 0001 let every administrator read it. Policies are combined with OR, so the old one must go, or
-- reviewers would still be able to read the log directly.
drop policy if exists "audit_admin_read" on public.audit_log;
create policy "audit_log_super_admin_read" on public.audit_log
  for select using (public.is_super_admin());

-- ---------- 3. Suspend and reinstate a business ----------
-- Suspended businesses disappear from discovery and cannot take new contributions, because both only
-- ever look at 'verified' businesses.
create or replace function public.suspend_business(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'A reason of 1 to 300 characters is required' using errcode = '22023';
  end if;

  update public.businesses set verification = 'suspended' where id = p_id;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'business.suspended', 'businesses', p_id::text, jsonb_build_object('reason', v_reason));
end;
$$;

-- Reinstating sends the business back to 'pending', so an administrator has to look at it again.
-- Only a suspended business can be reinstated; this can never downgrade a verified one.
create or replace function public.unsuspend_business(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;

  update public.businesses set verification = 'pending'
   where id = p_id and verification = 'suspended';
  if not found then
    if exists (select 1 from public.businesses where id = p_id) then
      raise exception 'Business is not suspended' using errcode = '22023';
    end if;
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'business.unsuspended', 'businesses', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.suspend_business(uuid, text) from public, anon, authenticated;
grant execute on function public.suspend_business(uuid, text) to authenticated;
revoke all on function public.unsuspend_business(uuid) from public, anon, authenticated;
grant execute on function public.unsuspend_business(uuid) to authenticated;

-- ---------- 4. Platform statistics ----------
-- Money totals are private, so unlike the original brief this refuses anyone who is not an administrator.
create or replace function public.platform_stats()
returns table (
  total_businesses bigint,
  verified_businesses bigint,
  pending_businesses bigint,
  open_goals bigint,
  held_cents bigint,
  paid_out_cents bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  return query
  select
    count(*)::bigint,
    (count(*) filter (where b.verification = 'verified'))::bigint,
    (count(*) filter (where b.verification = 'pending'))::bigint,
    (select count(*) from public.funding_goals where is_open)::bigint,
    coalesce((select sum(amount_cents) from public.contributions where status = 'held'), 0)::bigint,
    coalesce((select sum(amount_cents) from public.payouts where status = 'paid'), 0)::bigint
  from public.businesses b;
end;
$$;
revoke all on function public.platform_stats() from public, anon;
grant execute on function public.platform_stats() to authenticated;

-- ---------- 5. User directory (super admin only) ----------
-- Email lives in auth.users, which the app cannot read, so this function is the only way to see it.
-- It is plpgsql so the auth.users reference is only resolved when it runs.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role user_role,
  kyc_status verification_status,
  contributed_cents bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    p.role,
    p.kyc_status,
    coalesce((select sum(c.amount_cents) from public.contributions c
               where c.contributor_id = p.id and c.status in ('held', 'released')), 0)::bigint
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc
  limit 500;
end;
$$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
