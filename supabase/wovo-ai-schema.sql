create extension if not exists pgcrypto;

create table if not exists public.business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  business_type text,
  city text,
  phone text,
  website text,
  brand_tone text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.business_settings enable row level security;

drop policy if exists "business_settings_select_own" on public.business_settings;
drop policy if exists "business_settings_insert_own" on public.business_settings;
drop policy if exists "business_settings_update_own" on public.business_settings;

create policy "business_settings_select_own"
on public.business_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy "business_settings_insert_own"
on public.business_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "business_settings_update_own"
on public.business_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input jsonb not null,
  output jsonb not null,
  created_at timestamptz default now()
);

alter table public.generations enable row level security;

drop policy if exists "generations_select_own" on public.generations;
drop policy if exists "generations_insert_own" on public.generations;

create policy "generations_select_own"
on public.generations
for select
to authenticated
using (auth.uid() = user_id);

create policy "generations_insert_own"
on public.generations
for insert
to authenticated
with check (auth.uid() = user_id);
