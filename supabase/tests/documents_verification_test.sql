-- Step 3 tests: documents, submitting for review, administrator decisions, audit log and storage rules.
\set ON_ERROR_STOP on

grant usage on schema public, auth to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function auth.uid() to anon, authenticated;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin execute stmt; return null;
exception when others then return sqlstate || ': ' || sqlerrm;
end $$;

insert into auth.users (id, raw_user_meta_data) values
 ('22222222-0000-4000-8000-00000000000a', '{"role":"business","full_name":"Founder A","popia_consent":true}'),
 ('22222222-0000-4000-8000-00000000000b', '{"role":"business","full_name":"Founder B","popia_consent":true}'),
 ('22222222-0000-4000-8000-00000000000c', '{"role":"investor","full_name":"Investor C","popia_consent":true}'),
 ('22222222-0000-4000-8000-00000000000d', '{"role":"investor","full_name":"Future Admin D","popia_consent":true}');
update public.profiles set role = 'admin' where id = '22222222-0000-4000-8000-00000000000d';

-- Two founders each create a business
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000a', false) \gset
select public.save_my_business('Alpha Bakery', 'bakery', null, 'Soweto', null, null, null, null, null) \gset
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000b', false) \gset
select public.save_my_business('Beta Farm', 'chicken_farm', null, 'Mamelodi', null, null, null, null, null) \gset
reset role;
select set_config('kk.a', (select id::text from public.businesses where name = 'Alpha Bakery'), false) \gset
select set_config('kk.b', (select id::text from public.businesses where name = 'Beta Farm'), false) \gset

-- ===== Founder A: uploading documents =====
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000a', false) \gset

do $$ declare a text := current_setting('kk.a'); b text := current_setting('kk.b'); begin
  insert into public.documents (business_id, type, storage_path, status, reviewed_by, review_note)
    values (a::uuid, 'id', a || '/id1.pdf', 'verified', auth.uid(), 'sneaky');
  assert (select status from public.documents where storage_path = a || '/id1.pdf') = 'pending'
     and (select review_note from public.documents where storage_path = a || '/id1.pdf') is null
     and (select reviewed_by from public.documents where storage_path = a || '/id1.pdf') is null,
    'FAIL D1: founder created an already-approved document';
  raise notice 'PASS D1: a document inserted as "verified" is forced to pending, with no review fields';

  assert pg_temp.fails(format($q$insert into public.documents (business_id, type, storage_path) values (%L, 'id', %L)$q$, a, b || '/x.pdf')) like '23514%',
    'FAIL D2: path in another business folder accepted';
  assert pg_temp.fails(format($q$insert into public.documents (business_id, type, storage_path) values (%L, 'id', %L)$q$, a, a || '/../' || b || '/x.pdf')) like '23514%',
    'FAIL D2b: path with .. accepted';
  assert pg_temp.fails(format($q$insert into public.documents (business_id, type, storage_path) values (%L, 'id', %L)$q$, b, b || '/x.pdf')) like '42501%',
    'FAIL D2c: founder added a document to someone else''s business';
  raise notice 'PASS D2: files must sit in the business''s own folder (no other folder, no ..), and only on your own business';

  assert (select count(*) from public.documents) = 1, 'FAIL D4a: founder A should see only their own document';
  raise notice 'PASS D4a: founder sees their own documents';
end $$;

-- ===== Submitting for review needs the required documents =====
do $$ declare a text := current_setting('kk.a'); begin
  assert pg_temp.fails($q$update public.businesses set verification = 'pending' where owner_id = auth.uid()$q$) like '23514%',
    'FAIL D5: submitted with only an ID document';
  assert pg_temp.fails($q$update public.businesses set verification = 'verified' where owner_id = auth.uid()$q$) like '42501%',
    'FAIL D5b: founder verified themselves';
  assert pg_temp.fails($q$update public.businesses set trust_tier = 3 where owner_id = auth.uid()$q$) like '42501%',
    'FAIL D5c: founder raised their own trust tier';
  raise notice 'PASS D5: cannot submit without ID + bank statement, and cannot verify or promote yourself';

  insert into public.documents (business_id, type, storage_path) values (a::uuid, 'bank_statement', a || '/bank1.pdf');
  update public.businesses set verification = 'pending' where owner_id = auth.uid();
  assert (select verification from public.businesses where owner_id = auth.uid()) = 'pending', 'FAIL D6';
  raise notice 'PASS D6: with ID and bank statement uploaded, the business can be submitted for review';

  assert pg_temp.fails($q$update public.businesses set verification = 'unverified' where owner_id = auth.uid()$q$) like '42501%',
    'FAIL D7: founder withdrew back to unverified';
  assert pg_temp.fails($q$update public.businesses set verification = 'verified' where owner_id = auth.uid()$q$) like '42501%',
    'FAIL D7b: founder jumped from pending to verified';
  raise notice 'PASS D7: once submitted, only an administrator can move the status on';
