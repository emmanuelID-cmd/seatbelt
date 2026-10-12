-- Requires 20261010034001_full_platform_accounts_notifications.sql first.
create table public.rides (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null unique references public.trips(id),
 driver_id uuid not null references public.profiles(id), rider_id uuid not null references public.profiles(id),
 amount_cents integer not null check(amount_cents between 100 and 99900),
 currency_code text not null default 'USD' check(currency_code='USD'),
 status text not null default 'accepted' check(status in ('accepted','in_progress','completed','canceled')),
 created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, canceled_at timestamptz,
 distance_meters numeric check(distance_meters>=0), route_coordinates jsonb, check(driver_id<>rider_id)
);
create index rides_driver_history on public.rides(driver_id,created_at desc,id);
create index rides_rider_history on public.rides(rider_id,created_at desc,id);
alter table public.rides enable row level security;
revoke all on public.rides from anon,authenticated;
grant select on public.rides to authenticated;
grant all on public.rides to service_role;
create policy rides_participants on public.rides for select to authenticated using((select auth.uid()) in (driver_id,rider_id));
create policy trips_owner_or_ride_participant on public.trips for select to authenticated using(
 (select auth.uid()) in (driver_id,rider_id)
 or exists(select 1 from public.rides where rides.trip_id=trips.id and (select auth.uid()) in (rides.driver_id,rides.rider_id))
);

create table public.ride_offers (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id),
 driver_id uuid not null references public.profiles(id), rider_id uuid not null references public.profiles(id),
 amount_cents integer not null check(amount_cents between 100 and 99900),
 currency_code text not null default 'USD' check(currency_code='USD'),
 status text not null default 'pending' check(status in ('pending','accepted','superseded')),
 created_at timestamptz not null default now(), check(driver_id<>rider_id)
);
create index ride_offers_conversation on public.ride_offers(trip_id,driver_id,rider_id,created_at desc);
create unique index ride_offers_one_pending on public.ride_offers(trip_id,driver_id,rider_id) where status='pending';
alter table public.ride_offers enable row level security;
revoke all on public.ride_offers from anon,authenticated;
grant select on public.ride_offers to authenticated;
grant all on public.ride_offers to service_role;
create policy ride_offers_participants on public.ride_offers for select to authenticated using((select auth.uid()) in (driver_id,rider_id));

create table public.ride_reviews (
 id uuid primary key default gen_random_uuid(), ride_id uuid not null references public.rides(id),
 reviewer_id uuid not null references public.profiles(id), reviewee_id uuid not null references public.profiles(id),
 rating integer not null check(rating between 1 and 5), comment text check(char_length(comment)<=1000),
 anonymous boolean not null default false, created_at timestamptz not null default now(),
 unique(ride_id,reviewer_id), check(reviewer_id<>reviewee_id)
);
create index ride_reviews_reviewee on public.ride_reviews(reviewee_id,created_at desc);
alter table public.ride_reviews enable row level security;
-- Only the authenticated API exposes reviews, excluding anonymous reviewer identifiers.
revoke all on public.ride_reviews from anon,authenticated;
grant all on public.ride_reviews to service_role;
-- Browser access uses participant-scoped APIs; legacy policies cannot expose
-- accepted routes or another pair's messages.
revoke all on public.trips,public.messages from public,anon,authenticated;
grant all on public.trips,public.messages to service_role;
create index if not exists messages_trip_participants on public.messages(trip_id,sender_id,receiver_id,created_at);

-- Reuses the existing identity + eligibility gate, also checking document expiration.
create function public.seatbelt_driver_eligible(p_user uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles where id=p_user and account_role in ('driver','both'))
 and public.platform_account_complete(p_user)
 and exists(select 1 from public.account_preferences where user_id=p_user and account_state='active')
 and exists(select 1 from public.identity_verifications where user_id=p_user and status='verified')
 and exists(select 1 from public.driver_eligibility where user_id=p_user and overall_status='approved'
   and registration_status='approved' and insurance_status='approved'
   and registration_expires_on>=current_date and insurance_expires_on>=current_date);
$$;
revoke all on function public.seatbelt_driver_eligible(uuid) from public,anon,authenticated;
grant execute on function public.seatbelt_driver_eligible(uuid) to service_role;

create function public.seatbelt_protect_agreed_post() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.rides where trip_id=old.id) then raise exception 'POST_LOCKED'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function public.seatbelt_protect_agreed_post() from public,anon,authenticated;
create trigger seatbelt_protect_agreed_post before update or delete on public.trips
for each row execute function public.seatbelt_protect_agreed_post();

