create table if not exists public.wovo_public_inquiry_replies (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.wovo_public_inquiries(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('owner', 'admin', 'manager', 'support')),
  message text not null check (char_length(message) between 1 and 5000),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'delivered', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists wovo_public_inquiry_replies_case_idx
  on public.wovo_public_inquiry_replies(inquiry_id, created_at);

alter table public.wovo_public_inquiry_replies enable row level security;
revoke all on public.wovo_public_inquiry_replies from anon, authenticated;

create policy wovo_public_inquiry_replies_no_direct_access
on public.wovo_public_inquiry_replies for all to anon, authenticated
using (false)
with check (false);

comment on table public.wovo_public_inquiry_replies is
  'Server-only delivery history for replies to tenant-neutral public inquiries. Access is mediated by the authenticated WOVO portal.';
