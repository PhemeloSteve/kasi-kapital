-- Step 3: document upload, administrator review and business verification.
-- Document status values (from 0001): 'pending' = uploaded, 'verified' = approved, 'rejected'.

-- ---------- 1. Documents: rules that hold whatever the app does ----------
alter table public.documents
  add column review_note text,
  add constraint documents_status_check check (status in ('pending', 'verified', 'rejected')),
  add constraint documents_note_len check (review_note is null or char_length(review_note) <= 300),
  -- Every file lives in a folder named after its own business, which is what storage rules rely on.
  add constraint documents_path_in_business_folder
    check (storage_path like business_id::text || '/%' and storage_path !~ '\.\.');

-- A founder can only ever create pending documents, and only a limited number.
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
  if (select count(*) from public.documents where business_id = new.business_id) >= 20 then
    raise exception 'Document limit reached. Delete documents you no longer need.' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger protect_documents_trg
  before insert on public.documents
  for each row execute function public.protect_documents();

-- Founders may remove documents that are not approved (approved ones are kept for the audit trail).
create policy "documents_owner_delete" on public.documents
  for delete using (
    status in ('pending', 'rejected')
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- ---------- 2. Submitting for review is allowed only with the required documents ----------
create or replace function public.protect_business_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification := 'unverified';
    new.trust_tier := 0;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id or new.trust_tier is distinct from old.trust_tier then
    raise exception 'Only an administrator can change ownership or trust level' using errcode = '42501';
  end if;

  if new.verification is distinct from old.verification then
    -- The only change a founder may make: submit (or resubmit) for review.
    if old.verification in ('unverified', 'rejected') and new.verification = 'pending' then
      if not (
        exists (select 1 from public.documents where business_id = old.id and type = 'id' and status in ('pending', 'verified'))
        and exists (select 1 from public.documents where business_id = old.id and type = 'bank_statement' and status in ('pending', 'verified'))
      ) then
        raise exception 'Upload your ID document and a bank statement before submitting for review'
          using errcode = '23514';
      end if;
    else
      raise exception 'Only an administrator can change verification' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Every change of verification status or trust tier is recorded, whoever or whatever made it.
create or replace function public.audit_business_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification is distinct from old.verification or new.trust_tier is distinct from old.trust_tier then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (
      auth.uid(), 'business.verification_changed', 'businesses', new.id::text,
      jsonb_build_object('from', old.verification, 'to', new.verification, 'trust_tier', new.trust_tier)
    );
  end if;
  return null;
end;
$$;

create trigger audit_business_changes_trg
  after update on public.businesses
  for each row execute function public.audit_business_changes();

-- ---------- 3. Administrator decisions ----------
-- Trust tiers: 1 = identity approved; 2 = identity + proof of trading (bank statement), which makes
-- the business public ('verified'); 3 = also CIPC-registered.
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
    v_status := 'pending';   -- still waiting on other required documents
  else
    v_status := 'rejected';  -- nothing left to review and a required document is missing
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

-- Administrators opening a document (which may be an ID) is itself recorded.
create or replace function public.log_document_view(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  select auth.uid(), 'document.viewed', 'documents', d.id::text, jsonb_build_object('business_id', d.business_id, 'type', d.type)
    from public.documents d where d.id = p_document_id;
end;
$$;

revoke all on function public.review_document(uuid, boolean, text) from public, anon;
grant execute on function public.review_document(uuid, boolean, text) to authenticated;
revoke all on function public.log_document_view(uuid) from public, anon;
grant execute on function public.log_document_view(uuid) to authenticated;

-- ---------- 4. Private file storage ----------
-- Files live at <business id>/<file>. A founder may add, read and (until approved) delete files only
-- in their own business's folder; administrators may read everything. No one may overwrite a file.
create policy "kk_documents_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('business-documents', 'identity-documents')
    and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id = auth.uid())
  );

create policy "kk_documents_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('business-documents', 'identity-documents')
    and (
      public.is_admin()
      or (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id = auth.uid())
    )
  );

create policy "kk_documents_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('business-documents', 'identity-documents')
    and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id = auth.uid())
    and not exists (select 1 from public.documents d where d.storage_path = name and d.status = 'verified')
  );
