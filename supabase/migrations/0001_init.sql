-- Kasi Kapital: initial schema with Row Level Security.
-- Review every policy before production. Money amounts are stored in ZAR cents.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Enums ----------
create type user_role as enum ('business', 'investor', 'donor', 'admin');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'suspended');
create type contribution_kind as enum ('donation', 'presale', 'equity', 'revenue_share');
create type contribution_status as enum ('pending', 'held', 'released', 'refunded', 'failed');
create type milestone_status as enum ('pending', 'proof_submitted', 'approved', 'rejected');
create type document_type as enum ('id', 'cipc', 'bank_statement', 'tax_return', 'invoice', 'other');

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'investor',
  full_name text,
  kyc_status verification_status not null default 'unverified',
  popia_consent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Helper (defined after profiles, because the function body reads that table).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create a profile on signup. Admin can never be self-assigned.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    case when requested in ('business', 'investor', 'donor') then requested::user_role else 'investor' end,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may not change their own role or verification status.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.kyc_status := old.kyc_status;
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns_trg
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------- Businesses ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null,                       -- tuck shop, chicken farm, bakery, ...
  description text,
  suburb text,                                  -- public location precision: suburb/ward only
  location extensions.geography(point, 4326),              -- approximate, never a home address
  cipc_number text,
  verification verification_status not null default 'unverified',
  trust_tier smallint not null default 0 check (trust_tier between 0 and 3),
  youtube_url text,
  facebook_url text,
  linkedin_url text,
  created_at timestamptz not null default now()
);
create index businesses_location_idx on public.businesses using gist (location);
create index businesses_category_idx on public.businesses (category);

-- ---------- Documents (private) ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type document_type not null,
  storage_path text not null,                   -- path in a private bucket
  status verification_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Funding goals and milestones ----------
create table public.funding_goals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  target_cents bigint not null check (target_cents > 0),
  kind contribution_kind not null default 'donation',
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.funding_goals(id) on delete cascade,
  title text not null,
  amount_cents bigint not null check (amount_cents > 0),
  status milestone_status not null default 'pending',
  proof_document_id uuid references public.documents(id),
  created_at timestamptz not null default now()
);

-- ---------- Contributions ----------
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.funding_goals(id) on delete restrict,
  contributor_id uuid not null references public.profiles(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  kind contribution_kind not null,
  status contribution_status not null default 'pending',
  provider_reference text,                      -- payment provider reference; never card data
  created_at timestamptz not null default now()
);

-- ---------- Reports and audit ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.businesses     enable row level security;
alter table public.documents      enable row level security;
alter table public.funding_goals  enable row level security;
alter table public.milestones     enable row level security;
alter table public.contributions  enable row level security;
alter table public.reports        enable row level security;
alter table public.audit_log      enable row level security;

-- Profiles: own row or admin
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Businesses: public can see verified ones; owners see and manage their own; admins see all
create policy "businesses_public_read" on public.businesses
  for select using (verification = 'verified' or owner_id = auth.uid() or public.is_admin());
create policy "businesses_owner_insert" on public.businesses
  for insert with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'business')
  );
create policy "businesses_owner_update" on public.businesses
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Documents: only the owner and admins (never public)
create policy "documents_owner_or_admin_read" on public.documents
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy "documents_owner_insert" on public.documents
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy "documents_admin_update" on public.documents
  for update using (public.is_admin());

-- Funding goals and milestones: readable when the business is visible
create policy "goals_read" on public.funding_goals
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id
            and (b.verification = 'verified' or b.owner_id = auth.uid() or public.is_admin()))
  );
create policy "goals_owner_write" on public.funding_goals
  for all using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "milestones_read" on public.milestones
  for select using (
    exists (
      select 1 from public.funding_goals g join public.businesses b on b.id = g.business_id
      where g.id = goal_id and (b.verification = 'verified' or b.owner_id = auth.uid() or public.is_admin())
    )
  );
create policy "milestones_owner_write" on public.milestones
  for all using (
    exists (
      select 1 from public.funding_goals g join public.businesses b on b.id = g.business_id
      where g.id = goal_id and b.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.funding_goals g join public.businesses b on b.id = g.business_id
      where g.id = goal_id and b.owner_id = auth.uid()
    )
  );

-- Contributions: contributor sees their own; business owner sees contributions to their goals; admin sees all.
-- Inserts and status changes happen server-side (service role) after KYC and limit checks.
create policy "contributions_read" on public.contributions
  for select using (
    contributor_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.funding_goals g join public.businesses b on b.id = g.business_id
      where g.id = goal_id and b.owner_id = auth.uid()
    )
  );

-- Reports: reporters create and read their own; admins read all
create policy "reports_insert" on public.reports
  for insert with check (reporter_id = auth.uid());
create policy "reports_read" on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());

-- Audit log: admins read only; writes via service role
create policy "audit_admin_read" on public.audit_log
  for select using (public.is_admin());
