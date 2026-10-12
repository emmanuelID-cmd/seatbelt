update public.driver_eligibility
set
  registration_reviewed_at = coalesce(registration_reviewed_at, updated_at),
  registration_delete_after = now() + interval '30 days'
where retention_hold = false
  and registration_document_path is not null
  and registration_status in ('approved', 'rejected')
  and registration_delete_after is null;

update public.driver_eligibility
set
  insurance_reviewed_at = coalesce(insurance_reviewed_at, updated_at),
  insurance_delete_after = now() + interval '30 days'
where retention_hold = false
  and insurance_document_path is not null
  and insurance_status in ('approved', 'rejected')
  and insurance_delete_after is null;