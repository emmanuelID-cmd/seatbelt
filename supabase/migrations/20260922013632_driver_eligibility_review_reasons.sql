alter table public.driver_eligibility
  add column if not exists registration_rejection_code text,
  add column if not exists insurance_rejection_code text;

alter table public.driver_eligibility
  add constraint driver_eligibility_registration_rejection_code_check
  check (registration_rejection_code is null or registration_rejection_code in (
    'missing_document', 'expired_document', 'unreadable_document',
    'unsupported_document', 'information_mismatch', 'manual_review_required'
  ));

alter table public.driver_eligibility
  add constraint driver_eligibility_insurance_rejection_code_check
  check (insurance_rejection_code is null or insurance_rejection_code in (
    'missing_document', 'expired_document', 'unreadable_document',
    'unsupported_document', 'information_mismatch', 'manual_review_required'
  ));