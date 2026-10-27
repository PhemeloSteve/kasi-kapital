-- Step 5: contributions, escrow balances, milestone proof and payouts.
--
-- Money model (all amounts in ZAR cents):
--   * A contribution is 'pending' while checkout is open and 'held' once the payment provider confirms it.
--   * A goal's escrow balance = held contributions - payouts (pending or paid).
--   * A milestone is paid out only after an administrator approves its proof AND the escrow balance covers it.
--     Approved milestones are paid in order; a later one never jumps ahead of an earlier one.
-- Functions that move money are SECURITY DEFINER with explicit checks. The ones only a payment webhook
-- may call (confirm, payout results, identity status) are executable by the server's service role alone.

-- ---------- 1. Settings that must not be changeable from the browser ----------
create table public.platform_settings (
  key text primary key,
  int_value bigint not null,
  note text
);
alter table public.platform_settings enable row level security;   -- no policies: only the functions below read it
insert into public.platform_settings (key, int_value, note) values
  ('min_contribution_cents', 1000, 'Smallest single contribution (R10)'),
  ('max_contribution_cents', 100000000, 'Largest single contribution (R1 000 000)'),
  ('unverified_total_limit_cents', 100000, 'Most a supporter without a verified identity may contribute in total (R1 000)'),
  ('checkout_minutes', 15, 'How long a started contribution waits for payment before it expires');

create or replace function public.setting(p_key text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$ select int_value from public.platform_settings where key = p_key $$;
revoke all on function public.setting(text) from public, anon, authenticated;

-- ---------- 2. Payouts ----------
create type payout_status as enum ('pending', 'paid', 'failed');

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.funding_goals(id) on delete restrict,
  milestone_id uuid not null unique references public.milestones(id) on delete restrict,  -- one payout per milestone, ever
  amount_cents bigint not null check (amount_cents > 0),
  status payout_status not null default 'pending',
  provider_reference text,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payouts_goal_idx on public.payouts (goal_id);
alter table public.payouts enable row level security;

-- Visible to administrators, the founder, and people who funded the goal. Written only by the functions below.
create policy "payouts_read" on public.payouts
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.funding_goals g join public.businesses b on b.id = g.business_id
      where g.id = payouts.goal_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.contributions c
      where c.goal_id = payouts.goal_id and c.contributor_id = auth.uid() and c.status = 'held'
    )
  );

-- ---------- 3. Milestone proof ----------
alter table public.milestones add column review_note text;
alter table public.milestones add constraint milestones_note_len check (review_note is null or char_length(review_note) <= 300);

-- More room for invoices (one per milestone, plus resubmissions).
create or replace function public.protect_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.review_note := null;
  if (select count(*) from public.documents where business_id = new.business_id) >= 50 then
    raise exception 'Document limit reached. Delete documents you no longer need.' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- Founders may only attach a proper proof; approving or rejecting stays with administrators.
create or replace function public.protect_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if public.goal_is_funded(new.goal_id) then
      raise exception 'Milestones cannot be added to a funded goal' using errcode = '42501';
    end if;
    new.status := 'pending';
    new.proof_document_id := null;
    new.review_note := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.goal_is_funded(old.goal_id) or old.status <> 'pending' then
      raise exception 'This milestone can no longer be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.status = 'approved' then
    raise exception 'An approved milestone cannot be changed' using errcode = '42501';
  end if;
  if new.goal_id is distinct from old.goal_id then
    raise exception 'A milestone cannot be moved to another goal' using errcode = '42501';
  end if;
  if new.amount_cents is distinct from old.amount_cents and public.goal_is_funded(old.goal_id) then
    raise exception 'Milestone amounts of a funded goal cannot be changed' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('pending', 'rejected') and new.status = 'proof_submitted' then
      if new.proof_document_id is null or not exists (
        select 1
          from public.documents d
          join public.funding_goals g on g.id = new.goal_id
         where d.id = new.proof_document_id
           and d.business_id = g.business_id
           and d.type = 'invoice'
           and d.status = 'pending'
      ) then
        raise exception 'Attach an invoice or quote from this business as proof' using errcode = '23514';
      end if;
      new.review_note := null;
    else
      raise exception 'Only an administrator can approve or reject a milestone' using errcode = '42501';
    end if;
  else
    if new.proof_document_id is distinct from old.proof_document_id then
      raise exception 'Proof can only be attached when you submit it' using errcode = '42501';
    end if;
    new.review_note := old.review_note;
  end if;
  return new;
