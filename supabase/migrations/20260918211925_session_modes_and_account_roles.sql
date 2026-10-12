alter table public.profiles
  add column if not exists account_role text,
  add column if not exists last_session_mode text,
  add column if not exists session_mode_reassignment_seen boolean not null default false;

alter table public.profiles drop constraint if exists profiles_account_role_check;
alter table public.profiles add constraint profiles_account_role_check
  check (account_role is null or account_role in ('rider', 'driver', 'both'));

alter table public.profiles drop constraint if exists profiles_last_session_mode_check;
alter table public.profiles add constraint profiles_last_session_mode_check
  check (last_session_mode is null or last_session_mode in ('rider', 'driver'));

alter table public.profiles drop constraint if exists profiles_role_session_mode_check;
alter table public.profiles add constraint profiles_role_session_mode_check
  check (account_role is null or account_role <> 'rider' or last_session_mode is null or last_session_mode = 'rider');

alter table public.profiles drop constraint if exists profiles_role_driver_capability_check;
alter table public.profiles add constraint profiles_role_driver_capability_check
  check (account_role is null or (account_role = 'rider' and coalesce(is_driver, false) = false) or (account_role in ('driver', 'both') and coalesce(is_driver, false) = true));

alter policy "Users can update own profile" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);