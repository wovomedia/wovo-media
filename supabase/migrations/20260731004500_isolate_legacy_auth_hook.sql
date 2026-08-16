-- The shared Supabase project still has a legacy CustomCup auth hook.
-- WOVO email accounts do not carry a CustomCup preferred_username and must
-- never be blocked by uniqueness or optional-product failures.
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

  v_login := nullif(trim(new.raw_user_meta_data->>'preferred_username'), '');
  if v_login is null then
    return new;
  end if;

  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), v_login);
  v_avatar := new.raw_user_meta_data->>'avatar_url';

  insert into public.customcup_players (auth_user_id, display_name, twitch_login, avatar_url)
  values (new.id, v_name, lower(v_login), v_avatar)
  on conflict do nothing;

  return new;
exception
  when others then
    -- This optional legacy profile must never abort creation of an auth user.
    return new;
end;
$function$;