end;
$$;

-- Milestone proofs are reviewed together with their milestone, never as a plain document.
create or replace function public.review_document(
  p_document_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.documents;
  b public.businesses;
  v_id boolean;
  v_bank boolean;
  v_cipc boolean;
  v_tier smallint;
  v_status verification_status;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review documents' using errcode = '42501';
  end if;

  select * into d from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if d.type = 'invoice' then
    raise exception 'Milestone proofs are reviewed together with their milestone' using errcode = 'P0001';
  end if;
  if d.status <> 'pending' then
    raise exception 'This document has already been reviewed' using errcode = 'P0001';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Give a reason when rejecting a document' using errcode = '22023';
  end if;

  select * into b from public.businesses where id = d.business_id for update;
  if b.verification not in ('pending', 'verified') then
    raise exception 'This business has not been submitted for review' using errcode = 'P0001';
  end if;

  update public.documents
     set status = case when p_approve then 'verified'::verification_status else 'rejected'::verification_status end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = v_note
   where id = d.id;

  select exists (select 1 from public.documents where business_id = b.id and type = 'id' and status = 'verified'),
         exists (select 1 from public.documents where business_id = b.id and type = 'bank_statement' and status = 'verified'),
         exists (select 1 from public.documents where business_id = b.id and type = 'cipc' and status = 'verified')
    into v_id, v_bank, v_cipc;

  v_tier := case when v_id and v_bank and v_cipc then 3 when v_id and v_bank then 2 when v_id then 1 else 0 end;

  if b.verification = 'verified' or v_tier >= 2 then
    v_status := 'verified';
  elsif exists (select 1 from public.documents where business_id = b.id and type in ('id', 'bank_statement') and status = 'pending') then
    v_status := 'pending';
  else
    v_status := 'rejected';
  end if;

  update public.businesses set trust_tier = greatest(trust_tier, v_tier), verification = v_status where id = b.id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    case when p_approve then 'document.approved' else 'document.rejected' end,
    'documents', d.id::text,
    jsonb_build_object('business_id', b.id, 'type', d.type, 'note', v_note, 'business_status', v_status, 'trust_tier', v_tier)
  );

  return jsonb_build_object('business_status', v_status, 'trust_tier', greatest(b.trust_tier, v_tier));
end;
$$;

