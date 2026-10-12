create table public.driver_eligibility (
  user_id uuid primary key references auth.users (id) on delete cascade,
  registration_status text not null default 'not_submitted'
    check (registration_status in ('not_submitted', 'pending', 'approved', 'rejected', 'expired')),
  registration_expires_on date,
  registration_document_path text,
  registration_submitted_at timestamptz,
  insurance_status text not null default 'not_submitted'
    check (insurance_status in ('not_submitted', 'pending', 'approved', 'rejected', 'expired')),
  insurance_expires_on date,
  insurance_document_path text,
  insurance_submitted_at timestamptz,
  overall_status text not null default 'incomplete'
    check (overall_status in ('incomplete', 'pending', 'approved', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_eligibility enable row level security;

revoke all on table public.driver_eligibility from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-eligibility-documents',
  'driver-eligibility-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can access own driver eligibility documents" on storage.objects;