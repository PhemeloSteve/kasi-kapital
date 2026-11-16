-- Step 10: retention. Rejected documents and proof files are not kept for ever.
--
-- Deleting a document is two jobs: the stored file (which only the storage service can delete) and the
-- database record. The server does the first, so these two functions bracket it:
--   documents_due_for_purge()  lists what has expired
--   finish_document_purge()    deletes the records, once their files are gone, and logs each one
-- Only the server (service role) may call them; no signed-in person can.

insert into public.platform_settings (key, int_value, note) values
  ('retention_rejected_document_days', 30,
   'Rejected documents and proof files are deleted this many days after they were rejected')
on conflict (key) do nothing;

-- A document is due when it was rejected, and was rejected longer ago than the retention period.
create or replace function public.documents_due_for_purge(p_limit integer default 200)
returns table (id uuid, doc_type text, storage_path text)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.type::text, d.storage_path
    from public.documents d
   where d.status = 'rejected'
     and d.reviewed_at is not null
     and d.reviewed_at < now() - make_interval(
           days => public.setting('retention_rejected_document_days')::integer)
   order by d.reviewed_at
   limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

-- Deletes the records of expired documents and writes one audit entry for each. It re-checks every
-- document itself, so a document that was approved in the meantime, or was never due, is left alone
-- even if its id is passed in. Returns how many records were deleted.
create or replace function public.finish_document_purge(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- A rejected proof may still be a milestone's current proof. The founder will have to send new proof.
  update public.milestones m
     set proof_document_id = null
   where m.proof_document_id = any (p_ids)
     and exists (
       select 1 from public.documents d
        where d.id = m.proof_document_id
          and d.status = 'rejected'
          and d.reviewed_at < now() - make_interval(
                days => public.setting('retention_rejected_document_days')::integer));

  with deleted as (
    delete from public.documents d
     where d.id = any (p_ids)
       and d.status = 'rejected'
       and d.reviewed_at is not null
       and d.reviewed_at < now() - make_interval(
             days => public.setting('retention_rejected_document_days')::integer)
    returning d.id, d.type
  ), logged as (
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    select null, 'document.purged', 'documents', deleted.id::text,
           jsonb_build_object('reason', 'rejected_retention', 'type', deleted.type::text)
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