-- Founder attaches an uploaded invoice or quote to a milestone. Runs as the founder, so row level security
-- and the trigger above decide whether it is allowed.
create or replace function public.submit_milestone_proof(p_milestone_id uuid, p_document_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.milestones
     set status = 'proof_submitted', proof_document_id = p_document_id
   where id = p_milestone_id;
  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------- 4. Releasing money ----------
-- Creates a payout for every approved milestone the escrow balance can cover, earliest milestone first.
-- Internal: only other functions call it.
create or replace function public.settle_goal(p_goal_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_held bigint;
  v_committed bigint;
  v_created integer := 0;
  m record;
begin
  select coalesce(sum(amount_cents), 0) into v_held
    from public.contributions where goal_id = p_goal_id and status = 'held';
  select coalesce(sum(amount_cents), 0) into v_committed
    from public.payouts where goal_id = p_goal_id and status in ('pending', 'paid');

  for m in
    select ms.id, ms.amount_cents
      from public.milestones ms
     where ms.goal_id = p_goal_id
       and ms.status = 'approved'
       and not exists (select 1 from public.payouts p where p.milestone_id = ms.id)
     order by ms.position, ms.created_at, ms.id
  loop
    exit when v_held - v_committed < m.amount_cents;   -- not enough yet; later milestones wait their turn
    insert into public.payouts (goal_id, milestone_id, amount_cents) values (p_goal_id, m.id, m.amount_cents);
    v_committed := v_committed + m.amount_cents;
    v_created := v_created + 1;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'payout.created', 'milestones', m.id::text, jsonb_build_object('goal_id', p_goal_id, 'amount_cents', m.amount_cents));
  end loop;
  return v_created;
end;
$$;
revoke all on function public.settle_goal(uuid) from public, anon, authenticated;

-- A supporter starts a contribution. Every rule that protects money is checked here, under a lock.
create or replace function public.start_contribution(p_goal_id uuid, p_amount_cents bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role user_role;
  v_kyc verification_status;
  g record;
  v_taken bigint;
  v_mine bigint;
  v_limit bigint;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Lock the supporter first, so two quick requests cannot slip past their limit together.
  select role, kyc_status into v_role, v_kyc from public.profiles where id = v_user for update;
  if v_role is null or v_role not in ('investor', 'donor') then
    raise exception 'Only supporter accounts can contribute' using errcode = '42501';
  end if;
  if v_kyc in ('rejected', 'suspended') then
    raise exception 'This account cannot contribute' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < public.setting('min_contribution_cents')
     or p_amount_cents > public.setting('max_contribution_cents') then
    raise exception 'Amount out of range' using errcode = 'KK004';
  end if;

  select fg.id, fg.target_cents, fg.kind, fg.is_open, b.verification as business_status
    into g
    from public.funding_goals fg
    join public.businesses b on b.id = fg.business_id
   where fg.id = p_goal_id
     for update of fg;
  if not found or g.business_status <> 'verified' then
    raise exception 'Goal not found' using errcode = 'P0002';
  end if;
  if not g.is_open then
    raise exception 'This goal is closed' using errcode = 'KK003';
  end if;

  -- Checkouts nobody paid for stop counting.
  update public.contributions set status = 'failed'
   where goal_id = p_goal_id and status = 'pending'
     and created_at < now() - make_interval(mins => public.setting('checkout_minutes')::integer);

  if v_kyc <> 'verified' then
    v_limit := public.setting('unverified_total_limit_cents');
    select coalesce(sum(amount_cents), 0) into v_mine
      from public.contributions where contributor_id = v_user and status in ('pending', 'held');
    if v_mine + p_amount_cents > v_limit then
      raise exception 'Identity not verified: contribution limit reached' using errcode = 'KK002', detail = greatest(v_limit - v_mine, 0)::text;
    end if;
  end if;

  select coalesce(sum(amount_cents), 0) into v_taken
    from public.contributions where goal_id = p_goal_id and status in ('pending', 'held');
  if v_taken + p_amount_cents > g.target_cents then
    raise exception 'This goal needs less than that' using errcode = 'KK001', detail = greatest(g.target_cents - v_taken, 0)::text;
  end if;

  insert into public.contributions (goal_id, contributor_id, amount_cents, kind, status)
  values (p_goal_id, v_user, p_amount_cents, g.kind, 'pending')
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (v_user, 'contribution.started', 'contributions', v_id::text, jsonb_build_object('goal_id', p_goal_id, 'amount_cents', p_amount_cents));
  return v_id;
end;
$$;

-- The payment provider (or the demo checkout) reports that the money arrived. Server-only.
create or replace function public.confirm_contribution(p_id uuid, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contributions;
  v_payouts integer;
begin
  select * into c from public.contributions where id = p_id for update;
  if not found then
    raise exception 'Contribution not found' using errcode = 'P0002';
  end if;
  if c.status = 'held' then
    return jsonb_build_object('status', 'held', 'already_confirmed', true);
  end if;
  if c.status <> 'pending' then
    return jsonb_build_object('status', c.status);
  end if;
  if c.created_at < now() - make_interval(mins => public.setting('checkout_minutes')::integer) then
    update public.contributions set status = 'failed' where id = c.id;
    return jsonb_build_object('status', 'expired');
  end if;

  update public.contributions set status = 'held', provider_reference = p_reference where id = c.id;
  v_payouts := public.settle_goal(c.goal_id);

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (c.contributor_id, 'contribution.held', 'contributions', c.id::text,
          jsonb_build_object('goal_id', c.goal_id, 'amount_cents', c.amount_cents, 'payouts_created', v_payouts));
  return jsonb_build_object('status', 'held', 'payouts_created', v_payouts);
end;
$$;

-- An administrator approves or rejects a milestone's proof. Approval releases money if the balance allows.
create or replace function public.review_milestone(p_milestone_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.milestones;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
  v_created integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review milestones' using errcode = '42501';
  end if;

  select * into m from public.milestones where id = p_milestone_id for update;
  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;
  if m.status <> 'proof_submitted' then
    raise exception 'This milestone is not waiting for review' using errcode = 'P0001';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Give a reason when rejecting proof' using errcode = '22023';
  end if;

  update public.milestones
     set status = case when p_approve then 'approved'::milestone_status else 'rejected'::milestone_status end,
         review_note = v_note
   where id = m.id;

  update public.documents
     set status = case when p_approve then 'verified'::verification_status else 'rejected'::verification_status end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_note
   where id = m.proof_document_id;

  if p_approve then
    v_created := public.settle_goal(m.goal_id);
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), case when p_approve then 'milestone.approved' else 'milestone.rejected' end,
          'milestones', m.id::text, jsonb_build_object('goal_id', m.goal_id, 'note', v_note, 'payout_created', v_created > 0));
  return jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end, 'payout_created', v_created > 0);
end;
$$;

-- ---------- 5. Server-only results from the payment provider ----------
create or replace function public.mark_payout_paid(p_payout_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payouts
     set status = 'paid', provider_reference = p_reference, paid_at = now(), failure_reason = null
   where id = p_payout_id and status = 'pending';
  if not found then
    return false;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (null, 'payout.paid', 'payouts', p_payout_id::text, jsonb_build_object('reference', p_reference));
  return true;
end;
$$;

create or replace function public.note_payout_failure(p_payout_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.payouts set failure_reason = left(btrim(coalesce(p_reason, '')), 300)
   where id = p_payout_id and status = 'pending';
$$;

-- Identity verification result for a supporter (set by the identity provider integration).
create or replace function public.set_kyc_status(p_user_id uuid, p_status verification_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set kyc_status = p_status where id = p_user_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (null, 'kyc.status_set', 'profiles', p_user_id::text, jsonb_build_object('status', p_status));
end;
$$;

-- ---------- 6. Safe totals for everyone allowed to see a business ----------
create or replace function public.goal_funding(p_business_id uuid)
returns table (goal_id uuid, raised_cents bigint, paid_out_cents bigint, supporter_count bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.businesses b
     where b.id = p_business_id
       and (b.verification = 'verified' or b.owner_id = auth.uid() or public.is_admin())
  ) then
    return;
  end if;
  return query
  select fg.id,
         coalesce(sum(c.amount_cents) filter (where c.status = 'held'), 0)::bigint,
         coalesce((select sum(p.amount_cents) from public.payouts p where p.goal_id = fg.id and p.status = 'paid'), 0)::bigint,
         count(distinct c.contributor_id) filter (where c.status = 'held')
    from public.funding_goals fg
    left join public.contributions c on c.goal_id = fg.id
   where fg.business_id = p_business_id
   group by fg.id;
end;
$$;

create or replace function public.milestone_payouts(p_business_id uuid)
returns table (milestone_id uuid, amount_cents bigint, status payout_status)
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.businesses b
     where b.id = p_business_id
       and (b.verification = 'verified' or b.owner_id = auth.uid() or public.is_admin())
  ) then
    return;
  end if;
  return query
  select p.milestone_id, p.amount_cents, p.status
    from public.payouts p
    join public.funding_goals fg on fg.id = p.goal_id
   where fg.business_id = p_business_id;
end;
$$;

-- ---------- 7. Who may call what ----------
revoke all on function public.start_contribution(uuid, bigint) from public, anon;
grant execute on function public.start_contribution(uuid, bigint) to authenticated;
revoke all on function public.submit_milestone_proof(uuid, uuid) from public, anon;
grant execute on function public.submit_milestone_proof(uuid, uuid) to authenticated;
revoke all on function public.review_milestone(uuid, boolean, text) from public, anon;
grant execute on function public.review_milestone(uuid, boolean, text) to authenticated;
revoke all on function public.goal_funding(uuid) from public, anon;
grant execute on function public.goal_funding(uuid) to authenticated;
revoke all on function public.milestone_payouts(uuid) from public, anon;
grant execute on function public.milestone_payouts(uuid) to authenticated;

-- Only the server (service role) may confirm payments, record payouts or set identity status.
revoke all on function public.confirm_contribution(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_contribution(uuid, text) to service_role;
revoke all on function public.mark_payout_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_payout_paid(uuid, text) to service_role;
revoke all on function public.note_payout_failure(uuid, text) from public, anon, authenticated;
grant execute on function public.note_payout_failure(uuid, text) to service_role;
revoke all on function public.set_kyc_status(uuid, verification_status) from public, anon, authenticated;
grant execute on function public.set_kyc_status(uuid, verification_status) to service_role;
