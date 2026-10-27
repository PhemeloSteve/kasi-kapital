-- Step 2 tests: business profiles, funding goals and the rules that stop founders cheating.
-- Run after the migrations and stub (see rls_smoke_test.sql for how). Uses its own users.
\set ON_ERROR_STOP on

-- Behave like Supabase: API roles get table access, and row level security decides the rest.
grant usage on schema public, auth to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function auth.uid() to anon, authenticated;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin execute stmt; return null;
exception when others then return sqlstate || ': ' || sqlerrm;
end $$;

-- Fixtures (as the project owner)
insert into auth.users (id, raw_user_meta_data) values
 ('11111111-0000-4000-8000-00000000000a', '{"role":"business","full_name":"Founder A","popia_consent":true}'),
 ('11111111-0000-4000-8000-00000000000b', '{"role":"business","full_name":"Founder B","popia_consent":true}'),
 ('11111111-0000-4000-8000-00000000000c', '{"role":"investor","full_name":"Investor C","popia_consent":true}'),
 ('11111111-0000-4000-8000-00000000000d', '{"role":"investor","full_name":"Future Admin D","popia_consent":true}');
update public.profiles set role = 'admin' where id = '11111111-0000-4000-8000-00000000000d';

-- ===== Founder A saves a profile =====
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000a', false);

do $$ declare v uuid; begin
  v := public.save_my_business('Mama T Bakery', 'bakery', 'Fresh bread daily', 'Soweto',
        -26.2678912, 27.8584321, null, 'https://www.facebook.com/mamat', null);
  assert v is not null, 'FAIL A1: no id returned';
  raise notice 'PASS A1: profile saved through save_my_business';
end $$;

-- Read the stored point as the project owner (the API roles deliberately get no PostGIS access here).
reset role;
do $$ declare x numeric; y numeric; begin
  select extensions.st_x(location::extensions.geometry), extensions.st_y(location::extensions.geometry)
    into x, y from public.businesses where name = 'Mama T Bakery';
  assert x = 27.86 and y = -26.27, format('FAIL A2: location not coarsened (%s, %s)', x, y);
  assert (select has_location from public.businesses where name = 'Mama T Bakery'), 'FAIL A2b: has_location flag not set';
  raise notice 'PASS A2: location stored only to ~1 km (27.86, -26.27), never the exact spot';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000a', false);

do $$ declare v uuid; n int; begin
  v := (select id from public.businesses where owner_id = auth.uid());
  -- saving again updates the same row and keeps the location when none is sent
  perform public.save_my_business('Mama T Bakery', 'bakery', 'Fresh bread and rolls', 'Soweto', null, null, null, null, null);
  select count(*) into n from public.businesses where owner_id = '11111111-0000-4000-8000-00000000000a';
  assert n = 1, 'FAIL A3: saving twice must not create a second business';
  assert (select location is not null from public.businesses where id = v), 'FAIL A3b: location lost on re-save';
  assert (select description from public.businesses where id = v) = 'Fresh bread and rolls', 'FAIL A3c: not updated';
  raise notice 'PASS A3: saving again updates the one business and keeps its location';
end $$;

-- ===== Founder A tries to cheat =====
do $$ begin
  assert pg_temp.fails($q$update public.businesses set verification = 'verified' where owner_id = auth.uid()$q$) like '42501%',
    'FAIL C1: founder verified themselves';
  assert pg_temp.fails($q$update public.businesses set trust_tier = 3 where owner_id = auth.uid()$q$) like '42501%',
    'FAIL C2: founder raised their own trust tier';
  assert pg_temp.fails($q$update public.businesses set owner_id = '11111111-0000-4000-8000-00000000000b' where owner_id = auth.uid()$q$) is not null,
    'FAIL C3: founder gave their business away';
  assert (select verification from public.businesses where owner_id = auth.uid()) = 'unverified', 'FAIL C4';
  raise notice 'PASS C1-C4: a founder cannot verify themselves, raise their trust tier or change owner';

  assert pg_temp.fails($q$insert into public.businesses (owner_id, name, category) values (auth.uid(), 'Second', 'bakery')$q$) like '23505%',
    'FAIL C5: second business allowed';
  assert pg_temp.fails($q$select public.save_my_business('X Farm', 'casino', null, 'Soweto', null, null, null, null, null)$q$) like '23514%',
    'FAIL C6: unknown category allowed';
  assert pg_temp.fails($q$select public.save_my_business('Mama T Bakery', 'bakery', null, 'Soweto', null, null, 'https://evil.example/yt', null, null)$q$) like '23514%',
    'FAIL C7: link to another site allowed as YouTube';
  assert pg_temp.fails($q$select public.save_my_business('Mama T Bakery', 'bakery', null, 'Soweto', null, null, null, 'javascript:alert(1)', null)$q$) like '23514%',
    'FAIL C8: javascript link allowed';
  assert pg_temp.fails($q$select public.save_my_business('Mama T Bakery', 'bakery', null, 'Soweto', 95, 10, null, null, null)$q$) is not null,
    'FAIL C9: impossible coordinates allowed';
  raise notice 'PASS C5-C9: one business per account; bad category, links and coordinates are rejected';
