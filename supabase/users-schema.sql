-- Reference schema for wovo-media users table
create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  name text,
  image text,
  stripe_customer_id text,
  subscription_status text,
  subscription_id text,
  price_id text,
  plan text,
  credits_remaining integer default 0,
  weekly_limit integer default 0,
  created_at timestamptz default now() not null
);
