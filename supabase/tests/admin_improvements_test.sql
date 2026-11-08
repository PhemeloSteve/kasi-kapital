-- Step 9 tests: administrator levels, audit log access, suspending businesses, platform stats, user directory.
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
insert into auth.users (id, email, raw_user_meta_data) values
 ('aa990000-0000-4000-8000-000000000001', 'super@example.com',    '{"role":"investor","full_name":"Super Admin","popia_consent":true}'),
 ('aa990000-0000-4000-8000-000000000002', 'reviewer@example.com', '{"role":"investor","full_name":"Reviewer","popia_consent":true}'),
 ('aa990000-0000-4000-8000-000000000003', 'supporter@example.com','{"role":"investor","full_name":"Supporter","popia_consent":true}'),
 ('aa990000-0000-4000-8000-000000000004', 'founder1@example.com', '{"role":"business","full_name":"Founder One","popia_consent":true}'),
 ('aa990000-0000-4000-8000-000000000005', 'founder2@example.com', '{"role":"business","full_name":"Founder Two","popia_consent":true}'),
 ('aa990000-0000-4000-8000-000000000006', 'founder3@example.com', '{"role":"business","full_name":"Founder Three","popia_consent":true}');
update public.profiles set role = 'admin', admin_level = 'super_admin' where id = 'aa990000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin', admin_level = 'reviewer'    where id = 'aa990000-0000-4000-8000-000000000002';

insert into public.businesses (id, owner_id, name, category, verification) values
 ('bb990000-0000-4000-8000-0000000000b1', 'aa990000-0000-4000-8000-000000000004', 'Verified Bakery', 'bakery', 'verified'),
 ('bb990000-0000-4000-8000-0000000000b2', 'aa990000-0000-4000-8000-000000000005', 'Pending Farm', 'chicken_farm', 'pending'),
 ('bb990000-0000-4000-8000-0000000000b3', 'aa990000-0000-4000-8000-000000000006', 'Draft Shop', 'tuck_shop', 'unverified');
insert into public.funding_goals (id, business_id, title, target_cents, kind, is_open) values
 ('cc990000-0000-4000-8000-0000000000a1', 'bb990000-0000-4000-8000-0000000000b1', 'Open goal', 5000000, 'donation', true),
 ('cc990000-0000-4000-8000-0000000000a2', 'bb990000-0000-4000-8000-0000000000b1', 'Closed goal', 1000000, 'donation', false);
insert into public.milestones (id, goal_id, title, amount_cents) values
 ('dd990000-0000-4000-8000-0000000000c1', 'cc990000-0000-4000-8000-0000000000a1', 'Buy the oven', 120000),
 ('dd990000-0000-4000-8000-0000000000c2', 'cc990000-0000-4000-8000-0000000000a1', 'Buy flour', 30000);
insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status) values
 ('cc990000-0000-4000-8000-0000000000a1', 'aa990000-0000-4000-8000-000000000003', 5000, 'donation', 'held'),
 ('cc990000-0000-4000-8000-0000000000a1', 'aa990000-0000-4000-8000-000000000003', 2500, 'donation', 'held'),
 ('cc990000-0000-4000-8000-0000000000a1', 'aa990000-0000-4000-8000-000000000003', 1000, 'donation', 'pending'),
 ('cc990000-0000-4000-8000-0000000000a1', 'aa990000-0000-4000-8000-000000000003', 700,  'donation', 'released');
insert into public.payouts (goal_id, milestone_id, amount_cents, status, provider_reference, paid_at) values
 ('cc990000-0000-4000-8000-0000000000a1', 'dd990000-0000-4000-8000-0000000000c1', 120000, 'paid', 'ref-1', now());
insert into public.payouts (goal_id, milestone_id, amount_cents, status) values
 ('cc990000-0000-4000-8000-0000000000a1', 'dd990000-0000-4000-8000-0000000000c2', 30000, 'pending');
insert into public.audit_log (action, entity, entity_id) values ('test.seed', 'tests', 'seed');

-- ===== Levels =====
set role authenticated;
select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000001', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal2"}', false) \gset
do $$ begin
  assert public.is_admin() and public.is_super_admin(), 'FAIL A1: a super admin with two factors lacks super powers';
  raise notice 'PASS A1: a super admin with two-factor login is a super admin';
end $$;

select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal1"}', false) \gset
do $$ begin
  assert not public.is_super_admin(), 'FAIL A2: a password-only super admin counts as super admin';
  raise notice 'PASS A2: a super admin without the second factor has no super powers';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
do $$ begin
  assert public.is_admin(), 'FAIL A3a: a reviewer is not an admin';
  assert not public.is_super_admin(), 'FAIL A3b: a reviewer counts as super admin';
  raise notice 'PASS A3: a reviewer is an admin but not a super admin';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000003","aal":"aal2"}', false) \gset
do $$ begin
  assert not public.is_super_admin(), 'FAIL A4: a supporter counts as super admin';
  raise notice 'PASS A4: a strong login does not make a supporter a super admin';
end $$;

