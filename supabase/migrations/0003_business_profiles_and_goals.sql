-- Step 2: business profiles and funding goals.
-- Closes two gaps in 0001: founders could edit their own `verification` / `trust_tier`, and could
-- approve their own milestones. Adds data rules and two functions that save a profile and create
-- a goal with its milestones in one transaction.

-- ---------- 1. Data rules ----------
alter table public.businesses
  add constraint businesses_category_check
    check (category in ('tuck_shop','bakery','chicken_farm','vegetable_farm','welding','hair_beauty','catering','other')),
  add constraint businesses_suburb_len check (suburb is null or char_length(suburb) between 2 and 80),
  add constraint businesses_description_len check (description is null or char_length(description) <= 600),
  add constraint businesses_youtube_check
    check (youtube_url is null or youtube_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be)(/|\?|$)'),
  add constraint businesses_facebook_check
    check (facebook_url is null or facebook_url ~* '^https://([a-z0-9-]+\.)*(facebook\.com|fb\.com)(/|\?|$)'),
  add constraint businesses_linkedin_check
    check (linkedin_url is null or linkedin_url ~* '^https://([a-z0-9-]+\.)*linkedin\.com(/|\?|$)');

-- Lets the app know whether a location is set without ever reading the point itself.
alter table public.businesses
  add column has_location boolean generated always as (location is not null) stored;

-- One business per account keeps the product simple; a second business needs a second account.
create unique index businesses_one_per_owner on public.businesses (owner_id);

alter table public.funding_goals
  add constraint goals_title_len check (char_length(title) between 3 and 100),
  add constraint goals_description_len check (description is null or char_length(description) <= 500),
  add constraint goals_target_range check (target_cents between 10000 and 100000000),
  -- Equity and revenue-share stay disabled until a licensed partner is in place.
  add constraint goals_kind_check check (kind in ('donation', 'presale'));

alter table public.milestones
  add column position smallint not null default 0,
  add constraint milestones_title_len check (char_length(title) between 2 and 100);

-- ---------- 2. Founders cannot verify themselves ----------
create or replace function public.protect_business_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server-side code and the SQL editor have no signed-in user; admins may change anything.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification := 'unverified';
    new.trust_tier := 0;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.verification is distinct from old.verification
     or new.trust_tier is distinct from old.trust_tier then
    raise exception 'Only an administrator can change ownership or verification'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_business_columns_trg
  before insert or update on public.businesses
  for each row execute function public.protect_business_columns();

-- ---------- 3. Funded goals are locked; founders cannot approve their own milestones ----------
create or replace function public.goal_is_funded(p_goal uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.contributions
    where goal_id = p_goal and status not in ('failed', 'refunded')
  );
$$;

create or replace function public.protect_funding_goals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if public.goal_is_funded(old.id) then
      raise exception 'A goal that has received contributions cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.business_id is distinct from old.business_id then
    raise exception 'A goal cannot be moved to another business' using errcode = '42501';
  end if;
  if public.goal_is_funded(old.id)
     and (new.target_cents is distinct from old.target_cents or new.kind is distinct from old.kind) then
    raise exception 'The target of a funded goal cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_funding_goals_trg
  before update or delete on public.funding_goals
  for each row execute function public.protect_funding_goals();

create or replace function public.protect_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if public.goal_is_funded(new.goal_id) then
      raise exception 'Milestones cannot be added to a funded goal' using errcode = '42501';
    end if;
    new.status := 'pending';
    new.proof_document_id := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.goal_is_funded(old.goal_id) or old.status <> 'pending' then
      raise exception 'This milestone can no longer be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.status = 'approved' then
    raise exception 'An approved milestone cannot be changed' using errcode = '42501';
  end if;
  if new.goal_id is distinct from old.goal_id then
    raise exception 'A milestone cannot be moved to another goal' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.status not in ('pending', 'proof_submitted') then
    raise exception 'Only an administrator can approve or reject a milestone' using errcode = '42501';
  end if;
  if new.amount_cents is distinct from old.amount_cents and public.goal_is_funded(old.goal_id) then
    raise exception 'Milestone amounts of a funded goal cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_milestones_trg
  before insert or update or delete on public.milestones
  for each row execute function public.protect_milestones();

