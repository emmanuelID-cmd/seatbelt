-- Gender remains in private account details. U.S. ID-number checks, including
-- an SSN when selected, are available only in the Driver Eligibility flow and
-- are entered with Stripe; Seatbelt never stores the number.
alter table public.account_details
  add column if not exists gender text not null default ''
  check (char_length(gender) <= 64);

alter table public.identity_verifications
  add column if not exists verification_method text not null default 'document'
  check (verification_method in ('document', 'id_number'));
alter table public.identity_verifications
  alter column stripe_verification_session_id drop not null;

create table public.driver_license_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_verification_session_id text unique,
  status text not null default 'requires_input'
    check (status in ('requires_input', 'processing', 'verified', 'canceled')),
  license_expires_on date,
  last_error_code text,
  last_error_message text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint driver_license_expiry_requires_verification
    check (license_expires_on is null or status = 'verified')
);

alter table public.driver_license_verifications enable row level security;
revoke all on public.driver_license_verifications from public, anon, authenticated;
grant select on public.driver_license_verifications to authenticated;
grant all on public.driver_license_verifications to service_role;
create policy driver_license_verifications_read_own
  on public.driver_license_verifications for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.driver_eligibility_identity_checks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_verification_session_id text unique,
  status text not null default 'requires_input'
    check (status in ('requires_input', 'processing', 'verified', 'canceled')),
  last_error_code text,
  last_error_message text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.driver_eligibility_identity_checks enable row level security;
revoke all on public.driver_eligibility_identity_checks from public, anon, authenticated;
grant select on public.driver_eligibility_identity_checks to authenticated;
grant all on public.driver_eligibility_identity_checks to service_role;
create policy driver_eligibility_identity_checks_read_own
  on public.driver_eligibility_identity_checks for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.identity_session_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('identity', 'driver_license', 'driver_eligibility')),
  next_allowed_at timestamptz not null,
  primary key (user_id, purpose)
);
alter table public.identity_session_rate_limits enable row level security;
revoke all on public.identity_session_rate_limits from public, anon, authenticated;
grant all on public.identity_session_rate_limits to service_role;

