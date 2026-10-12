create table public.driver_eligibility_upload_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('registration', 'insurance')),
  path text not null unique,
  expires_at timestamptz not null default (now() + interval '23 hours'),
  created_at timestamptz not null default now()
);

alter table public.driver_eligibility_upload_drafts enable row level security;

revoke all on table public.driver_eligibility_upload_drafts from anon, authenticated;