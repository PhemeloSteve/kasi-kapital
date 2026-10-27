-- Step 5 tests: contributions, escrow, milestone proof, payouts and the ways someone might cheat.
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
 ('55555555-0000-4000-8000-000000000001', '{"role":"business","full_name":"Founder F","popia_consent":true}'),
 ('55555555-0000-4000-8000-000000000002', '{"role":"business","full_name":"Founder X","popia_consent":true}'),
 ('55555555-0000-4000-8000-000000000003', '{"role":"business","full_name":"Founder Y","popia_consent":true}'),
 ('55555555-0000-4000-8000-000000000011', '{"role":"investor","full_name":"Investor 1","popia_consent":true}'),
 ('55555555-0000-4000-8000-000000000012', '{"role":"investor","full_name":"Investor 2","popia_consent":true}'),
 ('55555555-0000-4000-8000-000000000013', '{"role":"donor","full_name":"Donor 1","popia_consent":true}'),
 ('55555555-0000-4000-8000-000000000014', '{"role":"investor","full_name":"Investor 3","popia_consent":true}'),
 ('55555555-0000-4000-8000-0000000000ad', '{"role":"investor","full_name":"Admin","popia_consent":true}');
update public.profiles set role = 'admin' where id = '55555555-0000-4000-8000-0000000000ad';
update public.profiles set kyc_status = 'verified' where id in ('55555555-0000-4000-8000-000000000012', '55555555-0000-4000-8000-000000000013');

insert into public.businesses (id, owner_id, name, category, verification, trust_tier) values
 ('66666666-0000-4000-8000-0000000000b1', '55555555-0000-4000-8000-000000000001', 'Funded Bakery', 'bakery', 'verified', 2),
 ('66666666-0000-4000-8000-0000000000b2', '55555555-0000-4000-8000-000000000002', 'Other Farm', 'chicken_farm', 'verified', 2),
 ('66666666-0000-4000-8000-0000000000b3', '55555555-0000-4000-8000-000000000003', 'Pending Shop', 'tuck_shop', 'pending', 1);
insert into public.funding_goals (id, business_id, title, target_cents, kind, is_open) values
 ('66666666-0000-4000-8000-0000000000a1', '66666666-0000-4000-8000-0000000000b1', 'Bigger oven', 500000, 'donation', true),
 ('66666666-0000-4000-8000-0000000000a2', '66666666-0000-4000-8000-0000000000b1', 'Closed goal', 100000, 'donation', false),
 ('66666666-0000-4000-8000-0000000000a3', '66666666-0000-4000-8000-0000000000b3', 'Goal of an unverified business', 100000, 'donation', true),
 ('66666666-0000-4000-8000-0000000000a4', '66666666-0000-4000-8000-0000000000b2', 'Big goal elsewhere', 1000000, 'presale', true);
insert into public.milestones (id, goal_id, title, amount_cents, position) values
 ('66666666-0000-4000-8000-0000000000c1', '66666666-0000-4000-8000-0000000000a1', 'Deposit', 300000, 1),
 ('66666666-0000-4000-8000-0000000000c2', '66666666-0000-4000-8000-0000000000a1', 'Installation', 200000, 2);
-- an invoice belonging to the OTHER business, for the "wrong business" attempt
insert into public.documents (id, business_id, type, storage_path, status) values
 ('77777777-0000-4000-8000-0000000000f9', '66666666-0000-4000-8000-0000000000b2', 'invoice', '66666666-0000-4000-8000-0000000000b2/other.pdf', 'pending');

select set_config('kk.goal',  '66666666-0000-4000-8000-0000000000a1', false) \gset
select set_config('kk.closed','66666666-0000-4000-8000-0000000000a2', false) \gset
select set_config('kk.unver', '66666666-0000-4000-8000-0000000000a3', false) \gset
select set_config('kk.xgoal', '66666666-0000-4000-8000-0000000000a4', false) \gset

-- ===== Supporter 1 (identity not verified) starts contributions =====
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000011', false) \gset