create function public.claim_identity_session_slot(p_user_id uuid, p_purpose text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed_user uuid;
begin
  if p_user_id is null or p_purpose not in ('identity', 'driver_license', 'driver_eligibility') then
    return false;
  end if;
  insert into public.identity_session_rate_limits(user_id, purpose, next_allowed_at)
    values (p_user_id, p_purpose, now() + interval '1 minute')
  on conflict (user_id, purpose) do update
    set next_allowed_at = now() + interval '1 minute'
    where public.identity_session_rate_limits.next_allowed_at <= now()
  returning user_id into claimed_user;
  return claimed_user is not null;
end;
$$;
revoke all on function public.claim_identity_session_slot(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_identity_session_slot(uuid,text) to service_role;

-- Existing Identity sessions were restricted to driving licenses, so retain
-- them as both a general identity proof and a license-specific proof. Expiry
-- remains null until confirmed from Stripe's restricted results API.
insert into public.driver_license_verifications (
  user_id, stripe_verification_session_id, status, last_error_code,
  last_error_message, started_at, submitted_at, verified_at, updated_at
)
select user_id, stripe_verification_session_id, status, last_error_code,
  last_error_message, started_at, submitted_at, verified_at, updated_at
from public.identity_verifications
on conflict (user_id) do nothing;

create or replace function public.update_platform_account(p_user_id uuid, p_details jsonb, p_preferences jsonb, p_notifications jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare d public.account_details; p public.account_preferences; n public.notification_preferences;
begin
  select * into strict p from public.account_preferences where user_id=p_user_id for update;
  if p_details is not null then
    select * into strict d from public.account_details where user_id=p_user_id for update;
    d := jsonb_populate_record(d,p_details);
    if btrim(d.legal_name)='' or btrim(d.address_line1)='' or btrim(d.city)='' or btrim(d.postal_code)=''
      or d.date_of_birth is null or d.date_of_birth<date '1900-01-01' or d.date_of_birth>current_date-interval '18 years'
      or (d.country='US' and (btrim(d.region)='' or d.postal_code !~ '^[0-9]{5}(-[0-9]{4})?$'))
      or (d.phone<>'' and d.phone !~ '^\([0-9]{3}\)-[0-9]{3}-[0-9]{4}$') then
      raise exception 'invalid_account_details';
    end if;
    update public.account_details set legal_name=d.legal_name,address_line1=d.address_line1,
      address_line2=d.address_line2,city=d.city,region=d.region,postal_code=d.postal_code,
      country=d.country,date_of_birth=d.date_of_birth,phone=d.phone,social_handle=d.social_handle,
      gender=d.gender,updated_at=now() where user_id=p_user_id;
  end if;
  if p_preferences is not null then
    p := jsonb_populate_record(p,p_preferences);
    if p.account_state <> 'active' and (p.location_sharing or p.presence_status <> 'offline') then
      raise exception 'inactive_account';
    end if;
    update public.account_preferences set presence_status=p.presence_status,
      location_sharing=p.location_sharing,preferred_currency=p.preferred_currency,updated_at=now()
      where user_id=p_user_id;
    if not p.location_sharing and to_regclass('public.location_presence') is not null then
      delete from public.location_presence where user_id=p_user_id;
    end if;
  end if;
  if p_notifications is not null then
    select * into strict n from public.notification_preferences where user_id=p_user_id for update;
    n := jsonb_populate_record(n,p_notifications);
    update public.notification_preferences set rider_messages_in_app=n.rider_messages_in_app,
      rider_messages_email=n.rider_messages_email,rider_messages_sms=n.rider_messages_sms,
      driver_messages_in_app=n.driver_messages_in_app,driver_messages_email=n.driver_messages_email,
      driver_messages_sms=n.driver_messages_sms,browser_alerts=n.browser_alerts,newsletter=n.newsletter,
      updates=n.updates,promotions=n.promotions,payment_reminders=n.payment_reminders,updated_at=now()
      where user_id=p_user_id;
  end if;
  insert into public.account_events(user_id,event_type) values(p_user_id,'account_updated');
  insert into public.user_notifications(user_id,category,title,body,email_required)
    values(p_user_id,'security','Account settings updated',
      'Your Seatbelt account settings changed. Sign in to review your account. If you did not make this change, contact support.',true);
end;
$$;
revoke all on function public.update_platform_account(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.update_platform_account(uuid,jsonb,jsonb,jsonb) to service_role;

create or replace function public.enforce_driver_session_eligibility()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.last_session_mode='driver' then
    if not exists(select 1 from public.account_preferences where user_id=new.id and account_state='active')
      or not exists(select 1 from public.account_details where user_id=new.id and legal_name<>'' and address_line1<>'' and city<>'' and postal_code<>'' and date_of_birth<=current_date-interval '18 years')
      or not exists(select 1 from public.identity_verifications where user_id=new.id and status='verified')
      or not exists(select 1 from public.driver_license_verifications where user_id=new.id and status='verified' and license_expires_on>=current_date)
      or not exists(select 1 from public.driver_eligibility where user_id=new.id and overall_status='approved'
        and registration_status='approved' and insurance_status='approved'
        and registration_expires_on>=current_date and insurance_expires_on>=current_date) then
      raise exception 'Driver mode requires an active, complete account and verified, unexpired Driver License and eligibility.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_driver_session_eligibility() from public,anon,authenticated;

create or replace function public.seatbelt_driver_eligible(p_user uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles where id=p_user and account_role in ('driver','both'))
 and public.platform_account_complete(p_user)
 and exists(select 1 from public.account_preferences where user_id=p_user and account_state='active')
 and exists(select 1 from public.identity_verifications where user_id=p_user and status='verified')
 and exists(select 1 from public.driver_license_verifications where user_id=p_user and status='verified' and license_expires_on>=current_date)
 and exists(select 1 from public.driver_eligibility where user_id=p_user and overall_status='approved'
   and registration_status='approved' and insurance_status='approved'
   and registration_expires_on>=current_date and insurance_expires_on>=current_date);
$$;
revoke all on function public.seatbelt_driver_eligible(uuid) from public,anon,authenticated;
grant execute on function public.seatbelt_driver_eligible(uuid) to service_role;

create or replace function public.location_driver_eligible(p_user_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.account_preferences a on a.user_id = p.id
    join public.identity_verifications v on v.user_id = p.id
    join public.driver_license_verifications i on i.user_id = p.id
    join public.driver_eligibility e on e.user_id = p.id
    where p.id = p_user_id
      and p.account_role in ('driver', 'both') and p.last_session_mode = 'driver'
      and a.account_state = 'active'
      and v.status = 'verified'
      and public.platform_account_complete(p_user_id)
      and i.status = 'verified' and i.license_expires_on >= current_date
      and e.overall_status = 'approved'
      and e.registration_status = 'approved' and e.insurance_status = 'approved'
      and e.registration_expires_on > (now() at time zone 'UTC')::date
      and e.insurance_expires_on > (now() at time zone 'UTC')::date
  );
$$;
revoke all on function public.location_driver_eligible(uuid) from public,anon,authenticated;
grant execute on function public.location_driver_eligible(uuid) to service_role;