end $$;

-- ===== Nobody but an administrator can review =====
do $$ declare doc uuid := (select id from public.documents where type = 'id'); begin
  assert pg_temp.fails(format('select public.review_document(%L, true, null)', doc)) like '42501%', 'FAIL D8: founder reviewed a document';
  raise notice 'PASS D8a: a founder cannot approve their own document';
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000c', false) \gset
do $$ declare doc uuid; begin
  assert pg_temp.fails(format('select public.review_document(%L, true, null)', '00000000-0000-0000-0000-000000000000')) like '42501%', 'FAIL D8b';
  assert pg_temp.fails($q$insert into public.documents (business_id, type, storage_path) values (current_setting('kk.a')::uuid, 'id', current_setting('kk.a') || '/inv.pdf')$q$) like '42501%',
    'FAIL D3: an investor added a document to a business';
  assert (select count(*) from public.documents) = 0, 'FAIL D4b: investor can read documents';
  raise notice 'PASS D8b/D3/D4b: investors cannot review, upload to a business, or read any documents';
end $$;

-- ===== Another founder cannot see A's documents =====
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000b', false) \gset
do $$ begin
  assert (select count(*) from public.documents) = 0, 'FAIL D4c: founder B can read founder A documents';
  raise notice 'PASS D4c: a founder cannot read another founder''s documents';
end $$;

-- ===== Administrator reviews A =====
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000d', false) \gset
do $$ declare id_doc uuid := (select id from public.documents where type = 'id');
                bank_doc uuid := (select id from public.documents where type = 'bank_statement'); r jsonb; begin
  r := public.review_document(id_doc, true, null);
  assert r ->> 'business_status' = 'pending' and (r ->> 'trust_tier')::int = 1, format('FAIL D9a: %s', r);
  r := public.review_document(bank_doc, true, 'Looks good');
  assert r ->> 'business_status' = 'verified' and (r ->> 'trust_tier')::int = 2, format('FAIL D9b: %s', r);
  assert (select verification from public.businesses where name = 'Alpha Bakery') = 'verified', 'FAIL D9c';
  raise notice 'PASS D9: approving the ID gives tier 1 (still pending); adding the bank statement gives tier 2 and verifies the business';

  assert pg_temp.fails(format('select public.review_document(%L, false, ''changed my mind'')', id_doc)) like 'P0001%', 'FAIL D10: reviewed twice';
  raise notice 'PASS D10: a document cannot be reviewed twice';
end $$;

select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000c', false) \gset
do $$ begin
  assert (select count(*) from public.businesses where name = 'Alpha Bakery') = 1, 'FAIL D9d: verified business not visible to investors';
  raise notice 'PASS D9d: once verified, the business becomes visible to investors';
end $$;