-- ===== Nobody can promote themselves =====
update public.profiles set admin_level = 'super_admin' where id = 'aa990000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
update public.profiles set admin_level = 'super_admin' where id = 'aa990000-0000-4000-8000-000000000002';
-- back to the project owner: no signed-in user at all
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset
select set_config('request.jwt.claims', '', false) \gset
do $$ begin
  assert (select admin_level from public.profiles where id = 'aa990000-0000-4000-8000-000000000002') = 'reviewer',
    'FAIL P1: a reviewer promoted themselves';
  assert (select admin_level from public.profiles where id = 'aa990000-0000-4000-8000-000000000003') is null,
    'FAIL P2: a supporter was given an admin level';
  assert pg_temp.fails($q$update public.profiles set admin_level = 'super_admin' where id = 'aa990000-0000-4000-8000-000000000004'$q$) like '23514%',
    'FAIL P3: a non-admin account was given an admin level';
  raise notice 'PASS P1-P3: admin levels cannot be changed by the people they apply to, and only admins have one';
end $$;

-- a super admin may change a level
set role authenticated;
select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000001', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal2"}', false) \gset
update public.profiles set admin_level = 'super_admin' where id = 'aa990000-0000-4000-8000-000000000002';
reset role;
do $$ begin
  assert (select admin_level from public.profiles where id = 'aa990000-0000-4000-8000-000000000002') = 'super_admin',
    'FAIL P4: a super admin could not promote a reviewer';
  update public.profiles set admin_level = 'reviewer' where id = 'aa990000-0000-4000-8000-000000000002';
  raise notice 'PASS P4: a super admin can change another admin''s level';
end $$;

-- ===== Audit log =====
set role authenticated;
select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
do $$ begin
  assert (select count(*) from public.audit_log) = 0, 'FAIL L1: a reviewer can read the audit log';
  raise notice 'PASS L1: a reviewer cannot read the audit log';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000003","aal":"aal2"}', false) \gset
do $$ begin
  assert (select count(*) from public.audit_log) = 0, 'FAIL L2: a supporter can read the audit log';
  raise notice 'PASS L2: a supporter cannot read the audit log';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000001', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal1"}', false) \gset
do $$ begin
  assert (select count(*) from public.audit_log) = 0, 'FAIL L3: a password-only super admin can read the audit log';
  raise notice 'PASS L3: a super admin without the second factor cannot read the audit log';
end $$;

select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal2"}', false) \gset
do $$ begin
  assert (select count(*) from public.audit_log where action = 'test.seed') = 1, 'FAIL L4: a super admin cannot read the audit log';
  raise notice 'PASS L4: a super admin with two factors can read the audit log';
end $$;

-- ===== Platform stats =====
do $$ declare s record; begin
  select * into s from public.platform_stats();
  assert s.total_businesses = 3, format('FAIL S1a: total %s', s.total_businesses);
  assert s.verified_businesses = 1, format('FAIL S1b: verified %s', s.verified_businesses);
  assert s.pending_businesses = 1, format('FAIL S1c: pending %s', s.pending_businesses);
  assert s.open_goals = 1, format('FAIL S1d: open goals %s', s.open_goals);
  assert s.held_cents = 7500, format('FAIL S1e: held %s', s.held_cents);
  assert s.paid_out_cents = 120000, format('FAIL S1f: paid out %s', s.paid_out_cents);
  raise notice 'PASS S1: platform stats count businesses, open goals, escrow and payouts correctly';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
do $$ begin
  assert (select total_businesses from public.platform_stats()) = 3, 'FAIL S2: a reviewer cannot see the stats';
  raise notice 'PASS S2: a reviewer can see the platform stats';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000003","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select * from public.platform_stats()$q$) like '42501%', 'FAIL S3: a supporter read the platform money totals';
  raise notice 'PASS S3: a supporter cannot read the platform stats';
end $$;

-- ===== User directory =====
select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select * from public.admin_list_users()$q$) like '42501%', 'FAIL U1: a reviewer listed all users';
  raise notice 'PASS U1: a reviewer cannot list users';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000001', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal2"}', false) \gset
do $$ declare u record; begin
  assert (select count(*) from public.admin_list_users()) = 6, 'FAIL U2a: wrong number of users';
  select * into u from public.admin_list_users() where id = 'aa990000-0000-4000-8000-000000000003';
  assert u.email = 'supporter@example.com', 'FAIL U2b: email missing';
  assert u.contributed_cents = 8200, format('FAIL U2c: contributed %s (expected held + released = 8200)', u.contributed_cents);
  raise notice 'PASS U2: a super admin sees every account with email and total contributed';
end $$;

