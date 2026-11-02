-- Step 7 tests: two-factor for administrators, rate limits and the unpaid-checkout cap.
\set ON_ERROR_STOP on

grant usage on schema public, auth to anon, authenticated, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin execute stmt; return null;
exception when others then return sqlstate || ': ' || sqlerrm;
end $$;

-- ---------- Fixtures (as the project owner) ----------
insert into auth.users (id, raw_user_meta_data) values
 ('99999999-0000-4000-8000-000000000001', '{"role":"business","full_name":"Founder","popia_consent":true}'),
 ('99999999-0000-4000-8000-000000000004', '{"role":"business","full_name":"Founder Two","popia_consent":true}'),
 ('99999999-0000-4000-8000-000000000002', '{"role":"investor","full_name":"Investor","popia_consent":true}'),
 ('99999999-0000-4000-8000-000000000003', '{"role":"investor","full_name":"Investor Two","popia_consent":true}'),
 ('99999999-0000-4000-8000-0000000000ad', '{"role":"investor","full_name":"Admin","popia_consent":true}');
update public.profiles set role = 'admin' where id = '99999999-0000-4000-8000-0000000000ad';
update public.profiles set kyc_status = 'verified' where id = '99999999-0000-4000-8000-000000000002';

insert into public.businesses (id, owner_id, name, category, verification) values
 ('aaaaaaaa-0000-4000-8000-0000000000b1', '99999999-0000-4000-8000-000000000001', 'Verified Bakery', 'bakery', 'verified'),
 ('aaaaaaaa-0000-4000-8000-0000000000b2', '99999999-0000-4000-8000-000000000004', 'Pending Farm', 'chicken_farm', 'pending');
insert into public.funding_goals (id, business_id, title, target_cents, kind) values
 ('bbbbbbbb-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000b1', 'A large goal', 5000000, 'donation');
insert into public.documents (id, business_id, type, storage_path, status) values
 ('cccccccc-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-0000000000b2', 'id', 'aaaaaaaa-0000-4000-8000-0000000000b2/id.pdf', 'pending'),
 ('cccccccc-0000-4000-8000-0000000000d2', 'aaaaaaaa-0000-4000-8000-0000000000b2', 'bank_statement', 'aaaaaaaa-0000-4000-8000-0000000000b2/bank.pdf', 'pending');

-- ===== Administrator without a second factor (aal1) =====
set role authenticated;
select set_config('request.jwt.claim.sub', '99999999-0000-4000-8000-0000000000ad', false) \gset
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-0000000000ad","aal":"aal1"}', false) \gset
do $$ begin
  assert not public.is_admin(), 'FAIL M1: an administrator with only a password counts as admin';
  assert pg_temp.fails($q$select public.review_document('cccccccc-0000-4000-8000-0000000000d1', true, null)$q$) like '42501%',
    'FAIL M2: a password-only administrator approved a document';
  assert pg_temp.fails($q$select public.review_milestone('00000000-0000-0000-0000-000000000000', true, null)$q$) like '42501%',
    'FAIL M2b: a password-only administrator reviewed a milestone';
  assert (select count(*) from public.documents) = 0, 'FAIL M3: a password-only administrator can read documents';
  assert (select count(*) from public.businesses) = 1, 'FAIL M3b: a password-only administrator sees unverified businesses';
  raise notice 'PASS M1-M3: without the second factor, an administrator has no admin powers at all (not even reading)';
end $$;

-- a token with no assurance level at all is treated the same way
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-0000000000ad"}', false) \gset
do $$ begin
  assert not public.is_admin(), 'FAIL M4: a token without an assurance level counts as admin';
  raise notice 'PASS M4: a token that does not prove a second factor is not enough';
end $$;