-- ---------- 3b. Administrators review milestone proof ----------
-- 0001 let only the owner write milestones, so an administrator could never approve one.
create policy "milestones_admin_update" on public.milestones
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. Save a business profile ----------
-- Builds the stored point, rounded to roughly 1 km. SECURITY DEFINER so callers do not need
-- direct access to the PostGIS schema; returns null when no coordinates are given.
create or replace function public.coarse_point(p_lat double precision, p_lng double precision)
returns extensions.geography
language sql
security definer
set search_path = public
immutable
as $$
  select case
    when p_lat is null or p_lng is null then null
    else extensions.st_setsrid(
           extensions.st_makepoint(round(p_lng::numeric, 2)::float8, round(p_lat::numeric, 2)::float8), 4326
         )::extensions.geography
  end;
$$;

-- SECURITY INVOKER: runs as the signed-in user, so row level security still applies
-- (for example, only accounts with the business role can create one).
create or replace function public.save_my_business(
  p_name text,
  p_category text,
  p_description text,
  p_suburb text,
  p_lat double precision,
  p_lng double precision,
  p_youtube text,
  p_facebook text,
  p_linkedin text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Latitude and longitude must be given together';
  end if;
  if p_lat is not null then
    if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'Invalid coordinates';
    end if;
  end if;

  update public.businesses
     set name = p_name,
         category = p_category,
         description = p_description,
         suburb = p_suburb,
         -- Defence in depth: only an area of roughly 1 km is ever stored, never an exact spot.
         location = coalesce(public.coarse_point(p_lat, p_lng), location),
         youtube_url = p_youtube,
         facebook_url = p_facebook,
         linkedin_url = p_linkedin
   where owner_id = auth.uid()
   returning id into v_id;

  if v_id is null then
    insert into public.businesses (owner_id, name, category, description, suburb, location, youtube_url, facebook_url, linkedin_url)
    values (auth.uid(), p_name, p_category, p_description, p_suburb, public.coarse_point(p_lat, p_lng), p_youtube, p_facebook, p_linkedin)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---------- 5. Create a goal and its milestones atomically ----------
create or replace function public.create_funding_goal(
  p_business_id uuid,
  p_title text,
  p_description text,
  p_target_cents bigint,
  p_kind contribution_kind,
  p_milestones jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_goal uuid;
  v_count integer;
  v_sum bigint;
  rec record;
begin
  if p_kind not in ('donation', 'presale') then
    raise exception 'Only donation and presale goals are supported';
  end if;
  if p_milestones is null or jsonb_typeof(p_milestones) <> 'array' then
    raise exception 'Milestones must be a list';
  end if;

  v_count := jsonb_array_length(p_milestones);
  if v_count < 1 or v_count > 6 then
    raise exception 'A goal needs between 1 and 6 milestones';
  end if;

  select coalesce(sum((e ->> 'amount_cents')::bigint), 0) into v_sum
    from jsonb_array_elements(p_milestones) as e;
  if v_sum <> p_target_cents then
    raise exception 'Milestone amounts must add up to the goal target';
  end if;

  insert into public.funding_goals (business_id, title, description, target_cents, kind)
  values (p_business_id, p_title, p_description, p_target_cents, p_kind)
  returning id into v_goal;

  for rec in
    select e, ord from jsonb_array_elements(p_milestones) with ordinality as t(e, ord)
  loop
    insert into public.milestones (goal_id, title, amount_cents, position)
    values (v_goal, rec.e ->> 'title', (rec.e ->> 'amount_cents')::bigint, rec.ord::smallint);
  end loop;

  return v_goal;
end;
$$;

revoke all on function public.coarse_point(double precision, double precision) from public, anon;
grant execute on function public.coarse_point(double precision, double precision) to authenticated;

-- Only signed-in users may call these (row level security still decides what they can do).
revoke all on function public.save_my_business(text, text, text, text, double precision, double precision, text, text, text) from public, anon;
grant execute on function public.save_my_business(text, text, text, text, double precision, double precision, text, text, text) to authenticated;
revoke all on function public.create_funding_goal(uuid, text, text, bigint, contribution_kind, jsonb) from public, anon;
grant execute on function public.create_funding_goal(uuid, text, text, bigint, contribution_kind, jsonb) to authenticated;
