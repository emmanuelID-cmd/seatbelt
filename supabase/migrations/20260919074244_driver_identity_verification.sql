create table public.identity_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_verification_session_id text not null unique,
  status text not null default 'requires_input' check (status in ('requires_input', 'processing', 'verified', 'canceled')),
  last_error_code text,
  last_error_message text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.identity_verifications enable row level security;

grant select on public.identity_verifications to authenticated;
revoke insert, update, delete on public.identity_verifications from anon, authenticated;

drop policy if exists "Users can view own identity verification" on public.identity_verifications;
create policy "Users can view own identity verification"
  on public.identity_verifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);