-- Keep the legacy CustomCup auth hook from blocking unrelated applications
-- when its product table is not installed in this Supabase project.
create or replace function public.customcup_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_login text;
  v_name text;
  v_avatar text;
begin
  if to_regclass('public.customcup_players') is null then
    return new;
  end if;

  v_login := new.raw_user_meta_data->>'preferred_username';
  v_name := coalesce(new.raw_user_meta_data->>'full_name', v_login, 'Player');
  v_avatar := new.raw_user_meta_data->>'avatar_url';

  insert into public.customcup_players (auth_user_id, display_name, twitch_login, avatar_url)
  values (new.id, v_name, lower(v_login), v_avatar)
  on conflict (auth_user_id) do update
    set twitch_login = excluded.twitch_login,
        avatar_url = excluded.avatar_url;

  return new;
end;
$function$;
