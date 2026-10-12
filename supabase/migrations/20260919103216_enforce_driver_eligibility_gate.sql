create or replace function public.enforce_driver_session_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_session_mode = 'driver' then
    if not exists (
      select 1
      from public.identity_verifications
      where user_id = new.id
        and status = 'verified'
    ) or not exists (
      select 1
      from public.driver_eligibility
      where user_id = new.id
        and overall_status = 'approved'
    ) then
      raise exception 'Driver mode requires approved identity and Driver Eligibility.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_driver_session_eligibility() from public;
revoke all on function public.enforce_driver_session_eligibility() from anon;
revoke all on function public.enforce_driver_session_eligibility() from authenticated;

drop trigger if exists enforce_driver_session_eligibility on public.profiles;
create trigger enforce_driver_session_eligibility
  before insert or update of last_session_mode
  on public.profiles
  for each row
  execute function public.enforce_driver_session_eligibility();