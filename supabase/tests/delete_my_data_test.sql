-- Step 11b tests: a person deleting their own account.
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
-- 01 administrator; 02 supporter whose money is all paid out; 03 supporter with money held;
-- 04 supporter with an open checkout; 05 supporter with nothing (and a report);
-- 11 founder with money held; 12 founder with no money (documents); 13 founder whose business an
-- administrator already closed; 14 founder whose money is all paid out.
insert into auth.users (id, email, raw_user_meta_data) values
 ('e3990000-0000-4000-8000-000000000001', 'admin@example.com',   '{"role":"investor","full_name":"The Admin","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000002', 'paid@example.com',    '{"role":"investor","full_name":"Paid Out Pat","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000003', 'held@example.com',    '{"role":"investor","full_name":"Held Money Hal","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000004', 'checkout@example.com','{"role":"investor","full_name":"Open Checkout Ola","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000005', 'plain@example.com',   '{"role":"donor","full_name":"Plain Pam","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000011', 'f1@example.com', '{"role":"business","full_name":"Founder One","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000012', 'f2@example.com', '{"role":"business","full_name":"Founder Two","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000013', 'f3@example.com', '{"role":"business","full_name":"Founder Three","popia_consent":true}'),
 ('e3990000-0000-4000-8000-000000000014', 'f4@example.com', '{"role":"business","full_name":"Founder Four","popia_consent":true}');
update public.profiles set role = 'admin', admin_level = 'super_admin' where id = 'e3990000-0000-4000-8000-000000000001';

insert into public.businesses (id, owner_id, name, category, description, suburb, cipc_number, youtube_url, verification, closed_at) values
 ('e4990000-0000-4000-8000-0000000000b1', 'e3990000-0000-4000-8000-000000000011', 'Blocked Bakery', 'bakery', 'About us', 'Soweto', '2020/111111/07', 'https://youtube.com/watch?v=one', 'verified', null),
 ('e4990000-0000-4000-8000-0000000000b2', 'e3990000-0000-4000-8000-000000000012', 'Quiet Bakery',   'bakery', 'About us', 'Soweto', '2020/222222/07', 'https://youtube.com/watch?v=two', 'verified', null),
 ('e4990000-0000-4000-8000-0000000000b3', 'e3990000-0000-4000-8000-000000000013', 'Closed Company', 'bakery', 'About us', 'Soweto', '2020/333333/07', null, 'suspended', now() - interval '2 months'),
 ('e4990000-0000-4000-8000-0000000000b4', 'e3990000-0000-4000-8000-000000000014', 'Settled Bakery',  'bakery', 'About us', 'Soweto', '2020/444444/07', null, 'verified', null);

insert into public.funding_goals (id, business_id, title, target_cents, kind, is_open) values
 ('e5990000-0000-4000-8000-0000000000a1', 'e4990000-0000-4000-8000-0000000000b1', 'Goal one',   5000000, 'donation', true),
 ('e5990000-0000-4000-8000-0000000000a2', 'e4990000-0000-4000-8000-0000000000b2', 'Goal two',   5000000, 'donation', true),
 ('e5990000-0000-4000-8000-0000000000a4', 'e4990000-0000-4000-8000-0000000000b4', 'Goal four',  5000000, 'donation', true);

insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status) values
 ('e5990000-0000-4000-8000-0000000000a4', 'e3990000-0000-4000-8000-000000000002', 3000, 'donation', 'held'),
 ('e5990000-0000-4000-8000-0000000000a1', 'e3990000-0000-4000-8000-000000000003', 5000, 'donation', 'held'),
 ('e5990000-0000-4000-8000-0000000000a1', 'e3990000-0000-4000-8000-000000000004', 2000, 'donation', 'pending');

insert into public.milestones (id, goal_id, title, amount_cents) values
 ('e6990000-0000-4000-8000-0000000000e4', 'e5990000-0000-4000-8000-0000000000a4', 'Buy flour', 3000);
insert into public.payouts (goal_id, milestone_id, amount_cents, status, provider_reference, paid_at) values
 ('e5990000-0000-4000-8000-0000000000a4', 'e6990000-0000-4000-8000-0000000000e4', 3000, 'paid', 'ref-4', now());

