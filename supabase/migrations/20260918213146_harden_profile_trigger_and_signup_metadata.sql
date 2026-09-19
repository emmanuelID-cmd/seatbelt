create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role text := case new.raw_user_meta_data->>'account_role'
    when 'rider' then 'rider'
    when 'driver' then 'driver'
    when 'both' then 'both'
    else null
  end;
begin
  insert into public.profiles (
    id,
    full_name,
    avatar_initials,
    car_make,
    car_model,
    car_year,
    is_driver,
    account_role,
    last_session_mode,
    session_mode_reassignment_seen,
    rating,
    total_rides
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(upper(left(new.raw_user_meta_data->>'full_name', 2)), 'NU'),
    case when selected_role in ('driver', 'both') then coalesce(new.raw_user_meta_data->>'car_make', '') else '' end,
    case when selected_role in ('driver', 'both') then coalesce(new.raw_user_meta_data->>'car_model', '') else '' end,
    case when selected_role in ('driver', 'both') then coalesce(new.raw_user_meta_data->>'car_year', '') else '' end,
    selected_role in ('driver', 'both'),
    selected_role,
    null,
    true,
    5.0,
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;