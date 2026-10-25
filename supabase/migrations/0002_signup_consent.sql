-- Record POPIA consent at sign-up. The timestamp is set by the database, not the client,
-- and the full name is trimmed and length-limited. Admin can still never be self-assigned.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  consented boolean := coalesce((new.raw_user_meta_data ->> 'popia_consent') = 'true', false);
begin
  insert into public.profiles (id, role, full_name, popia_consent_at)
  values (
    new.id,
    case when requested in ('business', 'investor', 'donor') then requested::user_role else 'investor' end,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 100), ''),
    case when consented then now() else null end
  );
  return new;
end;
$$;