-- ===== A adds a CIPC document later: rejected with a reason, then accepted =====
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000a', false) \gset
do $$ declare a text := current_setting('kk.a'); begin
  insert into public.documents (business_id, type, storage_path) values (a::uuid, 'cipc', a || '/cipc1.pdf');
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000d', false) \gset
do $$ declare cipc uuid := (select id from public.documents where storage_path like '%/cipc1.pdf'); r jsonb; begin
  assert pg_temp.fails(format('select public.review_document(%L, false, null)', cipc)) like '22023%', 'FAIL D11: rejected without a reason';
  assert pg_temp.fails(format('select public.review_document(%L, false, ''   '')', cipc)) like '22023%', 'FAIL D11b: blank reason accepted';
  r := public.review_document(cipc, false, 'The scan is cut off at the bottom');
  assert r ->> 'business_status' = 'verified' and (r ->> 'trust_tier')::int = 2, format('FAIL D11c: %s', r);
  raise notice 'PASS D11: a rejection needs a reason, and rejecting an optional document does not unverify a business';
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000a', false) \gset
do $$ declare a text := current_setting('kk.a'); begin
  assert (select review_note from public.documents where storage_path like '%/cipc1.pdf') = 'The scan is cut off at the bottom', 'FAIL D11d: founder cannot read the reason';
  insert into public.documents (business_id, type, storage_path) values (a::uuid, 'cipc', a || '/cipc2.pdf');
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000d', false) \gset
do $$ declare r jsonb; begin
  r := public.review_document((select id from public.documents where storage_path like '%/cipc2.pdf'), true, null);
  assert (r ->> 'trust_tier')::int = 3, format('FAIL D12: %s', r);
  raise notice 'PASS D12: with ID, bank statement and CIPC approved, the trust tier is 3';
end $$;

-- ===== Founder B: reviewing before submission is refused; rejection and resubmission =====
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000b', false) \gset
do $$ declare b text := current_setting('kk.b'); begin
  insert into public.documents (business_id, type, storage_path) values (b::uuid, 'id', b || '/id.png'), (b::uuid, 'bank_statement', b || '/bank_old.pdf');
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000d', false) \gset
do $$ begin
  assert pg_temp.fails(format('select public.review_document(%L, true, null)', (select id from public.documents where storage_path like '%/id.png'))) like 'P0001%',
    'FAIL D13: reviewed a business that was never submitted';
  raise notice 'PASS D13: documents of a business that has not been submitted cannot be reviewed';
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000b', false) \gset
update public.businesses set verification = 'pending' where owner_id = auth.uid();
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000d', false) \gset
do $$ declare r jsonb; begin
  perform public.review_document((select id from public.documents where storage_path like '%/id.png'), true, null);
  r := public.review_document((select id from public.documents where storage_path like '%/bank_old.pdf'), false, 'Statement is more than 3 months old');
  assert r ->> 'business_status' = 'rejected' and (r ->> 'trust_tier')::int = 1, format('FAIL D14a: %s', r);
  raise notice 'PASS D14a: when the last required document is rejected the business is marked rejected';
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000b', false) \gset
do $$ declare b text := current_setting('kk.b'); begin
  assert pg_temp.fails($q$update public.businesses set verification = 'pending' where owner_id = auth.uid()$q$) like '23514%',
    'FAIL D14x: resubmitted without replacing the rejected bank statement';
  insert into public.documents (business_id, type, storage_path) values (b::uuid, 'bank_statement', b || '/bank_new.pdf');
  update public.businesses set verification = 'pending' where owner_id = auth.uid();
  assert (select verification from public.businesses where owner_id = auth.uid()) = 'pending', 'FAIL D14b: could not resubmit';
  raise notice 'PASS D14b: after a rejection the founder can upload a replacement and resubmit';
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000d', false) \gset
do $$ declare r jsonb; begin
  r := public.review_document((select id from public.documents where storage_path like '%/bank_new.pdf'), true, null);
  assert r ->> 'business_status' = 'verified' and (r ->> 'trust_tier')::int = 2, format('FAIL D14c: %s', r);
  raise notice 'PASS D14c: the resubmitted business is verified after approval';
end $$;

-- ===== Limits and deletion =====
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000a', false) \gset
do $$ declare a text := current_setting('kk.a'); n int; i int; begin
  select count(*) into n from public.documents;
  for i in 1 .. (50 - n) loop
    insert into public.documents (business_id, type, storage_path) values (a::uuid, 'tax_return', a || '/tax' || i || '.pdf');
  end loop;
  assert pg_temp.fails(format($q$insert into public.documents (business_id, type, storage_path) values (%L, 'tax_return', %L)$q$, a, a || '/one-too-many.pdf')) like '54000%',
    'FAIL D15: more than 50 documents accepted';
  raise notice 'PASS D15: a business cannot pile up more than 50 documents';

  delete from public.documents where storage_path like '%/tax1.pdf';
  get diagnostics n = row_count;
  assert n = 1, 'FAIL D16a: could not delete a pending document';
  delete from public.documents where storage_path like '%/cipc1.pdf';
  get diagnostics n = row_count;
  assert n = 1, 'FAIL D16b: could not delete a rejected document';
  delete from public.documents where storage_path like '%/id1.pdf';
  get diagnostics n = row_count;
  assert n = 0 and exists (select 1 from public.documents where storage_path like '%/id1.pdf'), 'FAIL D16c: an approved document was deleted';
  raise notice 'PASS D16: founders can delete pending and rejected documents, never approved ones';
