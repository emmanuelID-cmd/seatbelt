alter table public.driver_eligibility
  add column if not exists registration_reviewed_at timestamptz,
  add column if not exists insurance_reviewed_at timestamptz,
  add column if not exists registration_delete_after timestamptz,
  add column if not exists insurance_delete_after timestamptz,
  add column if not exists retention_hold boolean not null default false;

create table public.driver_eligibility_notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('approved', 'rejected', 'needs_update')),
  document_type text not null check (document_type in ('registration', 'insurance')),
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_eligibility_notification_events enable row level security;
revoke all on table public.driver_eligibility_notification_events from anon, authenticated;

create index driver_eligibility_notification_events_due_idx
  on public.driver_eligibility_notification_events (status, next_attempt_at);

create index driver_eligibility_retention_idx
  on public.driver_eligibility (retention_hold, registration_delete_after, insurance_delete_after);