-- ===== Suspending a business =====
select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.suspend_business('bb990000-0000-4000-8000-0000000000b1', 'fraud')$q$) like '42501%',
    'FAIL B1: a reviewer suspended a business';
  assert pg_temp.fails($q$select public.unsuspend_business('bb990000-0000-4000-8000-0000000000b1')$q$) like '42501%',
    'FAIL B1b: a reviewer reinstated a business';
  raise notice 'PASS B1: a reviewer cannot suspend or reinstate';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000003","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.suspend_business('bb990000-0000-4000-8000-0000000000b1', 'fraud')$q$) like '42501%',
    'FAIL B2: a supporter suspended a business';
  assert (select count(*) from public.businesses where id = 'bb990000-0000-4000-8000-0000000000b1') = 1,
    'FAIL B2b: fixture: a supporter should see the verified bakery';
  raise notice 'PASS B2: a supporter cannot suspend, and can see the verified business beforehand';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000001', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal1"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.suspend_business('bb990000-0000-4000-8000-0000000000b1', 'fraud')$q$) like '42501%',
    'FAIL B3: a password-only super admin suspended a business';
  raise notice 'PASS B3: suspending needs the second factor too';
end $$;

select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.suspend_business('bb990000-0000-4000-8000-0000000000b1', null)$q$) like '22023%', 'FAIL B4a: null reason accepted';
  assert pg_temp.fails($q$select public.suspend_business('bb990000-0000-4000-8000-0000000000b1', '   ')$q$) like '22023%', 'FAIL B4b: blank reason accepted';
  assert pg_temp.fails(format($q$select public.suspend_business('bb990000-0000-4000-8000-0000000000b1', %L)$q$, repeat('x', 301))) like '22023%', 'FAIL B4c: over-long reason accepted';
  assert pg_temp.fails($q$select public.suspend_business('00000000-0000-4000-8000-000000000000', 'fraud')$q$) like 'P0002%', 'FAIL B4d: unknown business accepted';
  assert (select verification from public.businesses where id = 'bb990000-0000-4000-8000-0000000000b1') = 'verified', 'FAIL B4e: a refused suspension still changed the business';
  raise notice 'PASS B4: a reason is required and unknown businesses are refused';
end $$;

do $$ begin
  perform public.suspend_business('bb990000-0000-4000-8000-0000000000b1', '  Reported for fraud  ');
  assert (select verification from public.businesses where id = 'bb990000-0000-4000-8000-0000000000b1') = 'suspended', 'FAIL B5a: not suspended';
  assert (select details ->> 'reason' from public.audit_log where action = 'business.suspended' and entity_id = 'bb990000-0000-4000-8000-0000000000b1') = 'Reported for fraud',
    'FAIL B5b: suspension or trimmed reason not in the audit log';
  assert (select actor_id from public.audit_log where action = 'business.suspended' and entity_id = 'bb990000-0000-4000-8000-0000000000b1') = 'aa990000-0000-4000-8000-000000000001',
    'FAIL B5c: suspension logged without the actor';
  raise notice 'PASS B5: suspending sets the status and writes the reason and actor to the audit log';
end $$;

select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000003","aal":"aal2"}', false) \gset
do $$ begin
  assert (select count(*) from public.businesses where id = 'bb990000-0000-4000-8000-0000000000b1') = 0,
    'FAIL B6: a suspended business is still visible to supporters';
  assert pg_temp.fails($q$select public.start_contribution('cc990000-0000-4000-8000-0000000000a1', 10000)$q$) like 'P0002%',
    'FAIL B6b: a supporter could contribute to a suspended business';
  raise notice 'PASS B6: a suspended business disappears and cannot take new contributions';
end $$;

-- ===== Reinstating =====
select set_config('request.jwt.claim.sub', 'aa990000-0000-4000-8000-000000000001', false) \gset
select set_config('request.jwt.claims', '{"sub":"aa990000-0000-4000-8000-000000000001","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.unsuspend_business('bb990000-0000-4000-8000-0000000000b2')$q$) like '22023%',
    'FAIL R1: reinstating a business that is not suspended was allowed';
  assert (select verification from public.businesses where id = 'bb990000-0000-4000-8000-0000000000b2') = 'pending', 'FAIL R1b: status changed';
  assert pg_temp.fails($q$select public.unsuspend_business('00000000-0000-4000-8000-000000000000')$q$) like 'P0002%',
    'FAIL R1c: unknown business accepted';
  perform public.unsuspend_business('bb990000-0000-4000-8000-0000000000b1');
  assert (select verification from public.businesses where id = 'bb990000-0000-4000-8000-0000000000b1') = 'pending',
    'FAIL R2: reinstating did not return the business to pending';
  assert (select count(*) from public.audit_log where action = 'business.unsuspended' and entity_id = 'bb990000-0000-4000-8000-0000000000b1') = 1,
    'FAIL R3: reinstating was not logged';
  raise notice 'PASS R1-R3: only suspended businesses can be reinstated; they return to pending and it is logged';
end $$;

reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset
select set_config('request.jwt.claims', '', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.suspend_business('bb990000-0000-4000-8000-0000000000b1', 'x')$q$) is not null, 'FAIL X1: a signed-out visitor suspended a business';
  assert pg_temp.fails($q$select * from public.platform_stats()$q$) is not null, 'FAIL X2: a signed-out visitor read the stats';
  assert pg_temp.fails($q$select * from public.admin_list_users()$q$) is not null, 'FAIL X3: a signed-out visitor listed users';
  raise notice 'PASS X1-X3: signed-out visitors can call none of the admin functions';
end $$;
reset role;