-- ===== Administrator with the second factor (aal2) =====
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-0000000000ad","aal":"aal2"}', false) \gset
do $$ declare r jsonb; begin
  assert public.is_admin(), 'FAIL M5';
  assert (select count(*) from public.documents) = 2, 'FAIL M5b: an administrator with two factors cannot read documents';
  r := public.review_document('cccccccc-0000-4000-8000-0000000000d1', true, null);
  assert r ->> 'business_status' = 'pending', format('FAIL M6: %s', r);
  raise notice 'PASS M5-M6: with the second factor, administrator powers work as before';
end $$;

-- ===== Nobody else gains admin powers from a strong login =====
select set_config('request.jwt.claim.sub', '99999999-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
do $$ begin
  assert not public.is_admin(), 'FAIL M7: a strong login made a supporter an administrator';
  raise notice 'PASS M7: a strong login alone does not make anyone an administrator';
end $$;

-- ===== Rate limits =====
do $$ declare i int; ok_count int := 0; begin
  for i in 1 .. 20 loop
    if public.rate_limit('contribute') then ok_count := ok_count + 1; end if;
  end loop;
  assert ok_count = 20, 'FAIL R1a: the first 20 attempts should be allowed';
  assert not public.rate_limit('contribute'), 'FAIL R1b: the 21st attempt in an hour was allowed';
  assert not public.rate_limit('contribute'), 'FAIL R1c: still over the limit';
  assert public.rate_limit('upload'), 'FAIL R2: a different action shares the contribute counter';
  raise notice 'PASS R1-R2: 20 contributions per hour are allowed, the 21st is refused, and other actions count separately';

  assert pg_temp.fails($q$select public.rate_limit('made-up-action')$q$) like '22023%', 'FAIL R3: an unknown action was accepted';
  assert (select count(*) from public.rate_limit_hits) = 0, 'FAIL R4: a user can read the counters';
  raise notice 'PASS R3-R4: unknown actions are refused and users cannot read the counters';
end $$;
update public.rate_limit_hits set hits = 0;
select set_config('request.jwt.claim.sub', '99999999-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-000000000003","aal":"aal1"}', false) \gset
do $$ begin
  assert public.rate_limit('contribute'), 'FAIL R5: one person''s limit affected another';
  raise notice 'PASS R5: each person has their own limit';
end $$;
reset role;
do $$ begin
  assert (select hits from public.rate_limit_hits where user_id = '99999999-0000-4000-8000-000000000002' and action = 'contribute') = 22,
    'FAIL R6: a user was able to reset their own counter';
  raise notice 'PASS R6: a user cannot reset their own counter';
end $$;
set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset
select set_config('request.jwt.claims', '', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.rate_limit('contribute')$q$) like '42501%', 'FAIL R7: a signed-out visitor used the limiter';
  raise notice 'PASS R7: signed-out visitors cannot call the limiter';
end $$;

-- ===== Cap on unpaid checkouts =====
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '99999999-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-000000000002","aal":"aal1"}', false) \gset
do $$ declare i int; g uuid := 'bbbbbbbb-0000-4000-8000-0000000000a1'; begin
  for i in 1 .. 5 loop perform public.start_contribution(g, 1000); end loop;
  assert pg_temp.fails(format('select public.start_contribution(%L, 1000)', g)) like 'KK006%', 'FAIL P1: a sixth unpaid checkout was allowed';
  raise notice 'PASS P1: five unpaid checkouts are allowed, a sixth is refused';
end $$;
reset role;
update public.contributions set created_at = now() - interval '1 hour' where contributor_id = '99999999-0000-4000-8000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub', '99999999-0000-4000-8000-000000000002', false) \gset
do $$ begin
  perform public.start_contribution('bbbbbbbb-0000-4000-8000-0000000000a1', 1000);
  raise notice 'PASS P2: expired checkouts stop counting towards the cap';
end $$;
select set_config('request.jwt.claim.sub', '99999999-0000-4000-8000-000000000003', false) \gset
do $$ begin
  perform public.start_contribution('bbbbbbbb-0000-4000-8000-0000000000a1', 1000);
  raise notice 'PASS P3: one supporter''s open checkouts do not block another';
end $$;