do $$ declare g uuid := current_setting('kk.goal')::uuid; c uuid; begin
  c := public.start_contribution(g, 20000);
  assert (select status from public.contributions where id = c) = 'pending'
     and (select kind from public.contributions where id = c) = 'donation', 'FAIL C1: contribution not created as pending';
  raise notice 'PASS C1: starting a contribution creates a pending one of the goal''s kind (nothing is held yet)';

  assert pg_temp.fails(format('select public.start_contribution(%L, 999)', g)) like 'KK004%', 'FAIL C2a: below the minimum accepted';
  assert pg_temp.fails(format('select public.start_contribution(%L, 100000001)', g)) like 'KK004%', 'FAIL C2b: above the maximum accepted';
  assert pg_temp.fails(format('select public.start_contribution(%L, null)', g)) like 'KK004%', 'FAIL C2c: no amount accepted';
  assert pg_temp.fails(format('select public.start_contribution(%L, -5000)', g)) like 'KK004%', 'FAIL C2d: negative amount accepted';
  raise notice 'PASS C2: amounts below R10, above R1 000 000, negative or missing are refused';

  -- limit for someone whose identity is not verified: R1 000 in total, across everything
  assert pg_temp.fails(format('select public.start_contribution(%L, 90000)', g)) like 'KK002%', 'FAIL C3a: went over the unverified limit';
  perform public.start_contribution(g, 80000);
  assert pg_temp.fails(format('select public.start_contribution(%L, 1000)', g)) like 'KK002%', 'FAIL C3b: limit not cumulative';
  assert pg_temp.fails(format('select public.start_contribution(%L, 1000)', current_setting('kk.xgoal')::uuid)) like 'KK002%',
    'FAIL C3c: limit can be dodged by using another goal';
  raise notice 'PASS C3: without a verified identity, the R1 000 limit is a running total across all goals';
end $$;

-- ===== Supporter 2 (verified) fills most of the goal =====
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000012', false) \gset
do $$ declare g uuid := current_setting('kk.goal')::uuid; begin
  perform public.start_contribution(g, 300000);
  assert pg_temp.fails(format('select public.start_contribution(%L, 200000)', g)) like 'KK001%',
    'FAIL C4: more than the goal needs was accepted';
  raise notice 'PASS C4: a verified supporter may give more, but never more than the goal still needs';
end $$;

-- ===== Who may NOT contribute, and to what =====
-- a founder
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000001', false) \gset
do $$ begin
  assert pg_temp.fails(format('select public.start_contribution(%L, 5000)', current_setting('kk.goal'))) like '42501%', 'FAIL C5: a founder contributed';
  raise notice 'PASS C5: business accounts cannot contribute (including to their own goals)';
end $$;
-- admin
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-0000000000ad', false) \gset
do $$ begin
  assert pg_temp.fails(format('select public.start_contribution(%L, 5000)', current_setting('kk.goal'))) like '42501%', 'FAIL C5b: an admin contributed';
end $$;
-- investor 3
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000014', false) \gset
do $$ begin
  assert pg_temp.fails(format('select public.start_contribution(%L, 5000)', current_setting('kk.closed'))) like 'KK003%', 'FAIL C6a: closed goal accepted money';
  assert pg_temp.fails(format('select public.start_contribution(%L, 5000)', current_setting('kk.unver'))) like 'P0002%', 'FAIL C6b: goal of an unverified business accepted money';
  assert pg_temp.fails($q$select public.start_contribution('00000000-0000-0000-0000-000000000000', 5000)$q$) like 'P0002%', 'FAIL C6c';
  raise notice 'PASS C6: closed goals and goals of unverified businesses cannot be funded';

  assert pg_temp.fails(format($q$insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status) values (%L, auth.uid(), 5000, 'donation', 'held')$q$, current_setting('kk.goal'))) like '42501%',
    'FAIL C7a: wrote a contribution straight into the table';
  assert pg_temp.fails($q$update public.platform_settings set int_value = 999999999 where key = 'unverified_total_limit_cents'$q$) is null
     and (select count(*) from public.platform_settings) = 0, 'FAIL C7b: settings visible to a supporter';
  assert pg_temp.fails(format('select public.confirm_contribution(%L, ''self-paid'')', (select id from public.contributions limit 1))) is not null, 'FAIL C7c';
  raise notice 'PASS C7: supporters cannot write contributions, read or change settings, or confirm payments';
