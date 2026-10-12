alter table public.driver_eligibility_upload_drafts
  alter column expires_at set default (now() + interval '48 hours');