end $$;

-- ===== Storage rules =====
do $$ declare a text := current_setting('kk.a'); b text := current_setting('kk.b'); n int; begin
  insert into storage.objects (bucket_id, name) values ('identity-documents', a || '/id1.pdf'), ('business-documents', a || '/bank1.pdf'), ('business-documents', a || '/tax2.pdf');
  raise notice 'PASS S1: a founder can upload into their own business folder';

  assert pg_temp.fails(format($q$insert into storage.objects (bucket_id, name) values ('business-documents', %L)$q$, b || '/steal.pdf')) like '42501%', 'FAIL S2: wrote into another business folder';
  assert pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('some-public-bucket', current_setting('kk.a') || '/x.pdf')$q$) like '42501%', 'FAIL S3: wrote to another bucket';
  assert pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('business-documents', 'loose-file.pdf')$q$) like '42501%', 'FAIL S3b: wrote outside any folder';
  raise notice 'PASS S2-S3: uploads outside your own business folder, outside the two buckets, or outside any folder are refused';

  update storage.objects set name = b || '/moved.pdf' where name = a || '/tax2.pdf';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL S4: a file was renamed or overwritten';
  raise notice 'PASS S4: files cannot be renamed, moved or overwritten';

  delete from storage.objects where name = a || '/id1.pdf';
  get diagnostics n = row_count;
  assert n = 0 and exists (select 1 from storage.objects where name = a || '/id1.pdf'), 'FAIL S5: deleted the file behind an approved document';
  delete from storage.objects where name = a || '/tax2.pdf';
  get diagnostics n = row_count;
  assert n = 1, 'FAIL S5b: could not delete a file that is not approved';
  raise notice 'PASS S5: the file behind an approved document is protected; other files can be deleted';
end $$;

select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000b', false) \gset
do $$ begin
  assert (select count(*) from storage.objects) = 0, 'FAIL S6: founder B can see founder A files';
  raise notice 'PASS S6: a founder cannot see another business''s files';
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000c', false) \gset
do $$ begin
  assert (select count(*) from storage.objects) = 0, 'FAIL S7: investor can see files';
  assert pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('business-documents', current_setting('kk.a') || '/inv.pdf')$q$) like '42501%', 'FAIL S7b';
  raise notice 'PASS S7: investors can neither see nor add files';
end $$;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000d', false) \gset
do $$ begin
  assert (select count(*) from storage.objects) = 2, 'FAIL S8: admin should see both of A''s remaining files';
  raise notice 'PASS S8: an administrator can read the uploaded files';
end $$;

-- ===== Audit log =====
select public.log_document_view((select id from public.documents where type = 'id' and storage_path like '%/id1.pdf')) \gset
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000a', false) \gset
select public.log_document_view((select id from public.documents where type = 'id' and storage_path like '%/id1.pdf')) \gset
reset role;
do $$ begin
  assert (select count(*) from public.audit_log where action = 'document.approved') >= 5, 'FAIL L1: approvals not logged';
  assert (select count(*) from public.audit_log where action = 'document.rejected') = 2, 'FAIL L2: rejections not logged';
  assert (select count(*) from public.audit_log where action = 'business.verification_changed') >= 5, 'FAIL L3: status changes not logged';
  assert (select count(*) from public.audit_log where action = 'document.viewed') = 1, 'FAIL L4: expected exactly one logged view (the administrator''s)';
  assert (select count(*) from public.audit_log where actor_id is null and action like 'document.%') = 0, 'FAIL L5: a decision was logged without an actor';
  raise notice 'PASS L1-L5: approvals, rejections, status changes and administrator views are all in the audit log';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-0000-4000-8000-00000000000a', false) \gset
do $$ begin
  assert (select count(*) from public.audit_log) = 0, 'FAIL L6: a founder can read the audit log';
  raise notice 'PASS L6: founders cannot read the audit log';
end $$;
