-- Step 11a tests: closing a business, and the documents of a closed business.
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
 ('c3990000-0000-4000-8000-000000000001', 'super@example.com',    '{"role":"investor","full_name":"Super","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000002', 'reviewer@example.com', '{"role":"investor","full_name":"Reviewer","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000003', 'supporter@example.com','{"role":"investor","full_name":"Supporter","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000011', 'f1@example.com', '{"role":"business","full_name":"F1","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000012', 'f2@example.com', '{"role":"business","full_name":"F2","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000013', 'f3@example.com', '{"role":"business","full_name":"F3","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000014', 'f4@example.com', '{"role":"business","full_name":"F4","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000015', 'f5@example.com', '{"role":"business","full_name":"F5","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000016', 'f6@example.com', '{"role":"business","full_name":"F6","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000017', 'f7@example.com', '{"role":"business","full_name":"F7","popia_consent":true}'),
 ('c3990000-0000-4000-8000-000000000018', 'f8@example.com', '{"role":"business","full_name":"F8","popia_consent":true}');
update public.profiles set role = 'admin', admin_level = 'super_admin' where id = 'c3990000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin', admin_level = 'reviewer'    where id = 'c3990000-0000-4000-8000-000000000002';

-- B1 money held, B2 open checkout, B3 payout on its way, B4 fully paid out, B5 plain, B6 open (documents),
-- B7 closed 2 months ago, B8 closed 13 months ago.
insert into public.businesses (id, owner_id, name, category, verification, closed_at) values
 ('c4990000-0000-4000-8000-0000000000b1', 'c3990000-0000-4000-8000-000000000011', 'Money Held',      'bakery', 'verified',   null),
 ('c4990000-0000-4000-8000-0000000000b2', 'c3990000-0000-4000-8000-000000000012', 'Live Checkout',   'bakery', 'verified',   null),
 ('c4990000-0000-4000-8000-0000000000b3', 'c3990000-0000-4000-8000-000000000013', 'Payout On Its Way','bakery', 'verified',  null),
 ('c4990000-0000-4000-8000-0000000000b4', 'c3990000-0000-4000-8000-000000000014', 'Settled',         'bakery', 'verified',   null),
 ('c4990000-0000-4000-8000-0000000000b5', 'c3990000-0000-4000-8000-000000000015', 'Plain',           'bakery', 'unverified', null),
 ('c4990000-0000-4000-8000-0000000000b6', 'c3990000-0000-4000-8000-000000000016', 'Open Bakery',     'bakery', 'verified',   null),
 ('c4990000-0000-4000-8000-0000000000b7', 'c3990000-0000-4000-8000-000000000017', 'Closed Recently', 'bakery', 'suspended',  now() - interval '2 months'),
 ('c4990000-0000-4000-8000-0000000000b8', 'c3990000-0000-4000-8000-000000000018', 'Closed Long Ago', 'bakery', 'suspended',  now() - interval '13 months');

insert into public.funding_goals (id, business_id, title, target_cents, kind, is_open) values
 ('c5990000-0000-4000-8000-0000000000a1', 'c4990000-0000-4000-8000-0000000000b1', 'G1', 5000000, 'donation', true),
 ('c5990000-0000-4000-8000-0000000000a2', 'c4990000-0000-4000-8000-0000000000b2', 'G2', 5000000, 'donation', true),
 ('c5990000-0000-4000-8000-0000000000a3', 'c4990000-0000-4000-8000-0000000000b3', 'G3', 5000000, 'donation', true),
 ('c5990000-0000-4000-8000-0000000000a4', 'c4990000-0000-4000-8000-0000000000b4', 'G4', 5000000, 'donation', true),
 ('c5990000-0000-4000-8000-0000000000a5', 'c4990000-0000-4000-8000-0000000000b4', 'G4 second', 5000000, 'donation', true),
 ('c5990000-0000-4000-8000-0000000000a8', 'c4990000-0000-4000-8000-0000000000b8', 'G8', 5000000, 'donation', false);

insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status) values
 ('c5990000-0000-4000-8000-0000000000a1', 'c3990000-0000-4000-8000-000000000003', 5000, 'donation', 'held'),
 ('c5990000-0000-4000-8000-0000000000a2', 'c3990000-0000-4000-8000-000000000003', 2000, 'donation', 'pending'),
 ('c5990000-0000-4000-8000-0000000000a3', 'c3990000-0000-4000-8000-000000000003', 3000, 'donation', 'held'),
 ('c5990000-0000-4000-8000-0000000000a4', 'c3990000-0000-4000-8000-000000000003', 3000, 'donation', 'held');