-- Founder Two has a pending and an approved document.
insert into public.documents (id, business_id, type, storage_path, status, reviewed_at) values
 ('e7990000-0000-4000-8000-0000000000d1', 'e4990000-0000-4000-8000-0000000000b2', 'tax_return',
  'e4990000-0000-4000-8000-0000000000b2/d1.pdf', 'pending', null),
 ('e7990000-0000-4000-8000-0000000000d2', 'e4990000-0000-4000-8000-0000000000b2', 'bank_statement',
  'e4990000-0000-4000-8000-0000000000b2/d2.pdf', 'verified', now() - interval '30 days');

insert into public.reports (reporter_id, business_id, reason) values
 ('e3990000-0000-4000-8000-000000000005', 'e4990000-0000-4000-8000-0000000000b1', 'a report written by Plain Pam');

-- ===== Refusals =====
set role service_role;
do $$ begin
  assert pg_temp.fails($q$select public.erase_account('e3990000-0000-4000-8000-000000000001')$q$) like '42501%',
    'FAIL E1: an administrator account was erased';
  assert pg_temp.fails($q$select public.erase_account('00000000-0000-4000-8000-000000000000')$q$) like 'P0002%',
    'FAIL E2: an unknown account was accepted';
  raise notice 'PASS E1-E2: administrators are never deleted here, and the account must exist';
end $$;

do $$ begin
  assert pg_temp.fails($q$select public.erase_account('e3990000-0000-4000-8000-000000000003')$q$) like '55006%',
    'FAIL E3: a supporter with money held was erased';
  assert pg_temp.fails($q$select public.erase_account('e3990000-0000-4000-8000-000000000004')$q$) like '55006%',
    'FAIL E4: a supporter with an open checkout was erased';
  assert pg_temp.fails($q$select public.erase_account('e3990000-0000-4000-8000-000000000011')$q$) like '55006%',
    'FAIL E5a: a founder with money held was erased';
  assert (select full_name from public.profiles where id = 'e3990000-0000-4000-8000-000000000003') = 'Held Money Hal',
    'FAIL E3b: a refused deletion still changed the profile';
  assert (select closed_at is null and name = 'Blocked Bakery' from public.businesses where id = 'e4990000-0000-4000-8000-0000000000b1'),
    'FAIL E5b: a refused deletion still changed the business';
  raise notice 'PASS E3-E5: money held, or an open checkout, stops the deletion and changes nothing';
end $$;

-- ===== A supporter whose money is all paid out =====
do $$ begin
  perform public.erase_account('e3990000-0000-4000-8000-000000000002');
  assert (select full_name from public.profiles where id = 'e3990000-0000-4000-8000-000000000002') = 'Deleted user',
    'FAIL E6a: the name is still there';
  assert (select deleted_at is not null from public.profiles where id = 'e3990000-0000-4000-8000-000000000002'),
    'FAIL E6b: the account is not marked deleted';
  assert (select count(*) from public.contributions
           where contributor_id = 'e3990000-0000-4000-8000-000000000002' and amount_cents = 3000) = 1,
    'FAIL E6c: the money record was deleted';
  assert (select details ->> 'had_business' from public.audit_log
           where action = 'account.deleted' and entity_id = 'e3990000-0000-4000-8000-000000000002') = 'false',
    'FAIL E6d: the deletion was not logged';
  raise notice 'PASS E6: a supporter is anonymised, the money record stays and the deletion is logged';
end $$;

-- ===== A founder whose money is all paid out =====
do $$ begin
  perform public.erase_account('e3990000-0000-4000-8000-000000000014');
  assert (select closed_at is not null and verification = 'suspended' from public.businesses
           where id = 'e4990000-0000-4000-8000-0000000000b4'),
    'FAIL E7a: the business was not closed';
  assert (select name = 'Deleted business' and description is null and suburb is null and location is null
                 and cipc_number is null and youtube_url is null and facebook_url is null and linkedin_url is null
            from public.businesses where id = 'e4990000-0000-4000-8000-0000000000b4'),
    'FAIL E7b: the business still carries personal details';
  assert (select count(*) from public.funding_goals where business_id = 'e4990000-0000-4000-8000-0000000000b4' and is_open) = 0,
    'FAIL E7c: a goal is still open';
  assert (select full_name from public.profiles where id = 'e3990000-0000-4000-8000-000000000014') = 'Deleted user',
    'FAIL E7d: the founder keeps their name';
  assert (select details ->> 'had_business' from public.audit_log
           where action = 'account.deleted' and entity_id = 'e3990000-0000-4000-8000-000000000014') = 'true',
    'FAIL E7e: the deletion was not logged as having a business';
  raise notice 'PASS E7: a founder''s business is closed and loses its personal details, and the founder is anonymised';
