-- Step 10 tests: rejected documents are deleted after the retention period, and only those.
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
 ('ee990000-0000-4000-8000-000000000001', 'founder@example.com',
  '{"role":"business","full_name":"Founder","popia_consent":true}');
insert into public.businesses (id, owner_id, name, category, verification) values
 ('ee990000-0000-4000-8000-0000000000b1', 'ee990000-0000-4000-8000-000000000001',
  'Retention Bakery', 'bakery', 'verified');

-- d1, d6, d7: rejected longer ago than 30 days (due).  d2: rejected 29 days ago.  d3: still pending.
-- d4: approved long ago.  d5: rejected but never reviewed (no date).  d8: due, but approved before the purge ends.
insert into public.documents (id, business_id, type, storage_path, status, reviewed_at) values
 ('dd990000-0000-4000-8000-0000000000d1', 'ee990000-0000-4000-8000-0000000000b1', 'tax_return',
  'ee990000-0000-4000-8000-0000000000b1/d1.pdf', 'rejected', now() - interval '31 days'),
 ('dd990000-0000-4000-8000-0000000000d2', 'ee990000-0000-4000-8000-0000000000b1', 'tax_return',
  'ee990000-0000-4000-8000-0000000000b1/d2.pdf', 'rejected', now() - interval '29 days'),
 ('dd990000-0000-4000-8000-0000000000d3', 'ee990000-0000-4000-8000-0000000000b1', 'tax_return',
  'ee990000-0000-4000-8000-0000000000b1/d3.pdf', 'pending', null),
 ('dd990000-0000-4000-8000-0000000000d4', 'ee990000-0000-4000-8000-0000000000b1', 'bank_statement',
  'ee990000-0000-4000-8000-0000000000b1/d4.pdf', 'verified', now() - interval '400 days'),
 ('dd990000-0000-4000-8000-0000000000d5', 'ee990000-0000-4000-8000-0000000000b1', 'other',
  'ee990000-0000-4000-8000-0000000000b1/d5.pdf', 'rejected', null),
 ('dd990000-0000-4000-8000-0000000000d6', 'ee990000-0000-4000-8000-0000000000b1', 'invoice',
  'ee990000-0000-4000-8000-0000000000b1/d6.pdf', 'rejected', now() - interval '60 days'),
 ('dd990000-0000-4000-8000-0000000000d7', 'ee990000-0000-4000-8000-0000000000b1', 'id',
  'ee990000-0000-4000-8000-0000000000b1/d7.pdf', 'rejected', now() - interval '100 days'),
 ('dd990000-0000-4000-8000-0000000000d8', 'ee990000-0000-4000-8000-0000000000b1', 'other',
  'ee990000-0000-4000-8000-0000000000b1/d8.pdf', 'rejected', now() - interval '40 days');

-- d6 is the rejected proof a milestone still points at.
insert into public.funding_goals (id, business_id, title, target_cents, kind, is_open) values
 ('cc990000-0000-4000-8000-0000000000a1', 'ee990000-0000-4000-8000-0000000000b1', 'Goal', 5000000, 'donation', true);
insert into public.milestones (id, goal_id, title, amount_cents, status, proof_document_id) values
 ('ff990000-0000-4000-8000-0000000000c1', 'cc990000-0000-4000-8000-0000000000a1', 'Buy the oven', 120000,
  'rejected', 'dd990000-0000-4000-8000-0000000000d6');

-- ===== Which documents are due =====
set role service_role;
do $$
declare ids uuid[];
begin
  select array_agg(id order by id) into ids from public.documents_due_for_purge(200);
  assert ids = array[
      'dd990000-0000-4000-8000-0000000000d1', 'dd990000-0000-4000-8000-0000000000d6',
      'dd990000-0000-4000-8000-0000000000d7', 'dd990000-0000-4000-8000-0000000000d8']::uuid[],
    format('FAIL R1: due documents were %s', ids);
  raise notice 'PASS R1: only rejected documents past the retention period are due (not recent, pending, approved or undated ones)';
end $$;

do $$ begin
  assert (select id from public.documents_due_for_purge(1)) = 'dd990000-0000-4000-8000-0000000000d7',
    'FAIL R2: the limit did not return the oldest first';
  assert (select count(*) from public.documents_due_for_purge(0)) = 1,
    'FAIL R2b: a limit of zero should still return one at most';
  assert (select doc_type from public.documents_due_for_purge(1)) = 'id',
    'FAIL R2c: the document type is not reported';
  raise notice 'PASS R2: the oldest are listed first, the limit is respected, and the type is reported';
end $$;

reset role;
update public.platform_settings set int_value = 10 where key = 'retention_rejected_document_days';
set role service_role;
do $$ begin
  assert (select count(*) from public.documents_due_for_purge(200)) = 5,
    'FAIL R3: a shorter retention period did not make d2 due as well';
  raise notice 'PASS R3: the retention period is a setting';