end $$;
reset role;
do $$ begin
  assert (select int_value from public.platform_settings where key = 'unverified_total_limit_cents') = 100000, 'FAIL C7d: the limit was changed';
  raise notice 'PASS C7d: the contribution limit is unchanged after the tampering attempt';
end $$;

-- ===== Unpaid checkouts expire and stop blocking others =====
update public.contributions set created_at = now() - interval '1 hour'
 where contributor_id = '55555555-0000-4000-8000-000000000011';
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000011', false) \gset
do $$ declare c uuid; begin
  c := public.start_contribution(current_setting('kk.goal')::uuid, 50000);
  assert (select count(*) from public.contributions where contributor_id = auth.uid() and status = 'failed') = 2, 'FAIL E1: old checkouts did not expire';
  raise notice 'PASS E1: checkouts nobody paid for expire, free up the limit and the goal''s capacity';
end $$;

-- ===== Only the server can confirm a payment =====
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000012', false) \gset
do $$ declare c uuid := (select id from public.contributions where contributor_id = auth.uid()); begin
  assert pg_temp.fails(format('select public.confirm_contribution(%L, ''my-own-confirmation'')', c)) like '42501%', 'FAIL P1: a supporter confirmed their own payment';
  assert (select status from public.contributions where id = c) = 'pending', 'FAIL P1b';
  raise notice 'PASS P1: a supporter cannot mark their own contribution as paid';
end $$;
reset role;
-- a stale pending contribution for supporter 3 (inserted directly), to test expiry at confirmation
insert into public.contributions (id, goal_id, contributor_id, amount_cents, kind, status, created_at)
values ('88888888-0000-4000-8000-0000000000e1', current_setting('kk.goal')::uuid, '55555555-0000-4000-8000-000000000014', 1000, 'donation', 'pending', now() - interval '2 hours');

select set_config('request.jwt.claim.sub', '', false) \gset
set role service_role;
do $$ declare r jsonb; c2 uuid := (select id from public.contributions where contributor_id = '55555555-0000-4000-8000-000000000012');
                          c1 uuid := (select id from public.contributions where contributor_id = '55555555-0000-4000-8000-000000000011' and status = 'pending'); begin
  r := public.confirm_contribution(c2, 'mock-pay-1');
  assert r ->> 'status' = 'held', format('FAIL P2: %s', r);
  r := public.confirm_contribution(c2, 'mock-pay-1');
  assert (r ->> 'already_confirmed')::boolean, 'FAIL P2b: confirming twice should be harmless';
  assert (select count(*) from public.contributions where id = c2 and status = 'held') = 1, 'FAIL P2c';
  r := public.confirm_contribution('88888888-0000-4000-8000-0000000000e1', 'too-late');
  assert r ->> 'status' = 'expired' and (select status from public.contributions where id = '88888888-0000-4000-8000-0000000000e1') = 'failed',
    format('FAIL P3: an expired checkout was credited: %s', r);
  r := public.confirm_contribution(c1, 'mock-pay-2');
  assert r ->> 'status' = 'held', 'FAIL P2d';
  raise notice 'PASS P2-P3: the server confirms payments (twice is harmless); a payment that arrives after expiry is not credited';
end $$;

-- ===== Totals everyone may see =====
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000014', false) \gset
do $$ declare f record; begin
  select * into f from public.goal_funding('66666666-0000-4000-8000-0000000000b1') where goal_id = current_setting('kk.goal')::uuid;
  assert f.raised_cents = 350000 and f.supporter_count = 2 and f.paid_out_cents = 0, format('FAIL T1: %s / %s / %s', f.raised_cents, f.supporter_count, f.paid_out_cents);
  assert (select count(*) from public.goal_funding('66666666-0000-4000-8000-0000000000b3')) = 0, 'FAIL T2: totals of an unverified business leaked';
  raise notice 'PASS T1-T2: supporters see how much a goal has raised (held money only), never for unverified businesses';
