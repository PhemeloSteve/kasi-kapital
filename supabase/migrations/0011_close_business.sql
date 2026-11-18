-- Step 11a: closing a business, and what happens to its documents afterwards.
--
-- A closed business is gone for good: hidden from supporters, no new money, and it cannot be reinstated.
-- Closing is refused while money is still held for the business (or a payout is on its way), because
-- there is no refund process yet: that money has to be paid out first.
--
-- The retention clock starts when the business is closed:
--   * documents nobody approved (pending or rejected) are deleted at once;
--   * approved documents (identity, bank statement ...) are deleted 12 months after closing.
-- Money records and the audit log are never deleted by these rules.

-- ---------- 1. A closing date, and the periods the rules use ----------
alter table public.businesses add column closed_at timestamptz;
create index businesses_closed_idx on public.businesses (closed_at) where closed_at is not null;

insert into public.platform_settings (key, int_value, note) values
  ('retention_closed_document_months', 12,
   'Approved documents of a closed business are deleted this many months after it closed'),
  ('retention_financial_record_years', 5,
   'Contribution, payment and payout records are kept at least this many years (policy; nothing deletes them yet)')
on conflict (key) do nothing;

-- ---------- 2. How much money is still held for a goal ----------
-- Held contributions minus payouts that are pending or paid. Same rule the payout code uses.
create or replace function public.goal_escrow_balance(p_goal uuid)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select (
    coalesce((select sum(amount_cents) from public.contributions
               where goal_id = p_goal and status = 'held'), 0)
    - coalesce((select sum(amount_cents) from public.payouts
                 where goal_id = p_goal and status in ('pending', 'paid')), 0)
  )::bigint;
$$;
revoke all on function public.goal_escrow_balance(uuid) from public, anon, authenticated;

-- ---------- 3. A closed business stays closed ----------
-- Whatever updates it afterwards (a document review, a trust-level recalculation, an administrator's
-- mistake), its closing date, status and trust tier cannot change. Server-side code and the SQL editor
-- have no signed-in user (auth.uid() is null) and may still correct a business by hand.
create or replace function public.freeze_closed_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.closed_at is null or auth.uid() is null then
    return new;
  end if;
  new.closed_at := old.closed_at;
  new.verification := old.verification;
  new.trust_tier := old.trust_tier;
  return new;
end;
$$;

-- The "zz" makes it run after the other triggers on this table, so it has the last word.
create trigger zz_freeze_closed_business_trg
  before update on public.businesses
  for each row execute function public.freeze_closed_business();

-- ---------- 4. Close a business (super administrators only) ----------
-- Error codes the app relies on:
--   42501 not a super administrator      22023 reason missing or too long     P0002 no such business
--   55000 already closed                 55006 money is still held or on its way
create or replace function public.close_business(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  b public.businesses;
  v_goals integer;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'A reason of 1 to 300 characters is required' using errcode = '22023';
  end if;

  select * into b from public.businesses where id = p_id for update;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  if b.closed_at is not null then
    raise exception 'Business is already closed' using errcode = '55000';
  end if;

  -- Money still held, a payout on its way, or a checkout that is still open: not yet.
  if exists (select 1 from public.funding_goals g
              where g.business_id = p_id and public.goal_escrow_balance(g.id) > 0)
     or exists (select 1 from public.payouts p join public.funding_goals g on g.id = p.goal_id
                 where g.business_id = p_id and p.status = 'pending')
     or exists (select 1 from public.contributions c join public.funding_goals g on g.id = c.goal_id
                 where g.business_id = p_id and c.status = 'pending'
                   and c.created_at > now() - make_interval(mins => public.setting('checkout_minutes')::integer))
  then
    raise exception 'Money is still held for this business' using errcode = '55006';
  end if;

  update public.funding_goals set is_open = false where business_id = p_id and is_open;
  get diagnostics v_goals = row_count;

  update public.businesses set closed_at = now(), verification = 'suspended' where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'business.closed', 'businesses', p_id::text,
          jsonb_build_object('reason', v_reason, 'goals_closed', v_goals));
end;
$$;

revoke all on function public.close_business(uuid, text) from public, anon, authenticated;
grant execute on function public.close_business(uuid, text) to authenticated;

-- ---------- 5. A closed business cannot be reinstated ----------
-- Same function as 0009, with one extra rule.
create or replace function public.unsuspend_business(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;

  if exists (select 1 from public.businesses where id = p_id and closed_at is not null) then
    raise exception 'A closed business cannot be reinstated' using errcode = '55000';
  end if;

  update public.businesses set verification = 'pending'
   where id = p_id and verification = 'suspended';
  if not found then
    if exists (select 1 from public.businesses where id = p_id) then
      raise exception 'Business is not suspended' using errcode = '22023';
    end if;
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'business.unsuspended', 'businesses', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.unsuspend_business(uuid) from public, anon, authenticated;
grant execute on function public.unsuspend_business(uuid) to authenticated;

-- ---------- 6. Which documents are due for deletion, and why ----------
-- One rule, used by both the list and the delete, so they can never disagree:
--   closed business, document not approved      -> due at once            ('closed_business_unreviewed')
--   closed business, document approved          -> due after 12 months    ('closed_business_retention')
--   rejected on its own                         -> due after 30 days      ('rejected_retention')
create or replace function public.document_purge_reason(d public.documents)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when b.closed_at is not null and d.status <> 'verified'
      then 'closed_business_unreviewed'
    when b.closed_at is not null and d.status = 'verified'
         and b.closed_at < now() - make_interval(
               months => public.setting('retention_closed_document_months')::integer)
      then 'closed_business_retention'
    when d.status = 'rejected' and d.reviewed_at is not null
         and d.reviewed_at < now() - make_interval(
               days => public.setting('retention_rejected_document_days')::integer)
      then 'rejected_retention'
    else null
  end
  from public.businesses b
  where b.id = d.business_id;
$$;
revoke all on function public.document_purge_reason(public.documents) from public, anon, authenticated;

create or replace function public.documents_due_for_purge(p_limit integer default 200)
returns table (id uuid, doc_type text, storage_path text)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.type::text, d.storage_path
    from public.documents d
   where public.document_purge_reason(d) is not null
   order by coalesce(d.reviewed_at, d.created_at), d.id
   limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

-- Deletes the records of due documents and writes one audit entry for each, with the reason. It re-checks
-- every document itself, so one that is not due is left alone even if its id is passed in. A milestone
-- that still pointed at a deleted document simply has no proof any more.
create or replace function public.finish_document_purge(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.milestones m
     set proof_document_id = null
    from public.documents d
   where d.id = m.proof_document_id
     and d.id = any (p_ids)
     and public.document_purge_reason(d) is not null;

  with deleted as (
    delete from public.documents d
     where d.id = any (p_ids)
       and public.document_purge_reason(d) is not null
    returning d.id, d.type::text as type, public.document_purge_reason(d) as reason
  ), logged as (
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    select null, 'document.purged', 'documents', deleted.id::text,
           jsonb_build_object('reason', deleted.reason, 'type', deleted.type)
      from deleted
    returning 1
  )
  select count(*) into v_count from logged;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.documents_due_for_purge(integer) from public, anon, authenticated;
grant execute on function public.documents_due_for_purge(integer) to service_role;
revoke all on function public.finish_document_purge(uuid[]) from public, anon, authenticated;
grant execute on function public.finish_document_purge(uuid[]) to service_role;
