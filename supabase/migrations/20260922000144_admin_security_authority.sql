create table public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

revoke all on table public.admin_roles from anon, authenticated;

insert into public.admin_roles (user_id, role)
values
  ('e9c47534-c168-49d6-bc57-a923d72f96af', 'admin'),
  ('90275f26-cfe4-4208-b9d1-152131753d45', 'admin');

create table public.driver_eligibility_review_audit (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('approved', 'rejected', 'needs_update')),
  reason_code text,
  created_at timestamptz not null default now()
);

alter table public.driver_eligibility_review_audit enable row level security;

revoke all on table public.driver_eligibility_review_audit from anon, authenticated;