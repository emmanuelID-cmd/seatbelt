update public.profiles
set last_session_mode = 'rider'
where last_session_mode = 'driver'
  and (
    not exists (
      select 1
      from public.identity_verifications
      where user_id = profiles.id
        and status = 'verified'
    )
    or not exists (
      select 1
      from public.driver_eligibility
      where user_id = profiles.id
        and overall_status = 'approved'
    )
  );