end $$;

-- ===== Milestone proof =====
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000001', false) \gset
do $$ declare b uuid := '66666666-0000-4000-8000-0000000000b1'; m1 uuid := '66666666-0000-4000-8000-0000000000c1'; begin
  insert into public.documents (id, business_id, type, storage_path) values
    ('77777777-0000-4000-8000-000000000001', b, 'invoice', b || '/inv1.pdf'),
    ('77777777-0000-4000-8000-000000000002', b, 'invoice', b || '/inv2.pdf'),
    ('77777777-0000-4000-8000-000000000003', b, 'invoice', b || '/inv3.pdf'),
    ('77777777-0000-4000-8000-000000000004', b, 'id', b || '/myid.pdf');

  assert pg_temp.fails(format('select public.submit_milestone_proof(%L, %L)', m1, '77777777-0000-4000-8000-0000000000f9')) is not null,
    'FAIL M1: attached another business''s invoice';
  assert pg_temp.fails(format('select public.submit_milestone_proof(%L, %L)', m1, '77777777-0000-4000-8000-000000000004')) like '23514%',
    'FAIL M2: attached an ID document as proof';
  assert pg_temp.fails(format('select public.submit_milestone_proof(%L, null)', m1)) like '23514%', 'FAIL M2b: no document';
  perform public.submit_milestone_proof(m1, '77777777-0000-4000-8000-000000000001');
  assert (select status from public.milestones where id = m1) = 'proof_submitted', 'FAIL M3';
  assert pg_temp.fails(format('select public.submit_milestone_proof(%L, %L)', m1, '77777777-0000-4000-8000-000000000002')) like '42501%',
    'FAIL M4: swapped the proof after submitting';
  raise notice 'PASS M1-M4: proof must be an invoice from your own business, and cannot be swapped after submitting';

  assert pg_temp.fails(format('select public.review_milestone(%L, true, null)', m1)) like '42501%', 'FAIL M5: founder approved their own proof';
  assert pg_temp.fails(format($q$update public.milestones set status = 'approved' where id = %L$q$, m1)) like '42501%', 'FAIL M5b';
  raise notice 'PASS M5: a founder cannot approve their own proof';
end $$;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000014', false) \gset
do $$ begin
  assert pg_temp.fails(format('select public.submit_milestone_proof(%L, %L)', '66666666-0000-4000-8000-0000000000c1', '77777777-0000-4000-8000-000000000001')) is not null,
    'FAIL M6: a supporter attached proof';
  assert pg_temp.fails(format('select public.review_milestone(%L, true, null)', '66666666-0000-4000-8000-0000000000c1')) like '42501%', 'FAIL M6b';
  raise notice 'PASS M6: supporters can neither submit nor review proof';
end $$;

-- ===== Administrator: reject, resubmit, approve =====
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-0000000000ad', false) \gset
do $$ declare m1 uuid := '66666666-0000-4000-8000-0000000000c1'; r jsonb; begin
  assert pg_temp.fails(format('select public.review_milestone(%L, false, ''  '')', m1)) like '22023%', 'FAIL R1: rejected without a reason';
  assert pg_temp.fails(format('select public.review_document(%L, true, null)', '77777777-0000-4000-8000-000000000001')) like 'P0001%',
    'FAIL R1b: an invoice was approved as a plain document';
  r := public.review_milestone(m1, false, 'The invoice is not from a registered supplier');
  assert r ->> 'status' = 'rejected' and not (r ->> 'payout_created')::boolean, format('FAIL R2: %s', r);
  assert (select status from public.documents where id = '77777777-0000-4000-8000-000000000001') = 'rejected', 'FAIL R2b';
  raise notice 'PASS R1-R2: a rejection needs a reason, rejects the proof document too, and pays nothing';
