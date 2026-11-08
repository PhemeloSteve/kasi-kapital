# Kasi Kapital — Admin Improvements Implementation Guide

This document is a self-contained brief for a Claude session. It describes six improvements
to the admin panel of Kasi Kapital, what already exists, and exactly how to build each one.
Hand this file to Claude along with the project zip and say:
"Implement the improvements in ADMIN_IMPROVEMENTS.md."

---

## Project context

**Stack:** Next.js 15 (App Router, TypeScript), Supabase (Postgres + PostGIS + Storage),
Tailwind CSS, Zod, Vitest.

**Architecture:** Layered — `src/domain/` (pure rules), `src/application/` (use cases + ports),
`src/infrastructure/` (Supabase adapters), `src/app/` (pages + server actions),
`src/components/` (UI). The database enforces every security rule; the app enforces the same
rules a second time. Never bypass the database rules from the app.

**What already exists:**
- `public.audit_log` table with columns `id`, `actor_id`, `action`, `entity`, `entity_id`,
  `details` (jsonb), `created_at`
- `public.is_admin()` database function — returns true only when the signed-in token has
  `aal2` (two-factor login) AND the profile role is `admin`
- `src/app/_lib/guard.ts` — `requireUser(roles, options)` server-side guard
- `src/app/admin/page.tsx` — the existing admin page (document queue, proof queue, payouts)
- `src/app/admin/actions.ts` — server actions for reviewing documents, proof and payouts
- `src/components/DashboardShell.tsx` — the app shell (takes `role`, `name`, `title`,
  `subtitle`, `actions`, `narrow`, `children`)
- Design tokens: `brand` (deep green #0B3B24), `brand-cream` (#FDFBF7),
  `brand-light` (soft green), `brand-border`. Use `card` class for white bordered panels,
  `btn-primary` for green buttons, `btn-secondary` for outline buttons, `input` for fields.
- Tests: Vitest for domain + application layers, SQL tests in `supabase/tests/`.
  Run `npm run check` to verify everything passes before finishing.

---

## Improvement 1 — Audit dashboard

### What to build
A page at `/admin/audit` that shows every admin action in a filterable, paginated table.
Admins must already be authenticated with two-factor (the existing guard handles this).

### Database (migration 0009_admin_improvements.sql)

```sql
-- Only admins may read audit_log directly.
create policy "audit_log_admin_only" on public.audit_log
  for select using (public.is_admin());
```

### Port (add to src/application/ports.ts)

```typescript
export type AuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string;
  actorName: string | null;
  details: Record<string, unknown>;
};

export type AuditFilters = {
  action: string | null;
  entity: string | null;
  page: number;
};

export interface AuditStore {
  list(filters: AuditFilters): Promise<{ items: AuditEntry[]; hasMore: boolean }>;
}
```

### Supabase store (src/infrastructure/supabase/audit-store.ts)

Fetch from `audit_log` joined with `profiles` for the actor name.
Order by `created_at` descending. Page size 25. Filter by `action` and `entity` when provided.
Return `hasMore: true` when the query returns more than the page size.

### Page (src/app/admin/audit/page.tsx)

A table with four columns: When (formatted date), Admin (actor name), Action (colour-coded
by type), Entity (entity name + first 8 chars of entity_id). Previous/Next page links.
Requires `requireUser(["admin"])`. Show "No audit entries yet" when empty.

### Wire navigation — update navForRole in src/components/shell/nav.ts

```typescript
case "admin":
  return [
    { href: "/admin", label: "Review queue" },
    { href: "/admin/audit", label: "Audit log" },
    { href: "/admin/businesses", label: "Businesses" },
    { href: "/admin/users", label: "Users" },
  ];
```

---

## Improvement 2 — Admin permission levels

### What to build
Two admin levels: `reviewer` (documents and proof only) and `super_admin` (everything).

### Database (add to migration 0009)

```sql
alter table public.profiles
  add column if not exists admin_level text
  check (admin_level in ('reviewer', 'super_admin'))
  default null;

update public.profiles set admin_level = 'super_admin' where role = 'admin';

create or replace function public.is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and admin_level = 'super_admin'
  ) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
```

### Port addition

Extend `CurrentUser` in `src/application/ports.ts` with `adminLevel: "reviewer" | "super_admin" | null`.

### Guard

Pass `adminLevel` through `requireUser` → `getCurrentUser` → the auth gateway so pages can
check it.

### UI

In `navForRole`, accept an optional `adminLevel` parameter. Show audit, businesses and users
links only when `adminLevel === "super_admin"`. Hide the payout button on the admin page for
reviewers.

---

## Improvement 3 — Business and user management

### What to build

#### /admin/businesses
Table of all businesses: name, owner, verification badge, trust tier, goal count, and either
a Suspend form (with a reason input) or a Reinstate button.

#### /admin/users
Table of all accounts: name, email, role, KYC status, total contributed. Super admin only.

### Database (add to migration 0009)

```sql
create or replace function public.suspend_business(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reason required' using errcode = '22023';
  end if;
  update public.businesses set verification = 'suspended' where id = p_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'business.suspended', 'businesses', p_id::text,
          jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.unsuspend_business(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  update public.businesses set verification = 'pending' where id = p_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'business.unsuspended', 'businesses', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.suspend_business(uuid, text) from public, anon, authenticated;
grant execute on function public.suspend_business(uuid, text) to authenticated;
revoke all on function public.unsuspend_business(uuid) from public, anon, authenticated;
grant execute on function public.unsuspend_business(uuid) to authenticated;
```

### Server actions (src/app/admin/businesses/actions.ts)

`suspendBusinessAction` and `unsuspendBusinessAction` — both call `requireUser(["admin"])`,
call the matching database function, and redirect with a notice or error query param.

### Pages

`src/app/admin/businesses/page.tsx` — query businesses with owner name and goal count.
`src/app/admin/users/page.tsx` — query profiles with role, KYC status, contribution total.
Both require `requireUser(["admin"])`. Both use `DashboardShell`.

---

## Improvement 4 — Proof queue count in page title

### What to build
Dynamic metadata on `/admin/page.tsx` that includes the pending item count in the browser tab.

### Implementation

```typescript
// At the top of src/app/admin/page.tsx, fetch counts and export:
export async function generateMetadata() {
  // requireUser is called in the page; metadata runs in parallel so guard separately.
  // Simplest: query pending counts via the existing stores.
  const [proofs, docs] = await Promise.all([
    createMilestoneStore().listProofQueue(),
    createDocumentStore().listReviewQueue(),
  ]);
  const total = proofs.length + docs.length;
  return {
    title: total > 0 ? `Review queue (${total}) | Kasi Kapital` : "Review queue | Kasi Kapital",
  };
}
```

---

## Improvement 5 — Platform stats panel

### What to build
Four stat cards at the top of `/admin`: total businesses, verified businesses, open goals,
held in escrow (with paid-out total as a note).

### Database (add to migration 0009)

```sql
create or replace function public.platform_stats()
returns table (
  total_businesses bigint,
  verified_businesses bigint,
  pending_businesses bigint,
  open_goals bigint,
  held_cents bigint,
  paid_out_cents bigint
)
language sql security definer stable set search_path = public as $$
  select
    count(*),
    count(*) filter (where verification = 'verified'),
    count(*) filter (where verification = 'pending'),
    (select count(*) from public.funding_goals where is_open),
    coalesce((select sum(amount_cents) from public.contributions where status = 'held'), 0),
    coalesce((select sum(amount_cents) from public.payouts where status = 'paid'), 0)
  from public.businesses;
$$;
revoke all on function public.platform_stats() from public, anon;
grant execute on function public.platform_stats() to authenticated;
```

### UI

Call `supabase.rpc("platform_stats")` in the admin page. Render four `StatCard` components
above the existing proof queue section. Use icons from `lucide-react`.

---

## Improvement 6 — Notifications (email on new submission)

### What to build
An API route that receives a Supabase Database Webhook and sends an email to the admin when a
business is submitted for verification or milestone proof is uploaded. No extra service needed
beyond a free Resend account.

### API route (src/app/api/webhooks/admin-notify/route.ts)

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // In production, verify the webhook secret from WEBHOOK_SECRET env var.
  const body = await request.json();
  const { table, record } = body as { table: string; record: Record<string, unknown> };

  const subject =
    table === "businesses"
      ? `New business submitted for verification: ${record.name}`
      : `Milestone proof submitted`;

  // Wire to Resend, SendGrid or any email provider here.
  console.log("[webhook] admin notification:", subject);

  return NextResponse.json({ ok: true });
}
```

### Supabase webhook setup (manual, in the dashboard)

1. Database → Webhooks → Create webhook
2. For verification: table `businesses`, event `UPDATE`,
   condition `NEW.verification = 'pending'`,
   URL `https://your-vercel-url.vercel.app/api/webhooks/admin-notify`
