-- Row Level Security and signup smoke test: who may read or change what, and how signup is recorded.
-- Run against a THROWAWAY local Postgres (never your real project):
--   1. createdb kk_test && psql kk_test -f supabase/tests/stub_supabase.sql   (fake auth schema)
--   2. apply every file in supabase/migrations/ in order, each with: psql kk_test -1 -f <file>
--   3. psql kk_test -f supabase/tests/rls_smoke_test.sql   (look for PASS lines, no FAIL/ERROR)
-- Easiest: run supabase/tests/run_tests.sh, which does all of this on a fresh database each time.
-- Needs PostgreSQL with PostGIS. Tests run as a non-superuser role so RLS really applies.
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if;
end $$;
grant usage on schema public, auth to app_user;
grant all on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant execute on function auth.uid() to app_user;

-- Fixtures (as superuser)
insert into auth.users (id, raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000001', '{"role":"business","full_name":"Founder"}'),
 ('b0000000-0000-4000-8000-000000000002', '{"role":"investor","full_name":"Investor"}'),
 ('c0000000-0000-4000-8000-000000000003', '{"role":"admin","full_name":"Sneaky"}');   -- tries to self-assign admin

do $$ begin
  assert (select role from public.profiles where id='c0000000-0000-4000-8000-000000000003') = 'investor',
    'FAIL 1: signup must never create an admin from user metadata';
  raise notice 'PASS 1: self-assigned admin at signup is downgraded to investor';
end $$;

-- Consent is timestamped by the database, and only when the signup says so.
insert into auth.users (id, raw_user_meta_data) values
 ('f0000000-0000-4000-8000-000000000004', '{"role":"donor","full_name":"  Consenting Donor  ","popia_consent":true}'),
 ('f0000000-0000-4000-8000-000000000005', '{"role":"donor","full_name":"No Consent"}');
do $$ begin
  assert (select popia_consent_at is not null from public.profiles where id='f0000000-0000-4000-8000-000000000004'),
    'FAIL 1b: consent flag should record a timestamp';
  assert (select popia_consent_at is null from public.profiles where id='f0000000-0000-4000-8000-000000000005'),
    'FAIL 1c: no consent flag must leave consent empty';
  assert (select full_name from public.profiles where id='f0000000-0000-4000-8000-000000000004') = 'Consenting Donor',
    'FAIL 1d: full name should be trimmed';
  raise notice 'PASS 1b-d: consent is timestamped by the database only when given; names are trimmed';
end $$;

-- make a real admin out-of-band (as the project owner would), plus two businesses
update public.profiles set role='admin' where id='c0000000-0000-4000-8000-000000000003';
insert into auth.users (id, raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000009', '{"role":"business","full_name":"Second Founder","popia_consent":true}');
insert into public.businesses (id, owner_id, name, category, verification) values
 ('d0000000-0000-4000-8000-0000000000d1','a0000000-0000-4000-8000-000000000001','Verified Bakery','bakery','verified'),
 ('d0000000-0000-4000-8000-0000000000d2','a0000000-0000-4000-8000-000000000009','Pending Tuck Shop','tuck_shop','pending');
insert into public.documents (business_id, type, storage_path) values
 ('d0000000-0000-4000-8000-0000000000d1','bank_statement','d0000000-0000-4000-8000-0000000000d1/y.pdf');
insert into public.funding_goals (id, business_id, title, target_cents) values
 ('e0000000-0000-4000-8000-0000000000e1','d0000000-0000-4000-8000-0000000000d1','New oven',500000);

-- ===== act as the INVESTOR =====
set role app_user;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002', false);

do $$ declare n int; begin
  select count(*) into n from public.businesses;
  assert n = 1, format('FAIL 2: investor should see only the verified business, saw %s', n);
  raise notice 'PASS 2: investor sees only verified businesses';

  select count(*) into n from public.documents;
  assert n = 0, 'FAIL 3: investor must not read documents';
  raise notice 'PASS 3: investor cannot read business documents';

  select count(*) into n from public.funding_goals;
  assert n = 1, 'FAIL 4: investor should see goals of verified business';
  raise notice 'PASS 4: investor sees goals of verified businesses';
end $$;

-- investor tries to promote themselves
update public.profiles set role='admin', kyc_status='verified' where id='b0000000-0000-4000-8000-000000000002';
do $$ begin
  assert (select role from public.profiles where id='b0000000-0000-4000-8000-000000000002') = 'investor'
     and (select kyc_status from public.profiles where id='b0000000-0000-4000-8000-000000000002') = 'unverified',
    'FAIL 5: user changed own role or KYC status';
  raise notice 'PASS 5: user cannot change own role or KYC status';
end $$;

-- investor tries to create a business and a contribution
do $$ begin
  begin
    insert into public.businesses (owner_id, name, category) values ('b0000000-0000-4000-8000-000000000002','Fake','x');
    raise exception 'FAIL 6: investor created a business';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS 6: investor cannot create a business';
  end;
  begin
    insert into public.contributions (goal_id, contributor_id, amount_cents, kind)
      values ('e0000000-0000-4000-8000-0000000000e1','b0000000-0000-4000-8000-000000000002',100,'donation');
    raise exception 'FAIL 7: client inserted a contribution directly';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS 7: clients cannot insert contributions directly (server-side only)';
  end;
end $$;

-- ===== act as the FOUNDER =====
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001', false);
do $$ declare n int; begin
  select count(*) into n from public.businesses;
  assert n = 1, 'FAIL 8: founder 1 should see only the verified business (their own)';
  select count(*) into n from public.documents;
  assert n = 1, 'FAIL 9: owner should see own documents';
  raise notice 'PASS 8-9: founder sees own business and documents';
end $$;

-- ===== act as the ADMIN =====
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000003', false);
do $$ declare n int; begin
  select count(*) into n from public.businesses; assert n = 2, 'FAIL 10';
  select count(*) into n from public.documents;  assert n = 1, 'FAIL 11';
  raise notice 'PASS 10-11: admin sees all businesses and documents';
end $$;

-- ===== anonymous (no user) =====
select set_config('request.jwt.claim.sub','', false);
do $$ declare n int; begin
  select count(*) into n from public.businesses; assert n = 1, 'FAIL 12: anon should see only verified';
  select count(*) into n from public.documents;  assert n = 0, 'FAIL 13: anon must not see documents';
  raise notice 'PASS 12-13: anonymous visitors see only verified businesses, never documents';
end $$;