end $$;

-- ===== Founder A creates a goal =====
do $$ declare g uuid; n int; r text; begin
  g := public.create_funding_goal(
        (select id from public.businesses where owner_id = auth.uid()),
        'Buy a bigger oven', 'Double our output', 500000, 'donation',
        '[{"title":"Deposit","amount_cents":200000},{"title":"Installation","amount_cents":300000}]'::jsonb);
  assert g is not null, 'FAIL G1';
  select count(*) into n from public.milestones where goal_id = g and status = 'pending';
  assert n = 2, 'FAIL G2: milestones should all start pending';
  assert (select string_agg(title, ',' order by position) from public.milestones where goal_id = g) = 'Deposit,Installation',
    'FAIL G3: milestone order lost';
  raise notice 'PASS G1-G3: goal created with its milestones in order, all pending';

  r := pg_temp.fails($q$select public.create_funding_goal((select id from public.businesses where owner_id = auth.uid()), 'Bad sum', null, 500000, 'donation',
        '[{"title":"One","amount_cents":200000},{"title":"Two","amount_cents":200000}]'::jsonb)$q$);
  assert r is not null, 'FAIL G4: milestones that do not add up were accepted';
  r := pg_temp.fails($q$select public.create_funding_goal((select id from public.businesses where owner_id = auth.uid()), 'Equity goal', null, 500000, 'equity',
        '[{"title":"One","amount_cents":500000}]'::jsonb)$q$);
  assert r is not null, 'FAIL G5: equity goal accepted';
  r := pg_temp.fails($q$select public.create_funding_goal((select id from public.businesses where owner_id = auth.uid()), 'Seven steps', null, 700000, 'donation',
        '[{"title":"a1","amount_cents":100000},{"title":"a2","amount_cents":100000},{"title":"a3","amount_cents":100000},{"title":"a4","amount_cents":100000},
          {"title":"a5","amount_cents":100000},{"title":"a6","amount_cents":100000},{"title":"a7","amount_cents":100000}]'::jsonb)$q$);
  assert r is not null, 'FAIL G6: more than six milestones accepted';
  r := pg_temp.fails($q$select public.create_funding_goal((select id from public.businesses where owner_id = auth.uid()), 'Too small', null, 5000, 'donation',
        '[{"title":"Tiny","amount_cents":5000}]'::jsonb)$q$);
  assert r is not null, 'FAIL G7: goal under R100 accepted';
  assert (select count(*) from public.funding_goals where title in ('Bad sum','Equity goal','Seven steps','Too small')) = 0,
    'FAIL G8: a rejected goal left rows behind (not atomic)';
  raise notice 'PASS G4-G8: bad sums, equity, 7 milestones and tiny goals are rejected and leave nothing behind';
end $$;

-- ===== Founder A cannot approve their own milestones =====
do $$ declare m uuid; begin
  select id into m from public.milestones where title = 'Deposit';
  assert pg_temp.fails(format($q$update public.milestones set status = 'approved' where id = %L$q$, m)) like '42501%',
    'FAIL M1: founder approved own milestone';
  assert pg_temp.fails(format($q$update public.milestones set status = 'rejected' where id = %L$q$, m)) like '42501%',
    'FAIL M2: founder rejected own milestone';
  assert pg_temp.fails(format($q$update public.milestones set status = 'proof_submitted' where id = %L$q$, m)) like '23514%',
    'FAIL M3a: proof submitted without any document';
  insert into public.documents (id, business_id, type, storage_path)
    select '99999999-0000-4000-8000-000000000001', b.id, 'invoice', b.id || '/invoice1.pdf' from public.businesses b where b.owner_id = auth.uid();
  perform public.submit_milestone_proof(m, '99999999-0000-4000-8000-000000000001');
  assert (select status from public.milestones where id = m) = 'proof_submitted', 'FAIL M3';
  raise notice 'PASS M1-M3: founder can submit proof with an invoice but cannot approve or reject a milestone';

  insert into public.milestones (goal_id, title, amount_cents, status)
    values ((select goal_id from public.milestones where id = m), 'Sneaky', 1, 'approved');
  assert (select status from public.milestones where title = 'Sneaky') = 'pending', 'FAIL M4: inserted as approved';
  delete from public.milestones where title = 'Sneaky';
  raise notice 'PASS M4: a milestone inserted as "approved" is forced to pending';
end $$;

-- ===== Founder B and the investor cannot touch Founder A's business =====
select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000b', false);
do $$ declare a_business uuid; begin
  -- B inserts a business directly while claiming to be verified
  insert into public.businesses (owner_id, name, category, verification, trust_tier)
    values (auth.uid(), 'B Chicken Farm', 'chicken_farm', 'verified', 3);
  assert (select verification from public.businesses where owner_id = auth.uid()) = 'unverified'
     and (select trust_tier from public.businesses where owner_id = auth.uid()) = 0,
    'FAIL X1: direct insert kept verified status';
  raise notice 'PASS X1: a business inserted as "verified" is forced to unverified, tier 0';

  select id into a_business from public.businesses where name = 'Mama T Bakery';
  assert a_business is null, 'FAIL X2: B can see A''s unverified business';
  raise notice 'PASS X2: another founder cannot even see an unverified business';
end $$;

do $$ begin
  assert pg_temp.fails($q$select public.create_funding_goal('00000000-0000-0000-0000-000000000000', 'Not mine', null, 100000, 'donation',
        '[{"title":"One","amount_cents":100000}]'::jsonb)$q$) is not null, 'FAIL X3';
  raise notice 'PASS X3: cannot create a goal for a business that is not yours';
end $$;

select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000c', false);
do $$ begin
  assert pg_temp.fails($q$select public.save_my_business('Investor Biz', 'bakery', null, 'Soweto', null, null, null, null, null)$q$) like '42501%',
    'FAIL X4: an investor created a business profile';
  raise notice 'PASS X4: only business accounts can create a business profile';
  assert (select count(*) from public.businesses where name in ('Mama T Bakery', 'B Chicken Farm')) = 0
     and (select count(*) from public.funding_goals where title like 'Buy a bigger oven%') = 0,
    'FAIL X5: investor sees unverified businesses or their goals';
  raise notice 'PASS X5: investors see nothing from unverified businesses';
end $$;

reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert pg_temp.fails($q$select public.save_my_business('Anon Biz', 'bakery', null, 'Soweto', null, null, null, null, null)$q$) like '42501%',
    'FAIL X6: anonymous visitor can call save_my_business';
  raise notice 'PASS X6: anonymous visitors cannot call the save function';
end $$;

-- ===== Admin verifies Founder A's business and approves the milestone =====
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000d', false);
do $$ declare m uuid; begin
  update public.businesses set verification = 'verified', trust_tier = 1 where name = 'Mama T Bakery';
  assert (select verification from public.businesses where name = 'Mama T Bakery') = 'verified', 'FAIL V1';
  select id into m from public.milestones where title = 'Deposit';
  update public.milestones set status = 'approved' where id = m;
  assert (select status from public.milestones where id = m) = 'approved', 'FAIL V2';
  raise notice 'PASS V1-V2: an administrator can verify a business and approve a milestone';
end $$;

-- Now the public can see the verified business and its goal
select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000c', false);
do $$ begin
  assert (select count(*) from public.businesses where name = 'Mama T Bakery') = 1
     and (select count(*) from public.funding_goals where title = 'Buy a bigger oven') = 1,
    'FAIL V3: verified business or goal not visible to investors';
  raise notice 'PASS V3: once verified, investors can see the business and its goal';
end $$;

-- Founder A: approved milestones are frozen
select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000a', false);
do $$ begin
  assert pg_temp.fails($q$update public.milestones set amount_cents = 1 where title = 'Deposit'$q$) like '42501%',
    'FAIL V4: approved milestone edited';
  assert pg_temp.fails($q$delete from public.milestones where title = 'Deposit'$q$) like '42501%', 'FAIL V5: approved milestone deleted';
  raise notice 'PASS V4-V5: an approved milestone can no longer be edited or deleted';
end $$;

-- ===== A goal that has received money is locked =====
reset role;
insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status)
  select id, '11111111-0000-4000-8000-00000000000c', 1000, 'donation', 'held' from public.funding_goals where title = 'Buy a bigger oven';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000a', false);