insert into public.milestones (id, goal_id, title, amount_cents) values
 ('c6990000-0000-4000-8000-0000000000e3', 'c5990000-0000-4000-8000-0000000000a3', 'Buy the oven', 3000),
 ('c6990000-0000-4000-8000-0000000000e4', 'c5990000-0000-4000-8000-0000000000a4', 'Buy flour', 3000);
insert into public.payouts (goal_id, milestone_id, amount_cents, status, provider_reference, paid_at) values
 ('c5990000-0000-4000-8000-0000000000a4', 'c6990000-0000-4000-8000-0000000000e4', 3000, 'paid', 'ref-4', now());
insert into public.payouts (goal_id, milestone_id, amount_cents, status) values
 ('c5990000-0000-4000-8000-0000000000a3', 'c6990000-0000-4000-8000-0000000000e3', 3000, 'pending');

-- Documents. Open business B6: a pending one and an old approved one (neither is ever due).
-- B7 (closed 2 months ago): pending, rejected 5 days ago, approved. B8 (closed 13 months ago): two approved.
insert into public.documents (id, business_id, type, storage_path, status, reviewed_at) values
 ('d3990000-0000-4000-8000-0000000000a1', 'c4990000-0000-4000-8000-0000000000b6', 'tax_return',
  'c4990000-0000-4000-8000-0000000000b6/a1.pdf', 'pending', null),
 ('d3990000-0000-4000-8000-0000000000a2', 'c4990000-0000-4000-8000-0000000000b6', 'bank_statement',
  'c4990000-0000-4000-8000-0000000000b6/a2.pdf', 'verified', now() - interval '400 days'),
 ('d3990000-0000-4000-8000-0000000000b1', 'c4990000-0000-4000-8000-0000000000b7', 'tax_return',
  'c4990000-0000-4000-8000-0000000000b7/b1.pdf', 'pending', null),
 ('d3990000-0000-4000-8000-0000000000b2', 'c4990000-0000-4000-8000-0000000000b7', 'other',
  'c4990000-0000-4000-8000-0000000000b7/b2.pdf', 'rejected', now() - interval '5 days'),
 ('d3990000-0000-4000-8000-0000000000b3', 'c4990000-0000-4000-8000-0000000000b7', 'bank_statement',
  'c4990000-0000-4000-8000-0000000000b7/b3.pdf', 'verified', now() - interval '100 days'),
 ('d3990000-0000-4000-8000-0000000000c1', 'c4990000-0000-4000-8000-0000000000b8', 'bank_statement',
  'c4990000-0000-4000-8000-0000000000b8/c1.pdf', 'verified', now() - interval '500 days'),
 ('d3990000-0000-4000-8000-0000000000c2', 'c4990000-0000-4000-8000-0000000000b8', 'id',
  'c4990000-0000-4000-8000-0000000000b8/c2.pdf', 'verified', now() - interval '500 days');
-- An approved milestone on B8 whose proof is one of the approved documents.
insert into public.milestones (id, goal_id, title, amount_cents, status, proof_document_id) values
 ('c6990000-0000-4000-8000-0000000000e8', 'c5990000-0000-4000-8000-0000000000a8', 'Buy stock', 120000,
  'approved', 'd3990000-0000-4000-8000-0000000000c1');

-- ===== The periods =====
do $$ begin
  assert public.setting('retention_closed_document_months') = 12, 'FAIL S1a: closed-business period is not 12 months';
  assert public.setting('retention_financial_record_years') = 5, 'FAIL S1b: money-record period is not 5 years';
  raise notice 'PASS S1: the periods are 12 months for approved documents and 5 years for money records';
end $$;

-- ===== Which documents are due (server side, no signed-in user) =====
set role service_role;
do $$
declare ids uuid[];
begin
  select array_agg(id order by id) into ids from public.documents_due_for_purge(200);
  assert ids = array[
      'd3990000-0000-4000-8000-0000000000b1', 'd3990000-0000-4000-8000-0000000000b2',
      'd3990000-0000-4000-8000-0000000000c1', 'd3990000-0000-4000-8000-0000000000c2']::uuid[],
    format('FAIL P1: due documents were %s', ids);
  raise notice 'PASS P1: unreviewed documents of a closed business are due at once, approved ones after 12 months, and nothing of an open business';
end $$;