end $$;

-- ===== A founder with documents: the retention rules take over =====
do $$
declare ids uuid[];
begin
  perform public.erase_account('e3990000-0000-4000-8000-000000000012');
  select array_agg(id order by id) into ids from public.documents_due_for_purge(200);
  assert ids = array['e7990000-0000-4000-8000-0000000000d1']::uuid[],
    format('FAIL E8: due documents were %s', ids);
  raise notice 'PASS E8: the unapproved document is due at once; the approved one waits 12 months';
end $$;

-- ===== A business an administrator already closed =====
do $$ begin
  perform public.erase_account('e3990000-0000-4000-8000-000000000013');
  assert (select name = 'Deleted business' and description is null and cipc_number is null
                 and verification = 'suspended'
                 and closed_at between now() - interval '3 months' and now() - interval '1 month'
            from public.businesses where id = 'e4990000-0000-4000-8000-0000000000b3'),
    'FAIL E9: an already closed business was not scrubbed, or its closing date moved';
  raise notice 'PASS E9: an already closed business is scrubbed and keeps its closing date';
end $$;

-- ===== Reports the person wrote are deleted =====
do $$ begin
  perform public.erase_account('e3990000-0000-4000-8000-000000000005');
  assert (select count(*) from public.reports where reporter_id = 'e3990000-0000-4000-8000-000000000005') = 0,
    'FAIL E10: a report the person wrote is still there';
  raise notice 'PASS E10: the reports a person wrote are deleted';
end $$;

-- ===== Running it again is harmless, and nothing personal reaches the audit log =====
do $$ begin
  perform public.erase_account('e3990000-0000-4000-8000-000000000002');
  perform public.erase_account('e3990000-0000-4000-8000-000000000012');
  assert (select count(*) from public.audit_log
           where action = 'account.deleted' and entity_id = 'e3990000-0000-4000-8000-000000000002') = 1,
    'FAIL E11a: a second deletion was logged again';
  assert not exists (select 1 from public.audit_log
                      where action = 'account.deleted' and (details::text like '%@%' or details::text like '%Pat%')),
    'FAIL E11b: something personal reached the audit log';
  raise notice 'PASS E11: erasing twice is harmless, and the audit log holds no names or emails';
end $$;

-- ===== What the signed-in person and signed-out visitors can do =====
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'e3990000-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"e3990000-0000-4000-8000-000000000003","aal":"aal1"}', false) \gset
do $$ begin
  assert public.my_money_in_play(), 'FAIL U1a: held money is not reported';
  assert pg_temp.fails($q$select public.erase_account('e3990000-0000-4000-8000-000000000003')$q$) like '42501%',
    'FAIL U2: a signed-in person called the erase function directly';
  assert pg_temp.fails($q$select public.person_money_in_play('e3990000-0000-4000-8000-000000000003')$q$) like '42501%',
    'FAIL U3: a signed-in person called an internal helper';
  raise notice 'PASS U1-U3: a person can ask whether money is in play, but cannot erase or call the helpers';
end $$;

select set_config('request.jwt.claim.sub', 'e3990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"e3990000-0000-4000-8000-000000000002","aal":"aal1"}', false) \gset
do $$ begin
  assert not public.my_money_in_play(), 'FAIL U1b: a settled supporter is reported as having money in play';
  raise notice 'PASS U1b: a supporter whose money is paid out is not blocked';
end $$;

reset role;
set role anon;
do $$ begin
  assert pg_temp.fails($q$select public.my_money_in_play()$q$) like '42501%',
    'FAIL U4: a signed-out visitor called my_money_in_play';
  raise notice 'PASS U4: signed-out visitors cannot call it';
end $$;