end $$;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000001', false) \gset
do $$ declare m1 uuid := '66666666-0000-4000-8000-0000000000c1'; begin
  assert (select review_note from public.milestones where id = m1) = 'The invoice is not from a registered supplier', 'FAIL R3a: founder cannot read the reason';
  perform public.submit_milestone_proof(m1, '77777777-0000-4000-8000-000000000002');
  assert (select status from public.milestones where id = m1) = 'proof_submitted' and (select review_note from public.milestones where id = m1) is null, 'FAIL R3b';
  raise notice 'PASS R3: the founder sees the reason and can resubmit with a new invoice';
end $$;

select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-0000000000ad', false) \gset
do $$ declare r jsonb; m1 uuid := '66666666-0000-4000-8000-0000000000c1'; begin
  r := public.review_milestone(m1, true, null);
  assert r ->> 'status' = 'approved' and (r ->> 'payout_created')::boolean, format('FAIL R4: %s', r);
  assert (select amount_cents from public.payouts where milestone_id = m1) = 300000 and (select status from public.payouts where milestone_id = m1) = 'pending', 'FAIL R4b';
  assert pg_temp.fails(format('select public.review_milestone(%L, true, null)', m1)) like 'P0001%', 'FAIL R5: approved twice';
  raise notice 'PASS R4-R5: approval with enough held money creates exactly one payout, and cannot be repeated';
end $$;

-- Milestone 2 is approved while only R50 000 is still free in escrow: it must wait, not overspend.
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000001', false) \gset
do $$ begin
  perform public.submit_milestone_proof('66666666-0000-4000-8000-0000000000c2', '77777777-0000-4000-8000-000000000003');
  assert pg_temp.fails($q$update public.milestones set amount_cents = 1 where id = '66666666-0000-4000-8000-0000000000c1'$q$) like '42501%', 'FAIL R6: changed an approved milestone';
end $$;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-0000000000ad', false) \gset
do $$ declare r jsonb; begin
  r := public.review_milestone('66666666-0000-4000-8000-0000000000c2', true, null);
  assert r ->> 'status' = 'approved' and not (r ->> 'payout_created')::boolean, format('FAIL R7: %s', r);
  assert (select count(*) from public.payouts) = 1, 'FAIL R7b: paid out more than the balance covers';
  raise notice 'PASS R7: a milestone approved before enough money has arrived waits; nothing is overspent';
end $$;

-- More money arrives: the waiting milestone is released automatically
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000013', false) \gset
do $$ declare g uuid := current_setting('kk.goal')::uuid; c uuid; begin
  c := public.start_contribution(g, 150000);
  perform set_config('kk.donor_contribution', c::text, false);
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset
set role service_role;
do $$ declare r jsonb; begin
  r := public.confirm_contribution(current_setting('kk.donor_contribution')::uuid, 'mock-pay-3');
  assert (r ->> 'payouts_created')::int = 1, format('FAIL R8: %s', r);
  assert (select amount_cents from public.payouts where milestone_id = '66666666-0000-4000-8000-0000000000c2') = 200000, 'FAIL R8b';
  raise notice 'PASS R8: when the missing money arrives, the waiting milestone is paid out automatically';

  assert (select coalesce(sum(amount_cents), 0) from public.payouts where status in ('pending', 'paid'))
      <= (select coalesce(sum(amount_cents), 0) from public.contributions where status = 'held'), 'FAIL R9: payouts exceed money held';
  raise notice 'PASS R9: payouts never exceed the money actually held';
end $$;

-- ===== Recording payouts: server only =====
do $$ declare p1 uuid := (select id from public.payouts where milestone_id = '66666666-0000-4000-8000-0000000000c1'); begin
  assert public.mark_payout_paid(p1, 'mock-payout-1'), 'FAIL Y1';
  assert not public.mark_payout_paid(p1, 'mock-payout-1'), 'FAIL Y2: paid twice';
  perform public.note_payout_failure((select id from public.payouts where milestone_id = '66666666-0000-4000-8000-0000000000c2'), 'Provider timed out');
  assert (select failure_reason from public.payouts where milestone_id = '66666666-0000-4000-8000-0000000000c2') = 'Provider timed out' and
         (select status from public.payouts where milestone_id = '66666666-0000-4000-8000-0000000000c2') = 'pending', 'FAIL Y3';
  raise notice 'PASS Y1-Y3: the server records a payout once; a failed attempt keeps the payout pending with a reason';