-- ===== Deleting them =====
do $$
declare n integer;
begin
  n := public.finish_document_purge(array[
      'd3990000-0000-4000-8000-0000000000a1', 'd3990000-0000-4000-8000-0000000000a2',
      'd3990000-0000-4000-8000-0000000000b1', 'd3990000-0000-4000-8000-0000000000b2',
      'd3990000-0000-4000-8000-0000000000b3', 'd3990000-0000-4000-8000-0000000000c1',
      'd3990000-0000-4000-8000-0000000000c2']::uuid[]);
  assert n = 4, format('FAIL P2a: %s documents were deleted instead of 4', n);
  assert (select array_agg(id order by id) from public.documents where id::text like 'd3990000%') = array[
      'd3990000-0000-4000-8000-0000000000a1', 'd3990000-0000-4000-8000-0000000000a2',
      'd3990000-0000-4000-8000-0000000000b3']::uuid[], 'FAIL P2b: the wrong documents were left';
  raise notice 'PASS P2: only due documents are deleted, even when others are passed in';
end $$;

do $$ begin
  assert (select details ->> 'reason' from public.audit_log
           where action = 'document.purged' and entity_id = 'd3990000-0000-4000-8000-0000000000b1') = 'closed_business_unreviewed',
    'FAIL P3a: wrong reason for an unreviewed document';
  assert (select details ->> 'reason' from public.audit_log
           where action = 'document.purged' and entity_id = 'd3990000-0000-4000-8000-0000000000b2') = 'closed_business_unreviewed',
    'FAIL P3b: a rejected document of a closed business has the wrong reason';
  assert (select details ->> 'reason' from public.audit_log
           where action = 'document.purged' and entity_id = 'd3990000-0000-4000-8000-0000000000c1') = 'closed_business_retention',
    'FAIL P3c: wrong reason for an approved document';
  assert not exists (select 1 from public.audit_log where details::text like '%.pdf%'),
    'FAIL P3d: a file name was written to the audit log';
  raise notice 'PASS P3: every deletion is logged with its reason and no file name';
end $$;

do $$ begin
  assert (select proof_document_id from public.milestones where id = 'c6990000-0000-4000-8000-0000000000e8') is null,
    'FAIL P4: a milestone still points at a deleted proof';
  raise notice 'PASS P4: a milestone whose proof was deleted simply has no proof';
end $$;

-- ===== Who may close a business =====
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c3990000-0000-4000-8000-000000000002', false) \gset
select set_config('request.jwt.claims', '{"sub":"c3990000-0000-4000-8000-000000000002","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b5', 'test')$q$) like '42501%',
    'FAIL C1a: a reviewer closed a business';
  raise notice 'PASS C1a: a reviewer cannot close a business';
end $$;

select set_config('request.jwt.claim.sub', 'c3990000-0000-4000-8000-000000000003', false) \gset
select set_config('request.jwt.claims', '{"sub":"c3990000-0000-4000-8000-000000000003","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b5', 'test')$q$) like '42501%',
    'FAIL C1b: a supporter closed a business';
  raise notice 'PASS C1b: a supporter cannot close a business';
end $$;

select set_config('request.jwt.claim.sub', 'c3990000-0000-4000-8000-000000000014', false) \gset
select set_config('request.jwt.claims', '{"sub":"c3990000-0000-4000-8000-000000000014","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b4', 'test')$q$) like '42501%',
    'FAIL C1c: a founder closed their own business';
  raise notice 'PASS C1c: a founder cannot close their own business through this function';
end $$;

select set_config('request.jwt.claim.sub', 'c3990000-0000-4000-8000-000000000001', false) \gset
select set_config('request.jwt.claims', '{"sub":"c3990000-0000-4000-8000-000000000001","aal":"aal1"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b5', 'test')$q$) like '42501%',
    'FAIL C1d: a password-only super admin closed a business';
  raise notice 'PASS C1d: closing needs the second factor too';
end $$;

