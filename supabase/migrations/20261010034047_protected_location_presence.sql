-- Depends on account_preferences from 20261010034001. No precise GPS or route
-- history is stored here. Only the server may read or write these records.
-- Retire the legacy public GPS surface, including any other permissive SELECT
-- policy left over from early deployments. Keep authenticated owner stop access.
do $$
begin
  if to_regclass('public.user_locations') is not null then
    alter table public.user_locations enable row level security;
    revoke all on public.user_locations from public, anon, authenticated;
    grant select on public.user_locations to authenticated, service_role;
    grant update (is_active) on public.user_locations to authenticated, service_role;
    drop policy if exists "Anyone can view active locations" on public.user_locations;
    create policy legacy_locations_owner_read on public.user_locations
      for select to authenticated using ((select auth.uid()) = user_id);
    create policy legacy_locations_read_boundary on public.user_locations
      as restrictive for select to anon, authenticated using ((select auth.uid()) = user_id);
    create policy legacy_locations_owner_stop on public.user_locations
      for update to authenticated using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id and is_active = false);
    create policy legacy_locations_stop_boundary on public.user_locations
      as restrictive for update to authenticated using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id and is_active = false);
  end if;
end;
$$;

create table public.location_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sharing_id uuid not null default gen_random_uuid(),
  latitude numeric(5,2),
  longitude numeric(6,2),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  constraint location_presence_coordinates check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and
     latitude between -90 and 90 and longitude between -180 and 180 and
     mod(latitude, 0.02) = 0 and mod(longitude, 0.02) = 0)
  ),
  constraint location_presence_expiry check (expires_at <= updated_at + interval '2 minutes')
);

alter table public.location_presence enable row level security;
alter table public.location_presence force row level security;
revoke all on public.location_presence from public, anon, authenticated;
grant select, insert, update, delete on public.location_presence to service_role;
-- No client policies: even an owner cannot access coordinates through the Data API.
create index location_presence_expiry_idx on public.location_presence (expires_at);

create function public.location_driver_eligible(p_user_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.account_preferences a on a.user_id = p.id
    join public.identity_verifications i on i.user_id = p.id
    join public.driver_eligibility e on e.user_id = p.id
    where p.id = p_user_id
      and p.account_role in ('driver', 'both') and p.last_session_mode = 'driver'
      and a.account_state = 'active'
      and public.platform_account_complete(p_user_id)
      and i.status = 'verified'
      and e.overall_status = 'approved'
      and e.registration_status = 'approved' and e.insurance_status = 'approved'
      and e.registration_expires_on > (now() at time zone 'UTC')::date
      and e.insurance_expires_on > (now() at time zone 'UTC')::date
  );
$$;

create function public.location_status(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'canShare', public.location_driver_eligible(p_user_id),
    'locationSharing', coalesce((select location_sharing from public.account_preferences where user_id = p_user_id), false),
    'sharing', public.location_driver_eligible(p_user_id) and exists (
      select 1 from public.location_presence l
      join public.account_preferences a on a.user_id = l.user_id
      where l.user_id = p_user_id and a.location_sharing and l.latitude is not null and l.expires_at > now()
    ),
    'reason', case when public.location_driver_eligible(p_user_id) then null else
      'Sharing requires completed account setup, an active account in Driver mode, verified Stripe identity, and approved, unexpired registration and insurance.' end
  );
$$;