end $$;
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000012', false) \gset
do $$ begin
  assert pg_temp.fails($q$select public.mark_payout_paid((select id from public.payouts limit 1), 'fake')$q$) like '42501%', 'FAIL Y4: a supporter marked a payout paid';
  assert pg_temp.fails(format($q$insert into public.payouts (goal_id, milestone_id, amount_cents) values (%L, gen_random_uuid(), 1)$q$, current_setting('kk.goal'))) like '42501%', 'FAIL Y5: a supporter created a payout';
  raise notice 'PASS Y4-Y5: supporters cannot record or create payouts';
end $$;

-- ===== Who can see payouts =====
do $$ begin assert (select count(*) from public.payouts) = 2, 'FAIL V1: a contributor should see the goal''s payouts'; end $$;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000001', false) \gset
do $$ begin assert (select count(*) from public.payouts) = 2, 'FAIL V2: the founder should see their payouts'; end $$;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000014', false) \gset
do $$ begin
  assert (select count(*) from public.payouts) = 0, 'FAIL V3: someone who funded nothing can read payouts';
  assert (select count(*) from public.milestone_payouts('66666666-0000-4000-8000-0000000000b1')) = 2, 'FAIL V4: the public summary of payouts is missing';
  assert (select paid_out_cents from public.goal_funding('66666666-0000-4000-8000-0000000000b1') where goal_id = current_setting('kk.goal')::uuid) = 300000, 'FAIL V5: paid-out total';
  assert (select raised_cents from public.goal_funding('66666666-0000-4000-8000-0000000000b1') where goal_id = current_setting('kk.goal')::uuid) = 500000, 'FAIL V6: raised total';
  raise notice 'PASS V1-V6: payout details are for the founder, funders and admins; everyone else sees only the totals';
end $$;

-- ===== Identity verification lifts the limit; only the server can set it =====
do $$ begin
  assert pg_temp.fails(format('select public.start_contribution(%L, 200000)', current_setting('kk.xgoal'))) like 'KK002%', 'FAIL K1';
  assert pg_temp.fails($q$select public.set_kyc_status(auth.uid(), 'verified')$q$) like '42501%', 'FAIL K2: self-verified identity';
  assert pg_temp.fails($q$update public.profiles set kyc_status = 'verified' where id = auth.uid()$q$) is null
     and (select kyc_status from public.profiles where id = auth.uid()) = 'unverified', 'FAIL K2b: kyc status changed by the user';
end $$;
reset role; select set_config('request.jwt.claim.sub', '', false) \gset
set role service_role;
select public.set_kyc_status('55555555-0000-4000-8000-000000000014', 'verified') \gset
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-0000-4000-8000-000000000014', false) \gset
do $$ begin
  perform public.start_contribution(current_setting('kk.xgoal')::uuid, 200000);
  raise notice 'PASS K1-K2: only the server can verify identity; after that the R1 000 limit no longer applies';
end $$;

-- ===== Audit trail =====
reset role;
do $$ begin
  assert (select count(*) from public.audit_log where action = 'contribution.started') >= 6, 'FAIL L1';
  assert (select count(*) from public.audit_log where action = 'contribution.held') = 3, 'FAIL L2';
  assert (select count(*) from public.audit_log where action = 'milestone.approved') = 2, 'FAIL L3';
  assert (select count(*) from public.audit_log where action = 'milestone.rejected') = 1, 'FAIL L4';
  assert (select count(*) from public.audit_log where action = 'payout.created') = 2, 'FAIL L5';
  assert (select count(*) from public.audit_log where action = 'payout.paid') = 1, 'FAIL L6';
  assert (select count(*) from public.audit_log where action = 'kyc.status_set') = 1, 'FAIL L7';
  raise notice 'PASS L1-L7: contributions, payments, approvals, payouts and identity changes are all in the audit log';
end $$;