do $$ declare g uuid; g2 uuid; begin
  assert pg_temp.fails($q$update public.funding_goals set target_cents = 1000000 where title = 'Buy a bigger oven'$q$) like '42501%', 'FAIL L1: funded target changed';
  assert pg_temp.fails($q$delete from public.funding_goals where title = 'Buy a bigger oven'$q$) like '42501%', 'FAIL L2: funded goal deleted';
  assert pg_temp.fails($q$update public.milestones set amount_cents = 250000 where title = 'Installation'$q$) like '42501%', 'FAIL L3: funded milestone amount changed';
  assert pg_temp.fails($q$insert into public.milestones (goal_id, title, amount_cents) select id, 'Extra', 5 from public.funding_goals where title = 'Buy a bigger oven'$q$) like '42501%', 'FAIL L4: milestone added to funded goal';
  raise notice 'PASS L1-L4: a funded goal cannot be changed, deleted or given new milestones';

  -- the title is still editable, and an unfunded goal is fully editable
  update public.funding_goals set title = 'Buy a bigger oven (updated)' where title = 'Buy a bigger oven';
  g2 := public.create_funding_goal((select id from public.businesses where owner_id = auth.uid()), 'Second goal', null, 100000, 'presale',
        '[{"title":"All of it","amount_cents":100000}]'::jsonb);
  update public.funding_goals set target_cents = 100000 where id = g2;
  delete from public.funding_goals where id = g2;
  raise notice 'PASS L5: unfunded goals stay editable and deletable by their owner';
end $$;