create function public.change_location_presence(
  p_user_id uuid, p_action text, p_sharing_id uuid default null,
  p_latitude double precision default null, p_longitude double precision default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_sharing_id uuid;
  v_expires_at timestamptz;
  v_preference boolean;
begin
  -- Serializes start/update/stop with account preference writes. Session IDs
  -- ensure delayed updates and old page cleanups cannot revive/stop a new share.
  select location_sharing into v_preference from public.account_preferences
    where user_id = p_user_id for update;

  if p_action = 'stop' then
    delete from public.location_presence where user_id = p_user_id
      and (p_sharing_id is null or sharing_id = p_sharing_id);
    if found or p_sharing_id is null or not exists (
      select 1 from public.location_presence where user_id = p_user_id
    ) then
      update public.account_preferences set location_sharing = false, updated_at = now() where user_id = p_user_id;
      if to_regclass('public.user_locations') is not null then
        update public.user_locations set is_active = false where user_id = p_user_id and is_active = true;
      end if;
    end if;
    return jsonb_build_object('stopped', true);
  end if;

  if p_action not in ('start', 'update') or p_action is null then
    return jsonb_build_object('error', 'Choose start, update, or stop.', 'status', 400);
  end if;
  if not public.location_driver_eligible(p_user_id) then
    delete from public.location_presence where user_id = p_user_id;
    update public.account_preferences set location_sharing = false, updated_at = now() where user_id = p_user_id;
    return jsonb_build_object('error', 'Sharing requires completed account setup, an active account in Driver mode, verified Stripe identity, and approved, unexpired registration and insurance.', 'status', 403);
  end if;

  if p_action = 'start' then
    update public.account_preferences set location_sharing = true, updated_at = now() where user_id = p_user_id;
    insert into public.location_presence (user_id) values (p_user_id)
    on conflict (user_id) do update set sharing_id = gen_random_uuid(),
      latitude = null, longitude = null, updated_at = now(), expires_at = now() + interval '2 minutes'
    returning sharing_id, expires_at into v_sharing_id, v_expires_at;
    return jsonb_build_object('sharingId', v_sharing_id, 'expiresAt', v_expires_at);
  end if;

  if v_preference is distinct from true then
    delete from public.location_presence where user_id = p_user_id;
    return jsonb_build_object('error', 'Location sharing is off. Start sharing again to opt in.', 'status', 409);
  end if;
  if p_latitude is null or p_longitude is null or not (p_latitude between -90 and 90)
    or not (p_longitude between -180 and 180) then
    return jsonb_build_object('error', 'A valid device location is required.', 'status', 400);
  end if;
  update public.location_presence set
    latitude = round(p_latitude::numeric * 50) / 50,
    longitude = round(p_longitude::numeric * 50) / 50,
    updated_at = now(), expires_at = now() + interval '2 minutes'
  where user_id = p_user_id and sharing_id = p_sharing_id and expires_at > now()
  returning expires_at into v_expires_at;
  if not found then
    return jsonb_build_object('error', 'Location sharing stopped or expired. Start sharing again.', 'status', 409);
  end if;
  return jsonb_build_object('expiresAt', v_expires_at);
end;
$$;

create function public.discover_nearby_drivers(
  p_user_id uuid, p_latitude double precision, p_longitude double precision
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_drivers jsonb;
begin
  if not public.platform_account_complete(p_user_id) or not exists (
    select 1 from public.account_preferences where user_id = p_user_id and account_state = 'active'
  ) then
    return jsonb_build_object('error', 'Complete account setup and use an active account to find nearby Drivers.', 'status', 403);
  end if;
  if p_latitude is null or p_longitude is null or not (p_latitude between -90 and 90)
    or not (p_longitude between -180 and 180) then
    return jsonb_build_object('error', 'A valid device location is required.', 'status', 400);
  end if;
  p_latitude := round(p_latitude::numeric * 50) / 50;
  p_longitude := round(p_longitude::numeric * 50) / 50;
  select coalesce(jsonb_agg(jsonb_build_object(
    'driverId', d.user_id, 'latitude', d.latitude, 'longitude', d.longitude,
    'approximateMiles', round(d.miles::numeric), 'expiresAt', d.expires_at
  ) order by d.miles), '[]'::jsonb) into v_drivers
  from (
    select nearby.* from (
      select l.user_id, l.latitude, l.longitude, l.expires_at,
        3958.7613 * 2 * asin(sqrt(least(1.0, greatest(0.0,
          power(sin(radians(l.latitude::double precision - p_latitude) / 2), 2) +
          cos(radians(p_latitude)) * cos(radians(l.latitude::double precision)) *
          power(sin(radians(l.longitude::double precision - p_longitude) / 2), 2)
        )))) as miles
      from public.location_presence l
      join public.account_preferences a on a.user_id = l.user_id
      where l.user_id <> p_user_id and l.expires_at > now() and l.latitude is not null
        and a.location_sharing and public.location_driver_eligible(l.user_id)
        and l.latitude between p_latitude - 0.15 and p_latitude + 0.15
    ) nearby where nearby.miles <= 10 order by nearby.miles limit 50
  ) d;
  return jsonb_build_object('drivers', v_drivers, 'radiusMiles', 10);
end;
$$;

revoke all on function public.location_driver_eligible(uuid) from public, anon, authenticated;
revoke all on function public.location_status(uuid) from public, anon, authenticated;
revoke all on function public.change_location_presence(uuid, text, uuid, double precision, double precision) from public, anon, authenticated;
revoke all on function public.discover_nearby_drivers(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.location_driver_eligible(uuid) to service_role;
grant execute on function public.location_status(uuid) to service_role;
grant execute on function public.change_location_presence(uuid, text, uuid, double precision, double precision) to service_role;
grant execute on function public.discover_nearby_drivers(uuid, double precision, double precision) to service_role;
