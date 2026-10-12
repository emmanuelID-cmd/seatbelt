-- Own-account details are separate from the discoverable profiles table.
create table public.account_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text not null default '' check (char_length(legal_name) <= 32),
  address_line1 text not null default '' check (char_length(address_line1) <= 200),
  address_line2 text not null default '' check (char_length(address_line2) <= 200),
  city text not null default '' check (char_length(city) <= 100),
  region text not null default '' check (char_length(region) <= 100),
  postal_code text not null default '' check (char_length(postal_code) <= 20),
  country text not null default 'US' check (country ~ '^[A-Z]{2}$'),
  date_of_birth date, phone text not null default '', social_handle text not null default '',
  avatar_path text, updated_at timestamptz not null default now()
);
create table public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  presence_status text not null default 'offline' check (presence_status in ('online','away','busy','offline')),
  account_state text not null default 'active' check (account_state in ('active','frozen','deletion_requested')),
  frozen_until timestamptz, preferred_currency text not null default 'USD' check (preferred_currency ~ '^[A-Z]{3}$'),
  location_sharing boolean not null default false,
  last_seen_at timestamptz, updated_at timestamptz not null default now()
);
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rider_messages_in_app boolean not null default true, rider_messages_email boolean not null default false,
  rider_messages_sms boolean not null default false,
  driver_messages_in_app boolean not null default true, driver_messages_email boolean not null default false,
  driver_messages_sms boolean not null default false,
  browser_alerts boolean not null default false, newsletter boolean not null default false,
  updates boolean not null default true, promotions boolean not null default false,
  payment_reminders boolean not null default true, updated_at timestamptz not null default now()
);
create table public.account_events (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  event_type text not null, mode text check (mode in ('rider','driver')),
  occurred_at timestamptz not null default now()
);
create index account_events_time on public.account_events(occurred_at,event_type);
create index account_events_user on public.account_events(user_id,occurred_at);
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('security','account','ride','payment','support','update')),
  title text not null check (char_length(title)<=150), body text not null check (char_length(body)<=500),
  created_at timestamptz not null default now(), read_at timestamptz,
  email_required boolean not null default false, in_app_visible boolean not null default true,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','processing','sent','failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default now(), delivered_at timestamptz,
  dedupe_key text unique
);
create index user_notifications_owner on public.user_notifications(user_id,created_at desc);
create index user_notifications_delivery on public.user_notifications(delivery_status,next_attempt_at) where email_required;
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('general','payment','appeal','privacy')),
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'open' check (status in ('open','in_review','resolved','closed')),
  response text check (char_length(response)<=2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_tickets_owner on public.support_tickets(user_id,created_at desc);
create table public.security_incidents (
  id uuid primary key default gen_random_uuid(), category text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  summary text not null check (char_length(summary)<=500),
  opened_at timestamptz not null default now(), resolved_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null
);
-- Only protected server routes mutate these records; clients may read their own.
do $$ declare table_name text; begin
  foreach table_name in array array['account_details','account_preferences','notification_preferences','user_notifications','support_tickets'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
    execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)',table_name);
  end loop;
end $$;
alter table public.account_events enable row level security;
alter table public.security_incidents enable row level security;
revoke all on public.account_events,public.security_incidents from anon,authenticated;
grant all on public.account_events,public.security_incidents to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('account-portraits','account-portraits',false,5242880,array['image/jpeg'])
on conflict (id) do nothing;
-- Portrait access is exclusively through authenticated owner routes/signed URLs.

create or replace function public.platform_operations_summary(since_time timestamptz, until_time timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'totalAccounts',(select count(*) from public.profiles),
    'totalDrivers',(select count(*) from public.profiles where is_driver),
    'totalRiders',(select count(*) from public.profiles where account_role in ('rider','both')),
    'accountsCreated',(select count(*) from public.profiles where created_at >= since_time and created_at <= until_time),
    'onlineDrivers',(select count(*) from public.account_preferences a join public.profiles p on p.id=a.user_id where a.account_state='active' and a.presence_status='online' and a.last_seen_at>now()-interval '5 minutes' and p.last_session_mode='driver'),
    'onlineRiders',(select count(*) from public.account_preferences a join public.profiles p on p.id=a.user_id where a.account_state='active' and a.presence_status='online' and a.last_seen_at>now()-interval '5 minutes' and p.last_session_mode='rider'),
    'activeDrivers',(select count(distinct user_id) from public.account_events where event_type='activity' and mode='driver' and occurred_at between since_time and until_time),
    'activeRiders',(select count(distinct user_id) from public.account_events where event_type='activity' and mode='rider' and occurred_at between since_time and until_time),
    'frozenAccounts',(select count(*) from public.account_preferences where account_state='frozen'),
    'deletionRequests',(select count(*) from public.account_preferences where account_state='deletion_requested'),
    'tickets',(select count(*) from public.support_tickets where created_at between since_time and until_time),
    'openTickets',(select count(*) from public.support_tickets where status in ('open','in_review')),
    'securityIncidents',(select count(*) from public.security_incidents where opened_at between since_time and until_time),
    'activityCoverageSince',(select min(occurred_at) from public.account_events)
  );
$$;
revoke all on function public.platform_operations_summary(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_operations_summary(timestamptz,timestamptz) to service_role;

-- All profile writes, audit evidence and notification enqueue succeed together.
-- Only the protected server can call these invoker functions.
create function public.update_platform_account(p_user_id uuid, p_details jsonb, p_preferences jsonb, p_notifications jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare d public.account_details; p public.account_preferences; n public.notification_preferences;
begin
  select * into strict p from public.account_preferences where user_id=p_user_id for update;
  if p_details is not null then
    select * into strict d from public.account_details where user_id=p_user_id for update;
    d := jsonb_populate_record(d,p_details);
    if btrim(d.legal_name)='' or btrim(d.address_line1)='' or btrim(d.city)='' or btrim(d.postal_code)=''
      or d.date_of_birth is null or d.date_of_birth<date '1900-01-01' or d.date_of_birth>current_date-interval '18 years'
      or (d.country='US' and (btrim(d.region)='' or d.postal_code !~ '^[0-9]{5}(-[0-9]{4})?$')) then
      raise exception 'invalid_account_details';
    end if;
    update public.account_details set legal_name=d.legal_name,address_line1=d.address_line1,
      address_line2=d.address_line2,city=d.city,region=d.region,postal_code=d.postal_code,
      country=d.country,date_of_birth=d.date_of_birth,phone=d.phone,social_handle=d.social_handle,
      updated_at=now() where user_id=p_user_id;
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

create function public.change_platform_account_state(p_user_id uuid,p_state text,p_frozen_until timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
declare previous_state text;
begin
  select account_state into strict previous_state from public.account_preferences where user_id=p_user_id for update;
  if previous_state='deletion_requested' or p_state not in ('active','frozen','deletion_requested') then
    raise exception 'account_state_transition_unavailable';
  end if;
  if p_state='frozen' and (p_frozen_until is null or p_frozen_until<=now()) then
    raise exception 'invalid_freeze_date';
  end if;
  if p_state='deletion_requested' then
    insert into public.support_tickets(user_id,category,subject,message)
      values(p_user_id,'privacy','Account deletion request','The account holder requested deletion through authenticated account settings. Retention and legal holds require review before deletion.');
  end if;
  update public.account_preferences set account_state=p_state,
    frozen_until=case when p_state='frozen' then p_frozen_until else null end,
    location_sharing=false,presence_status='offline',updated_at=now() where user_id=p_user_id;
  update public.profiles set last_session_mode='rider' where id=p_user_id;
  if to_regclass('public.location_presence') is not null then
    delete from public.location_presence where user_id=p_user_id;
  end if;
  if to_regclass('public.user_locations') is not null then
    update public.user_locations set is_active=false where user_id=p_user_id;
  end if;
  insert into public.account_events(user_id,event_type) values(p_user_id,'account_'||p_state);
  insert into public.user_notifications(user_id,category,title,body,email_required)
    values(p_user_id,'security','Account status changed','Your Seatbelt account status changed. Sign in to review it. If you did not request this change, contact support.',true);
end;
$$;
revoke all on function public.change_platform_account_state(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.change_platform_account_state(uuid,text,timestamptz) to service_role;

create table public.support_review_events (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id),
  admin_id uuid references auth.users(id) on delete set null,
  old_status text not null,new_status text not null,occurred_at timestamptz not null default now()
);
alter table public.support_review_events enable row level security;
revoke all on public.support_review_events from public,anon,authenticated;
grant select,insert on public.support_review_events to service_role;

create function public.review_platform_support(p_ticket_id uuid,p_admin_id uuid,p_status text,p_response text,p_updated_at timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare ticket public.support_tickets;
begin
  if not exists(select 1 from public.admin_roles where user_id=p_admin_id and role='admin') then
    raise exception 'admin_required';
  end if;
  select * into ticket from public.support_tickets where id=p_ticket_id for update;
  if not found or ticket.updated_at<>p_updated_at then return false; end if;
  update public.support_tickets set status=p_status,response=p_response,updated_at=now() where id=p_ticket_id;
  insert into public.support_review_events(ticket_id,admin_id,old_status,new_status) values(p_ticket_id,p_admin_id,ticket.status,p_status);
  insert into public.user_notifications(user_id,category,title,body,email_required)
    values(ticket.user_id,'support','Support request updated','Sign in to Seatbelt to review an update to your support request.',true);
  return true;
end;
$$;
revoke all on function public.review_platform_support(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.review_platform_support(uuid,uuid,text,text,timestamptz) to service_role;

create function public.platform_trust_summary(since_time timestamptz,until_time timestamptz)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'pendingEligibility',(select count(*) from public.driver_eligibility where overall_status='pending'),
    'approvedEligibility',(select count(*) from public.driver_eligibility where overall_status='approved'),
    'expiredDocuments',(select count(*) from public.driver_eligibility where registration_expires_on<current_date or insurance_expires_on<current_date),
    'incidents',(select count(*) from public.security_incidents where opened_at between since_time and until_time),
    'openIncidents',(select count(*) from public.security_incidents where resolved_at is null),
    'appeals',(select count(*) from public.support_tickets where category='appeal' and created_at between since_time and until_time),
    'privacyRequests',(select count(*) from public.support_tickets where category='privacy' and created_at between since_time and until_time),
    'coverageSince',(select min(opened_at) from public.security_incidents)
  );
$$;
revoke all on function public.platform_trust_summary(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_trust_summary(timestamptz,timestamptz) to service_role;

-- Server APIs and direct profile mode updates share the same account boundary.
create or replace function public.enforce_driver_session_eligibility()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.last_session_mode='driver' then
    if not exists(select 1 from public.account_preferences where user_id=new.id and account_state='active')
      or not exists(select 1 from public.account_details where user_id=new.id and legal_name<>'' and address_line1<>'' and city<>'' and postal_code<>'' and date_of_birth<=current_date-interval '18 years')
      or not exists(select 1 from public.identity_verifications where user_id=new.id and status='verified')
      or not exists(select 1 from public.driver_eligibility where user_id=new.id and overall_status='approved'
        and registration_status='approved' and insurance_status='approved'
        and registration_expires_on>=current_date and insurance_expires_on>=current_date) then
      raise exception 'Driver mode requires an active, complete account and approved, unexpired eligibility.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_driver_session_eligibility() from public,anon,authenticated;

create function public.platform_account_complete(p_user_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.account_details where user_id=p_user_id
    and legal_name<>'' and address_line1<>'' and city<>'' and postal_code<>''
    and country<>'' and (country<>'US' or region<>'')
    and date_of_birth between date '1900-01-01' and current_date-interval '18 years');
$$;
revoke all on function public.platform_account_complete(uuid) from public,anon,authenticated;
grant execute on function public.platform_account_complete(uuid) to service_role;

alter table public.user_notifications add column delivery_claimed_at timestamptz;
alter table public.driver_eligibility_notification_events add column delivery_claimed_at timestamptz;
alter table public.driver_eligibility_notification_events drop constraint driver_eligibility_notification_events_status_check;
alter table public.driver_eligibility_notification_events add constraint driver_eligibility_notification_events_status_check
  check(status in ('pending','processing','sent','failed'));
grant all on public.driver_eligibility_notification_events to service_role;

create function public.claim_platform_notifications(p_source text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare rows jsonb;
begin
  if p_source='account' then
    update public.user_notifications set delivery_status=case when attempt_count>=5 then 'failed' else 'pending' end,delivery_claimed_at=null
      where delivery_status='processing' and delivery_claimed_at<now()-interval '10 minutes';
    with candidates as (
      select id from public.user_notifications where email_required and delivery_status in ('pending','failed')
        and attempt_count<5 and next_attempt_at<=now() order by next_attempt_at limit 10 for update skip locked
    ), claimed as (
      update public.user_notifications n set delivery_status='processing',delivery_claimed_at=now(),attempt_count=attempt_count+1
      from candidates c where n.id=c.id returning n.id,n.user_id,n.attempt_count,n.category
    ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into rows from claimed;
  elsif p_source='eligibility' then
    update public.driver_eligibility_notification_events set status=case when attempt_count>=5 then 'failed' else 'pending' end,delivery_claimed_at=null
      where status='processing' and delivery_claimed_at<now()-interval '10 minutes';
    with candidates as (
      select id from public.driver_eligibility_notification_events where status in ('pending','failed')
        and attempt_count<5 and next_attempt_at<=now() order by next_attempt_at limit 10 for update skip locked
    ), claimed as (
      update public.driver_eligibility_notification_events n set status='processing',delivery_claimed_at=now(),attempt_count=attempt_count+1
      from candidates c where n.id=c.id returning n.id,n.user_id,n.attempt_count
    ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into rows from claimed;
  else raise exception 'invalid_notification_source'; end if;
  return rows;
end;
$$;
revoke all on function public.claim_platform_notifications(text) from public,anon,authenticated;
grant execute on function public.claim_platform_notifications(text) to service_role;

-- Legal names are private onboarding data. Discovery profiles retain initials.
insert into public.account_details(user_id,legal_name)
  select id,left(coalesce(full_name,''),32) from public.profiles
  on conflict(user_id) do nothing;
update public.profiles set full_name=coalesce(nullif(avatar_initials,''),'Seatbelt member');

create function public.protect_platform_profile_name()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.account_details(user_id,legal_name) values(new.id,left(coalesce(new.full_name,''),32))
      on conflict(user_id) do nothing;
  end if;
  new.full_name := coalesce(nullif(new.avatar_initials,''),'Seatbelt member');
  return new;
end;
$$;
revoke all on function public.protect_platform_profile_name() from public,anon,authenticated;
create trigger protect_platform_profile_name before insert or update of full_name on public.profiles
  for each row execute function public.protect_platform_profile_name();
-- Account role/capability and discovery fields are no longer client-mutable.
revoke update on public.profiles from anon,authenticated;
grant update(last_session_mode,session_mode_reassignment_seen) on public.profiles to authenticated;

create function public.create_platform_support(p_user_id uuid,p_category text,p_subject text,p_message text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare ticket_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support:'||p_user_id::text,0));
  if (select count(*) from public.support_tickets where user_id=p_user_id and created_at>=now()-interval '1 hour')>=5 then return null; end if;
  insert into public.support_tickets(user_id,category,subject,message) values(p_user_id,p_category,p_subject,p_message) returning id into ticket_id;
  insert into public.user_notifications(user_id,category,title,body)
    values(p_user_id,'support','Support request received','Your request is saved. Sign in to check its status.');
  return ticket_id;
end;
$$;
revoke all on function public.create_platform_support(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_platform_support(uuid,text,text,text) to service_role;

alter table public.support_review_events add column action text not null default 'response' check(action in ('view','response'));
create function public.read_platform_support(p_ticket_id uuid,p_admin_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ticket public.support_tickets;
begin
  if not exists(select 1 from public.admin_roles where user_id=p_admin_id and role='admin') then raise exception 'admin_required'; end if;
  select * into ticket from public.support_tickets where id=p_ticket_id;
  if not found then return null; end if;
  insert into public.support_review_events(ticket_id,admin_id,old_status,new_status,action)
    values(ticket.id,p_admin_id,ticket.status,ticket.status,'view');
  return to_jsonb(ticket)-'user_id';
end;
$$;
revoke all on function public.read_platform_support(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_platform_support(uuid,uuid) to service_role;