end $$;
reset role;
update public.platform_settings set int_value = 30 where key = 'retention_rejected_document_days';

-- ===== Permissions =====
set role authenticated;
do $$ begin
  assert pg_temp.fails($q$select * from public.documents_due_for_purge(10)$q$) like '42501%', 'FAIL P1: a signed-in user can list due documents';
  assert pg_temp.fails($q$select public.finish_document_purge(array['dd990000-0000-4000-8000-0000000000d1']::uuid[])$q$) like '42501%', 'FAIL P1b: a signed-in user can delete documents';
  raise notice 'PASS P1: signed-in users cannot call the retention functions';
end $$;
reset role;
set role anon;
do $$ begin
  assert pg_temp.fails($q$select * from public.documents_due_for_purge(10)$q$) like '42501%', 'FAIL P2: a visitor can list due documents';
  assert pg_temp.fails($q$select public.finish_document_purge(array['dd990000-0000-4000-8000-0000000000d1']::uuid[])$q$) like '42501%', 'FAIL P2b: a visitor can delete documents';
  raise notice 'PASS P2: signed-out visitors cannot call the retention functions';
end $$;
reset role;

-- ===== Deleting the records =====
-- d8 is approved after it was listed but before the purge finishes; d3 and d4 were never due.
update public.documents set status = 'verified' where id = 'dd990000-0000-4000-8000-0000000000d8';

set role service_role;
do $$ declare n integer;
begin
  n := public.finish_document_purge(array[
    'dd990000-0000-4000-8000-0000000000d1', 'dd990000-0000-4000-8000-0000000000d6',
    'dd990000-0000-4000-8000-0000000000d7', 'dd990000-0000-4000-8000-0000000000d8',
    'dd990000-0000-4000-8000-0000000000d3', 'dd990000-0000-4000-8000-0000000000d4',
    'dd990000-0000-4000-8000-0000000000d2']::uuid[]);
  assert n = 3, format('FAIL D1: %s records were deleted, expected 3 (d1, d6, d7)', n);
  raise notice 'PASS D1: only the expired rejected documents were deleted, whatever ids were passed in';
end $$;
reset role;

do $$ begin
  assert (select count(*) from public.documents where id in (
      'dd990000-0000-4000-8000-0000000000d1', 'dd990000-0000-4000-8000-0000000000d6',
      'dd990000-0000-4000-8000-0000000000d7')) = 0, 'FAIL D2: expired records are still there';
  assert (select count(*) from public.documents where id in (
      'dd990000-0000-4000-8000-0000000000d2', 'dd990000-0000-4000-8000-0000000000d3',
      'dd990000-0000-4000-8000-0000000000d4', 'dd990000-0000-4000-8000-0000000000d5',
      'dd990000-0000-4000-8000-0000000000d8')) = 5, 'FAIL D2b: a record that was not due was deleted';
  raise notice 'PASS D2: recent, pending, approved, undated and just-approved documents are kept';
end $$;

do $$ begin
  assert (select proof_document_id from public.milestones where id = 'ff990000-0000-4000-8000-0000000000c1') is null,
    'FAIL D3: the milestone still points at the deleted proof';
  assert (select status from public.milestones where id = 'ff990000-0000-4000-8000-0000000000c1') = 'rejected',
    'FAIL D3b: the milestone changed status';
  raise notice 'PASS D3: a milestone that pointed at a deleted rejected proof just loses the reference';
end $$;

do $$ begin
  assert (select count(*) from public.audit_log where action = 'document.purged') = 3,
    'FAIL A1: each deletion should be in the audit log exactly once';
  assert (select count(*) from public.audit_log where action = 'document.purged'
           and entity = 'documents' and details ->> 'reason' = 'rejected_retention'
           and actor_id is null) = 3, 'FAIL A2: purge entries are missing the reason or have an actor';
  assert (select count(*) from public.audit_log where action = 'document.purged'
           and (details::text like '%/%' or details::text like '%.pdf%')) = 0,
    'FAIL A3: the audit entry contains a file path';
  raise notice 'PASS A1-A3: every deletion is logged once, with the reason and type but no file path or personal data';
end $$;

set role service_role;
do $$ begin
  assert public.finish_document_purge(array['dd990000-0000-4000-8000-0000000000d1']::uuid[]) = 0,
    'FAIL I1: deleting the same document again should delete nothing';
  assert public.finish_document_purge(null) = 0, 'FAIL I1b: a null list should delete nothing';
  assert public.finish_document_purge(array[]::uuid[]) = 0, 'FAIL I1c: an empty list should delete nothing';
  raise notice 'PASS I1: running it again, or with nothing to do, is harmless';
end $$;
reset role;
