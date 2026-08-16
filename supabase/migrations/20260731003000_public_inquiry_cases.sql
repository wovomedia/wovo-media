create table if not exists public.wovo_public_inquiries (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique default (
    'WOVO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 320),
  phone text check (phone is null or char_length(phone) between 7 and 40),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  consent_confirmed boolean not null default true,
  status text not null default 'open' check (status in ('open', 'in_progress', 'replied', 'resolved', 'spam')),
  assigned_role text check (assigned_role is null or assigned_role in ('owner', 'admin', 'manager', 'support')),
  staff_reply text check (staff_reply is null or char_length(staff_reply) between 1 and 5000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wovo_public_inquiries_created_idx
  on public.wovo_public_inquiries(created_at desc);

create index if not exists wovo_public_inquiries_case_reference_idx
  on public.wovo_public_inquiries(case_reference);

alter table public.wovo_public_inquiries enable row level security;
revoke all on public.wovo_public_inquiries from anon, authenticated;

create policy wovo_public_inquiries_no_direct_client_access
on public.wovo_public_inquiries for all to anon, authenticated
using (false)
with check (false);
