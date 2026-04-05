alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create table if not exists public.user_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  following_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, following_user_id),
  constraint user_follows_no_self check (follower_user_id <> following_user_id)
);

create index if not exists user_follows_following_idx on public.user_follows (following_user_id, created_at desc);
create index if not exists user_follows_follower_idx on public.user_follows (follower_user_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_post_idx on public.post_likes (post_id, created_at desc);
create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_content_length check (char_length(content) between 1 and 500)
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at desc);
create index if not exists post_comments_user_idx on public.post_comments (user_id, created_at desc);

alter table public.user_follows enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists user_follows_select_all on public.user_follows;
drop policy if exists user_follows_insert_own on public.user_follows;
drop policy if exists user_follows_delete_own on public.user_follows;

create policy user_follows_select_all
on public.user_follows
for select
to authenticated
using (true);

create policy user_follows_insert_own
on public.user_follows
for insert
to authenticated
with check (auth.uid() = follower_user_id);

create policy user_follows_delete_own
on public.user_follows
for delete
to authenticated
using (auth.uid() = follower_user_id);

drop policy if exists post_likes_select_all on public.post_likes;
drop policy if exists post_likes_insert_own on public.post_likes;
drop policy if exists post_likes_delete_own on public.post_likes;

create policy post_likes_select_all
on public.post_likes
for select
to authenticated
using (true);

create policy post_likes_insert_own
on public.post_likes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy post_likes_delete_own
on public.post_likes
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists post_comments_select_all on public.post_comments;
drop policy if exists post_comments_insert_own on public.post_comments;
drop policy if exists post_comments_update_own on public.post_comments;
drop policy if exists post_comments_delete_own on public.post_comments;

create policy post_comments_select_all
on public.post_comments
for select
to authenticated
using (true);

create policy post_comments_insert_own
on public.post_comments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy post_comments_update_own
on public.post_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy post_comments_delete_own
on public.post_comments
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, delete on public.user_follows to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;