-- Service-role-only RPC. Server derives p_actor from auth.getUser, never request input.
-- The trip row lock serializes post edits, offers and Rider acceptance.
create function public.seatbelt_notify_ride(p_recipient uuid,p_role text,p_event text,p_key text,p_essential boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
declare preferences public.notification_preferences%rowtype; visible boolean; email boolean;
begin
 select * into preferences from public.notification_preferences where user_id=p_recipient;
 visible:=p_essential or case when p_role='driver' then coalesce(preferences.driver_messages_in_app,true) else coalesce(preferences.rider_messages_in_app,true) end;
 email:=case when p_role='driver' then coalesce(preferences.driver_messages_email,false) else coalesce(preferences.rider_messages_email,false) end;
 if visible or email then
   insert into public.user_notifications(user_id,category,title,body,email_required,in_app_visible,dedupe_key)
   values(p_recipient,'ride',p_event,'Sign in to review a ride conversation.',email,visible,p_key)
   on conflict(dedupe_key) do nothing;
 end if;
end;
$$;
revoke all on function public.seatbelt_notify_ride(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.seatbelt_notify_ride(uuid,text,text,text,boolean) to service_role;

create function public.seatbelt_ride_action(p_actor uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 t public.trips%rowtype; r public.rides%rowtype; o public.ride_offers%rowtype; p public.profiles%rowtype;
 owner_id uuid; other_id uuid; driver uuid; rider uuid; result jsonb; review_id uuid;
 amount integer; seats integer; minimum numeric; maximum numeric; departure text;
begin
 if p_actor is null then raise exception 'NOT_AUTHORIZED'; end if;
 select * into p from public.profiles where id=p_actor;
 if not found then raise exception 'NOT_AUTHORIZED'; end if;
 if p_action in ('create_post','edit_post','offer','accept','start','message','review') and not exists(
   select 1 from public.account_preferences where user_id=p_actor and account_state='active') then raise exception 'ACCOUNT_INACTIVE'; end if;
 if p_action in ('create_post','edit_post','offer','accept','start') and not public.platform_account_complete(p_actor) then raise exception 'ACCOUNT_INCOMPLETE'; end if;

 if p_action in ('start','complete','cancel','review') then
   select * into r from public.rides where id=(p_payload->>'ride_id')::uuid for update;
   if not found or p_actor not in (r.driver_id,r.rider_id) then raise exception 'NOT_AUTHORIZED'; end if;
   if p_action='review' then
     if r.status<>'completed' then raise exception 'INVALID_TRANSITION'; end if;
     if (p_payload->>'rating')::integer not between 1 and 5 or char_length(coalesce(p_payload->>'comment',''))>1000 then raise exception 'INVALID_INPUT'; end if;
     insert into public.ride_reviews(ride_id,reviewer_id,reviewee_id,rating,comment,anonymous)
     values(r.id,p_actor,case when p_actor=r.driver_id then r.rider_id else r.driver_id end,
       (p_payload->>'rating')::integer,nullif(btrim(p_payload->>'comment'),''),coalesce((p_payload->>'anonymous')::boolean,false)) returning id into review_id;
     return jsonb_build_object('id',review_id);
   elsif p_action='start' then
     if p_actor<>r.driver_id or r.status<>'accepted' then raise exception 'INVALID_TRANSITION'; end if;
     if not public.seatbelt_driver_eligible(r.driver_id) then raise exception 'DRIVER_INELIGIBLE'; end if;
     if not exists(select 1 from public.account_preferences where user_id=r.rider_id and account_state='active') then raise exception 'ACCOUNT_INACTIVE'; end if;
     if not public.platform_account_complete(r.rider_id) then raise exception 'ACCOUNT_INCOMPLETE'; end if;
     update public.rides set status='in_progress',started_at=now() where id=r.id returning * into r;
   elsif p_action='complete' then
     if p_actor<>r.driver_id or r.status<>'in_progress' then raise exception 'INVALID_TRANSITION'; end if;
     update public.rides set status='completed',completed_at=now() where id=r.id returning * into r;
   else
     if r.status<>'accepted' then raise exception 'INVALID_TRANSITION'; end if;
     -- Payment reservation and cancellation both lock this ride first.
     -- Provider-backed payments need a support-led cancellation/refund.
     if exists(select 1 from public.ride_payments where ride_id=r.id) then raise exception 'PAYMENT_RESERVED'; end if;
     update public.rides set status='canceled',canceled_at=now() where id=r.id returning * into r;
   end if;
   perform public.seatbelt_notify_ride(case when p_actor=r.driver_id then r.rider_id else r.driver_id end,
     case when p_actor=r.driver_id then 'rider' else 'driver' end,
     case when r.status='in_progress' then 'Ride started' when r.status='completed' then 'Ride completed' else 'Ride canceled' end,
     'ride:'||r.id::text||':'||r.status,true);
   return to_jsonb(r);
 end if;

 if p_action<>'create_post' then
   select * into t from public.trips where id=(p_payload->>'trip_id')::uuid for update;
   if not found then raise exception 'NOT_AUTHORIZED'; end if;
   owner_id:=case when t.post_type='driver' then t.driver_id else t.rider_id end;
 end if;
 if p_action in ('create_post','edit_post','delete_post') then
   if p_action<>'create_post' and owner_id<>p_actor then raise exception 'NOT_AUTHORIZED'; end if;
   if p_action<>'create_post' and exists(select 1 from public.rides where trip_id=t.id) then raise exception 'POST_LOCKED'; end if;
   if p_action='delete_post' then
     update public.trips set is_active=false where id=t.id returning to_jsonb(trips.*) into result;
     update public.ride_offers set status='superseded' where trip_id=t.id and status='pending';
     return result;
   end if;
   if p_action='create_post' then
     if p.last_session_mode is null or p.last_session_mode not in ('rider','driver') then raise exception 'MODE_REQUIRED'; end if;
     t.post_type:=p.last_session_mode;
   end if;
   if t.post_type='driver' and not public.seatbelt_driver_eligible(p_actor) then raise exception 'DRIVER_INELIGIBLE'; end if;
   seats:=(p_payload->>'seats_available')::integer;
   if seats is null or seats not between 1 and 4 or char_length(coalesce(p_payload->>'notes',''))>280
     or char_length(coalesce(p_payload->>'origin',''))>200 or char_length(coalesce(p_payload->>'destination',''))>200 then raise exception 'INVALID_INPUT'; end if;
   departure:=p_payload->>'departure_time';
   if t.post_type='rider' then
     minimum:=(p_payload->>'price_min')::numeric; maximum:=(p_payload->>'price_max')::numeric;
     if nullif(btrim(p_payload->>'origin'),'') is null or nullif(btrim(p_payload->>'destination'),'') is null
       or minimum is null or maximum is null or minimum<1 or maximum>999 or minimum>maximum
       or minimum<>round(minimum,2) or maximum<>round(maximum,2) then raise exception 'INVALID_INPUT'; end if;
     if departure is null then departure:=now()::text;
     elsif departure::timestamptz<=now() then raise exception 'INVALID_DEPARTURE'; end if;
   else minimum:=null; maximum:=null; departure:=null;
   end if;
   if p_action='create_post' then
     insert into public.trips(driver_id,rider_id,post_type,origin,destination,departure_time,seats_available,suggested_price,price_min,price_max,currency_code,notes,is_active)
     values(case when t.post_type='driver' then p_actor end,case when t.post_type='rider' then p_actor end,t.post_type,
       nullif(btrim(p_payload->>'origin'),''),nullif(btrim(p_payload->>'destination'),''),departure,seats,
       case when minimum is not null then minimum::text||'-'||maximum::text end,minimum,maximum,'USD',nullif(btrim(p_payload->>'notes'),''),true)
     returning to_jsonb(trips.*) into result;
   else
     update public.trips set origin=nullif(btrim(p_payload->>'origin'),''),destination=nullif(btrim(p_payload->>'destination'),''),
       departure_time=departure,seats_available=seats,price_min=minimum,price_max=maximum,currency_code='USD',
       suggested_price=case when minimum is not null then minimum::text||'-'||maximum::text end,notes=nullif(btrim(p_payload->>'notes'),'')
     where id=t.id returning to_jsonb(trips.*) into result;
     update public.ride_offers set status='superseded' where trip_id=t.id and status='pending';
   end if;
   return result;
 end if;

 if p_action='accept' then
   select * into o from public.ride_offers where id=(p_payload->>'offer_id')::uuid and trip_id=t.id for update;
   if not found or o.rider_id<>p_actor then raise exception 'NOT_AUTHORIZED'; end if;
   if (t.post_type='driver' and t.driver_id<>o.driver_id) or (t.post_type='rider' and t.rider_id<>p_actor) then raise exception 'NOT_AUTHORIZED'; end if;
   if o.status='accepted' then
     select * into r from public.rides where trip_id=t.id and rider_id=p_actor and driver_id=o.driver_id;
     if found then return to_jsonb(r); end if;
   end if;
   if o.status<>'pending' or not t.is_active or exists(select 1 from public.rides where trip_id=t.id) then raise exception 'POST_LOCKED'; end if;
   if not public.seatbelt_driver_eligible(o.driver_id) then raise exception 'DRIVER_INELIGIBLE'; end if;
   if not exists(select 1 from public.account_preferences where user_id=o.driver_id and account_state='active') then raise exception 'ACCOUNT_INACTIVE'; end if;
   if not public.platform_account_complete(o.driver_id) then raise exception 'ACCOUNT_INCOMPLETE'; end if;
   update public.trips set is_active=false where id=t.id;
   insert into public.rides(trip_id,driver_id,rider_id,amount_cents,currency_code)
     values(t.id,o.driver_id,p_actor,o.amount_cents,'USD') returning * into r;
   update public.ride_offers set status=case when id=o.id then 'accepted' else 'superseded' end where trip_id=t.id and status='pending';
   perform public.seatbelt_notify_ride(r.driver_id,'driver','Ride accepted','ride:'||r.id::text||':accepted',true);
   return to_jsonb(r);
 end if;

 other_id:=(p_payload->>'other_id')::uuid;
 if other_id is null or other_id=p_actor or owner_id not in (p_actor,other_id) then raise exception 'NOT_AUTHORIZED'; end if;
 driver:=case when t.post_type='driver' then owner_id when p_actor=owner_id then other_id else p_actor end;
 rider:=case when t.post_type='rider' then owner_id when p_actor=owner_id then other_id else p_actor end;
 if p_actor=owner_id and not exists(select 1 from public.messages where trip_id=t.id and sender_id=other_id and receiver_id=p_actor) then raise exception 'CONVERSATION_REQUIRED'; end if;
 if p_action='message' then
   if not t.is_active and not exists(select 1 from public.messages where trip_id=t.id and ((sender_id=p_actor and receiver_id=other_id) or (sender_id=other_id and receiver_id=p_actor))) then raise exception 'POST_LOCKED'; end if;
   if char_length(btrim(coalesce(p_payload->>'content',''))) not between 1 and 140 then raise exception 'INVALID_MESSAGE'; end if;
   insert into public.messages(trip_id,sender_id,receiver_id,content) values(t.id,p_actor,other_id,btrim(p_payload->>'content')) returning to_jsonb(messages.*) into result;
   perform public.seatbelt_notify_ride(other_id,case when other_id=driver then 'driver' else 'rider' end,
     'New ride message','message:'||(result->>'id'),false);
   return result;
 elsif p_action='offer' then
   if p_actor<>driver or not public.seatbelt_driver_eligible(p_actor) then raise exception 'DRIVER_INELIGIBLE'; end if;
   if p.last_session_mode is distinct from 'driver' then raise exception 'MODE_REQUIRED'; end if;
   if not exists(select 1 from public.account_preferences where user_id=rider and account_state='active') then raise exception 'ACCOUNT_INACTIVE'; end if;
   if not public.platform_account_complete(rider) then raise exception 'ACCOUNT_INCOMPLETE'; end if;
   if not exists(select 1 from public.messages where trip_id=t.id and ((sender_id=p_actor and receiver_id=other_id) or (sender_id=other_id and receiver_id=p_actor))) then raise exception 'CONVERSATION_REQUIRED'; end if;
   if not t.is_active or exists(select 1 from public.rides where trip_id=t.id) then raise exception 'POST_LOCKED'; end if;
   amount:=(p_payload->>'amount_cents')::integer;
   if amount is null or amount not between 100 and 99900 then raise exception 'INVALID_AMOUNT'; end if;
   update public.ride_offers set status='superseded' where trip_id=t.id and driver_id=driver and rider_id=rider and status='pending';
   insert into public.ride_offers(trip_id,driver_id,rider_id,amount_cents) values(t.id,driver,rider,amount) returning * into o;
   perform public.seatbelt_notify_ride(rider,'rider','New Driver offer','offer:'||o.id::text,false);
   return to_jsonb(o);
 end if;
 raise exception 'INVALID_INPUT';
end;
$$;
revoke all on function public.seatbelt_ride_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.seatbelt_ride_action(uuid,text,jsonb) to service_role;

-- Serialize billing reservation with ride cancellation using the same row lock.
create function public.seatbelt_reserve_ride_payment() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r public.rides%rowtype;
begin
 select * into r from public.rides where id=new.ride_id for update;
 if not found or r.status not in ('accepted','in_progress','completed') then raise exception 'INVALID_TRANSITION'; end if;
 if new.rider_id<>r.rider_id or new.driver_id<>r.driver_id or new.amount_cents<>r.amount_cents or new.currency_code<>r.currency_code then raise exception 'INVALID_AMOUNT'; end if;
 return new;
end;
$$;
revoke all on function public.seatbelt_reserve_ride_payment() from public,anon,authenticated;
create trigger seatbelt_reserve_ride_payment before insert on public.ride_payments
for each row execute function public.seatbelt_reserve_ride_payment();
alter table public.ride_payments add constraint ride_payments_ride_fkey foreign key(ride_id) references public.rides(id);
