-- Step 4 tests: what supporters can find, and what they can never see.
\set ON_ERROR_STOP on

grant usage on schema public, auth to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function auth.uid() to anon, authenticated;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin execute stmt; return null;
exception when others then return sqlstate || ': ' || sqlerrm;
end $$;

-- Seven founders, one business each (as the project owner)
insert into auth.users (id, raw_user_meta_data)
select ('33333333-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       jsonb_build_object('role', 'business', 'full_name', 'Founder ' || n, 'popia_consent', true)
  from generate_series(1, 7) n;
insert into auth.users (id, raw_user_meta_data) values
 ('33333333-0000-4000-8000-0000000000c1', '{"role":"investor","full_name":"Investor","popia_consent":true}');

insert into public.businesses (id, owner_id, name, category, description, suburb, location, verification, trust_tier) values
 ('44444444-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', 'Soweto Bakery', 'bakery', 'Fresh bread every morning', 'Soweto', public.coarse_point(-26.2678, 27.8584), 'verified', 2),
 ('44444444-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000002', 'Mamelodi Chicken Farm', 'chicken_farm', 'Free-range chickens', 'Mamelodi', public.coarse_point(-25.7000, 28.3900), 'verified', 3),
 ('44444444-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000003', 'Cape Town Welders', 'welding', 'Gates and burglar bars', 'Khayelitsha', public.coarse_point(-33.9200, 18.4200), 'verified', 2),
 ('44444444-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000004', 'Pending Tuck Shop', 'tuck_shop', 'Waiting for review', 'Alexandra', public.coarse_point(-26.1000, 28.1000), 'pending', 1),
 ('44444444-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000005', 'Rejected Salon', 'hair_beauty', 'Documents were rejected', 'Soweto', public.coarse_point(-26.2600, 27.8500), 'rejected', 1),
 ('44444444-0000-4000-8000-000000000006', '33333333-0000-4000-8000-000000000006', 'Suspended Catering', 'catering', 'Suspended for a fraud report', 'Soweto', public.coarse_point(-26.2700, 27.8700), 'suspended', 2),
 ('44444444-0000-4000-8000-000000000007', '33333333-0000-4000-8000-000000000007', 'No Location Veggies', 'vegetable_farm', '100% organic_fresh produce', 'Tembisa', null, 'verified', 2);

insert into public.funding_goals (business_id, title, target_cents, kind, is_open) values
 ('44444444-0000-4000-8000-000000000001', 'Bigger oven', 500000, 'donation', true),
 ('44444444-0000-4000-8000-000000000001', 'Old goal already closed', 100000, 'donation', false),
 ('44444444-0000-4000-8000-000000000002', 'Buy 50 chicks', 200000, 'presale', true);

-- ===== Investor searches =====
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-0000-4000-8000-0000000000c1', false) \gset

do $$ declare n int; names text; begin
  select count(*), string_agg(name, ', ' order by name) into n, names from public.discover_businesses(p_limit => 50);
  assert n = 4, format('FAIL Q1: expected the 4 verified businesses, got %s (%s)', n, names);
  assert names = 'Cape Town Welders, Mamelodi Chicken Farm, No Location Veggies, Soweto Bakery', format('FAIL Q1b: %s', names);
  raise notice 'PASS Q1: supporters see exactly the verified businesses, never pending, rejected or suspended ones';

  assert (select count(*) from public.discover_businesses(p_category => 'bakery')) = 1, 'FAIL Q2: category filter';
  assert (select count(*) from public.discover_businesses(p_category => 'tuck_shop')) = 0, 'FAIL Q2b: unverified tuck shop leaked via its category';
  raise notice 'PASS Q2: filtering by category works and cannot reveal unverified businesses';

  assert (select name from public.discover_businesses(p_query => 'chicken')) = 'Mamelodi Chicken Farm', 'FAIL Q3a: name search';
  assert (select name from public.discover_businesses(p_query => 'BREAD')) = 'Soweto Bakery', 'FAIL Q3b: description search is case-insensitive';
  assert (select name from public.discover_businesses(p_query => 'Khayelitsha')) = 'Cape Town Welders', 'FAIL Q3c: suburb search';
  assert (select count(*) from public.discover_businesses(p_query => 'Soweto')) = 1, 'FAIL Q3d: unverified Soweto businesses leaked into search';
  raise notice 'PASS Q3: text search covers name, description and suburb, case-insensitively';

  -- % and _ are literal characters, not wildcards
  -- only one description contains a literal %; if % were a wildcard all four businesses would match
  assert (select name from public.discover_businesses(p_query => '%')) = 'No Location Veggies', 'FAIL Q4a: % acted as a wildcard';
  assert (select name from public.discover_businesses(p_query => '_')) = 'No Location Veggies', 'FAIL Q4b: _ acted as a wildcard';
  assert (select name from public.discover_businesses(p_query => '100%')) = 'No Location Veggies', 'FAIL Q4c: a literal % was not matched';
  assert (select count(*) from public.discover_businesses(p_query => '\')) = 0, 'FAIL Q4d: backslash misbehaved';
  raise notice 'PASS Q4: wildcard characters in a search are treated as plain text';
end $$;

do $$ declare r record; prev double precision := -1; n int := 0; begin
  -- near Johannesburg: Soweto is close, Mamelodi further, Cape Town far, the one with no location never matches
  assert (select count(*) from public.discover_businesses(p_lat => -26.20, p_lng => 28.04, p_radius_km => 50)) = 1, 'FAIL Q5a: radius 50';
  for r in select * from public.discover_businesses(p_lat => -26.20, p_lng => 28.04, p_radius_km => 100) loop
    n := n + 1;
    assert r.distance_km >= prev, 'FAIL Q5b: not ordered nearest first';
    prev := r.distance_km;
  end loop;
  assert n = 2, format('FAIL Q5c: expected 2 within 100 km, got %s', n);
  assert (select name from public.discover_businesses(p_lat => -26.20, p_lng => 28.04, p_radius_km => 100) limit 1) = 'Soweto Bakery', 'FAIL Q5d: nearest first';
  assert (select count(*) from public.discover_businesses(p_lat => -26.20, p_lng => 28.04, p_radius_km => 500)) = 2, 'FAIL Q5e: Cape Town is over 1,200 km away';
  assert (select distance_km from public.discover_businesses(p_query => 'chicken')) is null, 'FAIL Q5f: distance given without an origin';
  raise notice 'PASS Q5: "near me" filters by radius, orders nearest first, and skips businesses with no location';

  assert (select count(*) from public.discover_businesses(p_limit => 2)) = 3, 'FAIL Q6a: should return limit + 1 rows to signal another page';
  assert (select count(*) from public.discover_businesses(p_limit => 2, p_offset => 2)) = 2, 'FAIL Q6b: second page';
  assert (select count(*) from public.discover_businesses(p_limit => 999)) = 4, 'FAIL Q6c: limit is capped, not unlimited';
  raise notice 'PASS Q6: pagination works and the page size is capped';

  select * into r from public.discover_businesses(p_query => 'Soweto Bakery');
  assert r.open_goal_count = 1 and r.open_goal_target_cents = 500000, format('FAIL Q7: open goals %s / %s (the closed goal must not count)', r.open_goal_count, r.open_goal_target_cents);
  assert r.lat = -26.27 and r.lng = 27.86, format('FAIL Q7b: location %s, %s', r.lat, r.lng);
  raise notice 'PASS Q7: open goals are counted (closed ones are not) and the location is the approximate one';
end $$;

-- ===== The featured goal on each card =====
reset role;
insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status)
select g.id, '33333333-0000-4000-8000-0000000000c1', v.amount, 'donation', v.status::contribution_status
  from public.funding_goals g,
       (values (100000, 'held'), (50000, 'pending'), (20000, 'failed')) as v(amount, status)
 where g.title = 'Bigger oven';
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-0000-4000-8000-0000000000c1', false) \gset
do $$ declare r record; begin
  select * into r from public.discover_businesses(p_query => 'Soweto Bakery');
  assert r.goal_title = 'Bigger oven' and r.goal_target_cents = 500000, format('FAIL F1: featured goal %s / %s (the closed goal must not be chosen)', r.goal_title, r.goal_target_cents);
  assert r.goal_raised_cents = 100000, format('FAIL F2: raised %s (only held money counts, not pending or failed)', r.goal_raised_cents);
  select * into r from public.discover_businesses(p_query => 'No Location Veggies');
  assert r.goal_id is null and r.goal_title is null and r.goal_raised_cents is null, 'FAIL F3: a business with no goal should have no featured goal';
  select * into r from public.get_public_business('44444444-0000-4000-8000-000000000001');
  assert r.goal_title = 'Bigger oven' and r.goal_raised_cents = 100000, 'FAIL F4: the detail view has no featured goal';
  raise notice 'PASS F1-F4: each business shows its newest open goal with only held money counted as raised';
end $$;

-- ===== The detail function =====
do $$ declare id uuid := '44444444-0000-4000-8000-000000000001'; begin
  assert (select count(*) from public.get_public_business(id)) = 1, 'FAIL D1: verified business not found';
  assert (select count(*) from public.get_public_business('44444444-0000-4000-8000-000000000004')) = 0, 'FAIL D2: pending business returned';
  assert (select count(*) from public.get_public_business('44444444-0000-4000-8000-000000000006')) = 0, 'FAIL D3: suspended business returned';
  assert (select count(*) from public.get_public_business('00000000-0000-0000-0000-000000000000')) = 0, 'FAIL D4';
  raise notice 'PASS D1-D4: the detail view returns verified businesses only';
end $$;

-- ===== Nothing private is returned, and bad input is refused =====
do $$ declare shape text; begin
  select pg_get_function_result('public.discover_businesses(text,text,double precision,double precision,integer,integer,integer)'::regprocedure) into shape;
  assert shape not like '%owner%' and shape not like '%cipc%' and shape not like '%verification%' and shape not like '%document%',
    'FAIL P1: private columns appear in the result';
  select pg_get_function_result('public.get_public_business(uuid)'::regprocedure) into shape;
  assert shape not like '%owner%' and shape not like '%cipc%' and shape not like '%document%', 'FAIL P1b';
  raise notice 'PASS P1: results contain no owner, registration number, documents or review details';

  assert pg_temp.fails($q$select * from public.discover_businesses(p_lat => 10.0)$q$) like '22023%', 'FAIL P2: latitude without longitude accepted';
  assert pg_temp.fails($q$select * from public.discover_businesses(p_lat => 95, p_lng => 10)$q$) like '22023%', 'FAIL P3: impossible latitude accepted';
  raise notice 'PASS P2-P3: half or impossible coordinates are refused';
end $$;

-- ===== Signed-out visitors =====
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset
do $$ begin
  assert pg_temp.fails($q$select * from public.discover_businesses()$q$) like '42501%', 'FAIL A1: anonymous visitor can search';
  assert pg_temp.fails($q$select * from public.get_public_business('44444444-0000-4000-8000-000000000001')$q$) like '42501%', 'FAIL A2';
  raise notice 'PASS A1-A2: signed-out visitors cannot search or open business details';
end $$;
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '', false) \gset
do $$ begin
  assert pg_temp.fails($q$select * from public.discover_businesses()$q$) like '42501%', 'FAIL A3: a session with no user can search';
  raise notice 'PASS A3: a session without a signed-in user is refused too';
end $$;