-- ===== The rules about the request =====
select set_config('request.jwt.claims', '{"sub":"c3990000-0000-4000-8000-000000000001","aal":"aal2"}', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b5', null)$q$) like '22023%', 'FAIL C2a: null reason accepted';
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b5', '   ')$q$) like '22023%', 'FAIL C2b: blank reason accepted';
  assert pg_temp.fails(format($q$select public.close_business('c4990000-0000-4000-8000-0000000000b5', %L)$q$, repeat('x', 301))) like '22023%', 'FAIL C2c: over-long reason accepted';
  assert pg_temp.fails($q$select public.close_business('00000000-0000-4000-8000-000000000000', 'closed')$q$) like 'P0002%', 'FAIL C2d: unknown business accepted';
  raise notice 'PASS C2: a reason is required and the business must exist';
end $$;

-- ===== Money still held, on its way, or in an open checkout: refused =====
do $$ begin
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b1', 'closed')$q$) like '55006%',
    'FAIL C3a: closed with money held';
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b2', 'closed')$q$) like '55006%',
    'FAIL C3b: closed with a checkout still open';
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b3', 'closed')$q$) like '55006%',
    'FAIL C3c: closed with a payout on its way';
  assert (select count(*) from public.businesses
           where id in ('c4990000-0000-4000-8000-0000000000b1', 'c4990000-0000-4000-8000-0000000000b2',
                        'c4990000-0000-4000-8000-0000000000b3') and closed_at is not null) = 0,
    'FAIL C3d: a refused close still changed the business';
  raise notice 'PASS C3: a business with money held, a payout on its way or an open checkout cannot be closed';
end $$;

-- ===== Closing =====
do $$ begin
  perform public.close_business('c4990000-0000-4000-8000-0000000000b4', '  Owner stopped trading  ');
  assert (select closed_at is not null from public.businesses where id = 'c4990000-0000-4000-8000-0000000000b4'),
    'FAIL C4a: closed_at was not set';
  assert (select verification from public.businesses where id = 'c4990000-0000-4000-8000-0000000000b4') = 'suspended',
    'FAIL C4b: the business is still visible';
  assert (select count(*) from public.funding_goals
           where business_id = 'c4990000-0000-4000-8000-0000000000b4' and is_open) = 0,
    'FAIL C4c: a goal is still open';
  assert (select details ->> 'reason' from public.audit_log
           where action = 'business.closed' and entity_id = 'c4990000-0000-4000-8000-0000000000b4') = 'Owner stopped trading',
    'FAIL C4d: reason not logged';
  assert (select (details ->> 'goals_closed')::int from public.audit_log
           where action = 'business.closed' and entity_id = 'c4990000-0000-4000-8000-0000000000b4') = 2,
    'FAIL C4e: goals_closed is not 2';
  assert (select actor_id from public.audit_log
           where action = 'business.closed' and entity_id = 'c4990000-0000-4000-8000-0000000000b4') = 'c3990000-0000-4000-8000-000000000001',
    'FAIL C4f: actor not logged';
  raise notice 'PASS C4: closing hides the business, closes its goals and logs who and why';
end $$;

do $$ begin
  perform public.close_business('c4990000-0000-4000-8000-0000000000b5', 'No longer needed');
  assert (select (details ->> 'goals_closed')::int from public.audit_log
           where action = 'business.closed' and entity_id = 'c4990000-0000-4000-8000-0000000000b5') = 0,
    'FAIL C5: a business with no goals could not be closed cleanly';
  raise notice 'PASS C5: a business with no goals can be closed';
end $$;

do $$ begin
  assert pg_temp.fails($q$select public.close_business('c4990000-0000-4000-8000-0000000000b4', 'again')$q$) like '55000%',
    'FAIL C6: a closed business was closed twice';
  raise notice 'PASS C6: a business cannot be closed twice';
end $$;

-- ===== A closed business stays closed =====
update public.businesses set verification = 'verified', closed_at = null
 where id = 'c4990000-0000-4000-8000-0000000000b4';
do $$ begin
  assert (select verification from public.businesses where id = 'c4990000-0000-4000-8000-0000000000b4') = 'suspended',
    'FAIL C7a: a closed business became visible again';
  assert (select closed_at is not null from public.businesses where id = 'c4990000-0000-4000-8000-0000000000b4'),
    'FAIL C7b: the closing date was removed';
  assert pg_temp.fails($q$select public.unsuspend_business('c4990000-0000-4000-8000-0000000000b4')$q$) like '55000%',
    'FAIL C7c: a closed business was reinstated';
  raise notice 'PASS C7: nobody can reopen a closed business from the app';
end $$;

-- ===== Reinstating an ordinary suspension still works =====
do $$ begin
  perform public.suspend_business('c4990000-0000-4000-8000-0000000000b6', 'checking');
  perform public.unsuspend_business('c4990000-0000-4000-8000-0000000000b6');
  assert (select verification from public.businesses where id = 'c4990000-0000-4000-8000-0000000000b6') = 'pending',
    'FAIL C8: an ordinary suspension could not be lifted';
  raise notice 'PASS C8: a suspended (not closed) business can still be reinstated';
end $$;
