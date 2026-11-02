-- Step 8: discovery cards show each business's current goal and how far along it is.
-- The result of both discovery functions gains four columns (goal_id, goal_title, goal_target_cents,
-- goal_raised_cents), so the functions are dropped and created again. Same rules as 0005: public fields only,
-- verified businesses only, and only money that is actually held counts as raised.

drop function public.discover_businesses(text, text, double precision, double precision, integer, integer, integer);
drop function public.get_public_business(uuid);

create or replace function public.discover_businesses(
  p_query text default null,
  p_category text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default 50,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  category text,
  description text,
  suburb text,
  trust_tier smallint,
  lat double precision,
  lng double precision,
  youtube_url text,
  facebook_url text,
  linkedin_url text,
  open_goal_count bigint,
  open_goal_target_cents bigint,
  distance_km double precision,
  goal_id uuid,
  goal_title text,
  goal_target_cents bigint,
  goal_raised_cents bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_origin extensions.geography;
  v_pattern text;
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_radius integer := least(greatest(coalesce(p_radius_km, 50), 1), 500);
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Latitude and longitude must be given together' using errcode = '22023';
  end if;
  if p_lat is not null then
    if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'Invalid coordinates' using errcode = '22023';
    end if;
    v_origin := public.coarse_point(p_lat, p_lng);
  end if;

  -- Treat what the person typed as plain text: % and _ and \ must not act as wildcards.
  if v_query is not null then
    v_pattern := '%' || replace(replace(replace(left(v_query, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select b.id, b.name, b.category, b.description, b.suburb, b.trust_tier,
         case when b.location is null then null else extensions.st_y(b.location::extensions.geometry) end,
         case when b.location is null then null else extensions.st_x(b.location::extensions.geometry) end,
         b.youtube_url, b.facebook_url, b.linkedin_url,
         coalesce(g.goal_count, 0), coalesce(g.goal_total, 0),
         case when v_origin is null or b.location is null then null
              else extensions.st_distance(b.location, v_origin) / 1000.0 end,
         f.id, f.title, f.target_cents, f.raised
    from public.businesses b
    left join lateral (
      select count(*) as goal_count, sum(fg.target_cents)::bigint as goal_total
        from public.funding_goals fg
       where fg.business_id = b.id and fg.is_open
    ) g on true
    left join lateral (
      select fg.id, fg.title, fg.target_cents,
             coalesce((select sum(c.amount_cents) from public.contributions c where c.goal_id = fg.id and c.status = 'held'), 0)::bigint as raised
        from public.funding_goals fg
       where fg.business_id = b.id and fg.is_open
       order by fg.created_at desc, fg.id
       limit 1
    ) f on true
   where b.verification = 'verified'
     and (p_category is null or b.category = p_category)
     and (v_pattern is null
          or b.name ilike v_pattern escape '\'
          or b.suburb ilike v_pattern escape '\'
          or b.description ilike v_pattern escape '\')
     and (v_origin is null
          or (b.location is not null and extensions.st_dwithin(b.location, v_origin, v_radius * 1000.0)))
   order by case when v_origin is null then null else extensions.st_distance(b.location, v_origin) end asc nulls last,
            b.trust_tier desc, b.created_at desc, b.id
   limit v_limit + 1   -- one extra row tells the app whether there is another page
  offset v_offset;
end;
$$;

create or replace function public.get_public_business(p_id uuid)
returns table (
  id uuid,
  name text,
  category text,
  description text,
  suburb text,
  trust_tier smallint,
  lat double precision,
  lng double precision,
  youtube_url text,
  facebook_url text,
  linkedin_url text,
  open_goal_count bigint,
  open_goal_target_cents bigint,
  distance_km double precision,
  goal_id uuid,
  goal_title text,
  goal_target_cents bigint,
  goal_raised_cents bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  return query
  select b.id, b.name, b.category, b.description, b.suburb, b.trust_tier,
         case when b.location is null then null else extensions.st_y(b.location::extensions.geometry) end,
         case when b.location is null then null else extensions.st_x(b.location::extensions.geometry) end,
         b.youtube_url, b.facebook_url, b.linkedin_url,
         coalesce(g.goal_count, 0), coalesce(g.goal_total, 0),
         null::double precision,
         f.id, f.title, f.target_cents, f.raised
    from public.businesses b
    left join lateral (
      select count(*) as goal_count, sum(fg.target_cents)::bigint as goal_total
        from public.funding_goals fg
       where fg.business_id = b.id and fg.is_open
    ) g on true
    left join lateral (
      select fg.id, fg.title, fg.target_cents,
             coalesce((select sum(c.amount_cents) from public.contributions c where c.goal_id = fg.id and c.status = 'held'), 0)::bigint as raised
        from public.funding_goals fg
       where fg.business_id = b.id and fg.is_open
       order by fg.created_at desc, fg.id
       limit 1
    ) f on true
   where b.id = p_id and b.verification = 'verified';
end;
$$;

revoke all on function public.discover_businesses(text, text, double precision, double precision, integer, integer, integer) from public, anon;
grant execute on function public.discover_businesses(text, text, double precision, double precision, integer, integer, integer) to authenticated;
revoke all on function public.get_public_business(uuid) from public, anon;
grant execute on function public.get_public_business(uuid) to authenticated;
