-- Provider identifiers and operation leases are never exposed to browser roles.
create table public.billing_accounts (
  user_id uuid primary key references auth.users(id),
  customer_id text unique, connect_account_id text unique,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.billing_subscriptions (
  user_id uuid primary key references auth.users(id),
  subscription_id text not null unique,
  tier text check (tier in ('BRONZE','SILVER','GOLD')),
  status text not null, started_at timestamptz, renewal_at timestamptz,
  cancel_at_period_end boolean not null default false, frozen_until timestamptz,
  updated_at timestamptz not null default now()
);
-- The independently generated rides migration follows this migration. The
-- payment route validates the accepted ride before inserting its immutable price.
create table public.ride_payments (
  ride_id uuid primary key,
  rider_id uuid not null references auth.users(id), driver_id uuid not null references auth.users(id),
  amount_cents integer not null check (amount_cents between 100 and 99900),
  currency_code text not null check (currency_code = 'USD'),
  destination_account_id text not null, customer_id text not null,
  payment_intent_id text unique, status text not null default 'pending',
  refunded_cents integer not null default 0 check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (rider_id <> driver_id)
);
create index ride_payments_rider on public.ride_payments(rider_id);
create index ride_payments_driver on public.ride_payments(driver_id);
create table public.billing_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), ride_id uuid,
  type text not null check (type in ('payment','refund','fee','expense')),
  amount_cents bigint not null check (amount_cents >= 0), currency_code text not null check (currency_code = 'USD'),
  stripe_event_id text not null, source_object_id text not null, occurred_at timestamptz not null,
  -- Each participant has a separate ledger; a refund affects both participants.
  unique (stripe_event_id, type, user_id), unique (source_object_id, type, user_id)
);
create index billing_ledger_owner_time on public.billing_ledger(user_id, occurred_at desc);
create index billing_ledger_ride on public.billing_ledger(ride_id);
create table public.billing_webhook_events (id text primary key, processed_at timestamptz not null default now());
create table public.billing_operation_locks (operation_key text primary key, token uuid not null, expires_at timestamptz not null);
create table public.billing_checkout_sessions (
  user_id uuid primary key references auth.users(id), operation_id uuid not null default gen_random_uuid(),
  tier text not null check (tier in ('BRONZE','SILVER','GOLD')), session_id text, created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['billing_accounts','billing_subscriptions','ride_payments','billing_ledger','billing_webhook_events','billing_operation_locks','billing_checkout_sessions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant select (user_id,tier,status,started_at,renewal_at,cancel_at_period_end,frozen_until,updated_at) on public.billing_subscriptions to authenticated;
create policy own_subscription_read on public.billing_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
grant select (ride_id,rider_id,driver_id,amount_cents,currency_code,status,refunded_cents,created_at,updated_at) on public.ride_payments to authenticated;
create policy participant_payment_read on public.ride_payments for select to authenticated using ((select auth.uid()) in (rider_id,driver_id));
grant select (id,user_id,ride_id,type,amount_cents,currency_code,occurred_at) on public.billing_ledger to authenticated;
create policy own_ledger_read on public.billing_ledger for select to authenticated using ((select auth.uid()) = user_id);

create function public.claim_billing_operation(p_key text, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.billing_operation_locks(operation_key,token,expires_at)
  values (p_key,p_token,now()+interval '10 minutes')
  on conflict (operation_key) do update set token=excluded.token,expires_at=excluded.expires_at
  where public.billing_operation_locks.expires_at < now();
  return found;
end $$;
revoke all on function public.claim_billing_operation(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_billing_operation(text,uuid) to service_role;

-- Receipt, snapshot and ledger commit together. Failed writes leave no receipt.
create function public.apply_billing_event(p_event_id text, p_payment jsonb default null,
  p_subscription jsonb default null, p_ledger jsonb default '[]'::jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare entry jsonb;
begin
  insert into public.billing_webhook_events(id) values (p_event_id) on conflict do nothing;
  if not found then return; end if;
  if p_payment is not null then
    update public.ride_payments set status=p_payment->>'status',
      refunded_cents=(p_payment->>'refunded_cents')::integer, updated_at=now()
    where payment_intent_id=p_payment->>'payment_intent_id';
    if not found then raise exception 'Payment mapping missing'; end if;
  end if;
  if p_subscription is not null then
    insert into public.billing_subscriptions(user_id,subscription_id,tier,status,started_at,renewal_at,cancel_at_period_end,frozen_until)
    values ((p_subscription->>'user_id')::uuid,p_subscription->>'subscription_id',p_subscription->>'tier',p_subscription->>'status',
      (p_subscription->>'started_at')::timestamptz,(p_subscription->>'renewal_at')::timestamptz,
      (p_subscription->>'cancel_at_period_end')::boolean,(p_subscription->>'frozen_until')::timestamptz)
    on conflict (user_id) do update set subscription_id=excluded.subscription_id,tier=excluded.tier,status=excluded.status,
      started_at=excluded.started_at,renewal_at=excluded.renewal_at,cancel_at_period_end=excluded.cancel_at_period_end,
      frozen_until=excluded.frozen_until,updated_at=now();
  end if;
  for entry in select value from jsonb_array_elements(p_ledger) loop
    insert into public.billing_ledger(user_id,ride_id,type,amount_cents,currency_code,stripe_event_id,source_object_id,occurred_at)
    values ((entry->>'user_id')::uuid,(entry->>'ride_id')::uuid,entry->>'type',(entry->>'amount_cents')::bigint,
      'USD',p_event_id,entry->>'source_object_id',(entry->>'occurred_at')::timestamptz)
    on conflict do nothing;
  end loop;
end $$;
revoke all on function public.apply_billing_event(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_billing_event(text,jsonb,jsonb,jsonb) to service_role;

-- Aggregate actual provider-confirmed ledger evidence; never infer revenue
-- from ride posts, browser confirmations, or duplicate participant refunds.
create function public.platform_finance_summary(since_time timestamptz, until_time timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'coverageSince', (select min(occurred_at) from public.billing_ledger),
    'currencies', coalesce((select jsonb_agg(summary) from (
      select jsonb_build_object(
        'currency', l.currency_code,
        'grossRidePaymentsCents', coalesce(sum(l.amount_cents) filter (where l.type='payment'),0),
        'rideRefundsCents', coalesce(sum(l.amount_cents) filter (where l.type='refund' and l.user_id=p.driver_id),0),
        'recordedUserExpensesCents', coalesce(sum(l.amount_cents) filter (where l.type='expense'),0),
        'recordedFeesCents', coalesce(sum(l.amount_cents) filter (where l.type='fee'),0),
        'platformRevenueCents', null, 'subscriptionRevenueCents', null
      ) as summary
      from public.billing_ledger l left join public.ride_payments p on p.ride_id=l.ride_id
      where l.occurred_at >= since_time and l.occurred_at < until_time
      group by l.currency_code
    ) grouped), '[]'::jsonb),
    'coverageNote', 'Provider-confirmed ledger entries only. Ride payments are gross ride volume, not platform revenue. Expenses are account spending. Platform and subscription revenue are not instrumented.'
  );
$$;
revoke all on function public.platform_finance_summary(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_finance_summary(timestamptz,timestamptz) to service_role;