3. For proof: table `milestones`, event `UPDATE`,
   condition `NEW.status = 'proof_submitted'`, same URL
4. Add a `WEBHOOK_SECRET` env var to Vercel and verify it in the route

---

## Migration file summary

All database changes go into one file:

```
supabase/migrations/0009_admin_improvements.sql
```

Order:
1. `is_super_admin()` function
2. `admin_level` column on `profiles`
3. `update public.profiles set admin_level = 'super_admin' where role = 'admin'`
4. `suspend_business()` function
5. `unsuspend_business()` function
6. `platform_stats()` function
7. RLS policy for `audit_log`

---

## Testing checklist

After implementing, verify:

- [ ] `/admin/audit` shows entries, paginates, requires two-factor
- [ ] A reviewer admin cannot see `/admin/audit`, `/admin/users` or trigger payouts
- [ ] Suspending a business writes to `audit_log` and the business disappears from discovery
- [ ] Unsuspending a business restores it to `pending`
- [ ] Platform stats panel shows correct numbers
- [ ] Browser tab shows pending count when items are waiting
- [ ] All existing tests still pass: `npm run check`
- [ ] New database tests added for `suspend_business` and `platform_stats`

---

## How to use this with Claude

1. Open a new Claude session (Pro recommended for long builds).
2. Attach the latest `kasi-kapital.zip`.
3. Paste this prompt:

```
I have a Next.js 15 / Supabase project called Kasi Kapital.
The zip attached contains the full source code.
Please implement the improvements described in
docs/admin-improvements/ADMIN_IMPROVEMENTS.md, which is inside the zip.
Build them in order (1 to 6), write tests for each one, and run
npm run check after each improvement before moving to the next.
Package the result as a new zip when done.
```

4. If the session runs long, say "continue from improvement N" and Claude picks up from there.

---

## File locations reference

| What | Where |
|---|---|
| Existing admin page | `src/app/admin/page.tsx` |
| Existing admin actions | `src/app/admin/actions.ts` |
| Guard | `src/app/_lib/guard.ts` |
| Navigation | `src/components/shell/nav.ts` |
| Ports (interfaces) | `src/application/ports.ts` |
| Supabase stores | `src/infrastructure/supabase/` |
| DashboardShell | `src/components/DashboardShell.tsx` |
| StatCard | `src/components/ui/StatCard.tsx` |
| Migrations | `supabase/migrations/` |
| DB tests | `supabase/tests/` |
| Design tokens | `tailwind.config.ts` and `src/app/globals.css` |
