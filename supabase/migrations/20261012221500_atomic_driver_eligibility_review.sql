create or replace function public.review_driver_eligibility_document(
  p_subject_user_id uuid,
  p_reviewer_user_id uuid,
  p_document_type text,
  p_action text,
  p_reason_code text,
  p_delete_after timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.driver_eligibility%rowtype;
  reviewed_status text;
  other_status text;
  resulting_status text;
  reviewed_at timestamptz := now();
begin
  if p_subject_user_id is null
    or p_reviewer_user_id is null
    or p_document_type is null
    or p_document_type not in ('registration', 'insurance')
    or p_action is null
    or p_action not in ('approved', 'rejected', 'needs_update')
    or (p_action <> 'approved' and (p_reason_code is null or p_reason_code not in ('missing_document', 'expired_document', 'unreadable_document', 'unsupported_document', 'information_mismatch', 'manual_review_required')))
    or p_delete_after is null
    or p_delete_after <= reviewed_at then
    raise exception 'Invalid Driver Eligibility review input.' using errcode = '22023';
  end if;

  select * into current_row
  from public.driver_eligibility
  where user_id = p_subject_user_id
  for update;
  if not found then
    raise exception 'Driver Eligibility submission was not found.' using errcode = 'P0002';
  end if;

  reviewed_status := case
    when p_action = 'approved' then 'approved'
    when p_action = 'rejected' then 'rejected'
    else 'pending'
  end;
  if p_document_type = 'registration' then
    other_status := current_row.insurance_status;
    update public.driver_eligibility
    set registration_status = reviewed_status,
        registration_rejection_code = case when p_action = 'approved' then null else p_reason_code end,
        registration_reviewed_at = reviewed_at,
        registration_delete_after = p_delete_after,
        overall_status = case
          when p_action = 'rejected' then 'rejected'
          when p_action = 'approved' and other_status = 'approved' then 'approved'
          else 'pending'
        end,
        updated_at = reviewed_at
    where user_id = p_subject_user_id;
  else
    other_status := current_row.registration_status;
    update public.driver_eligibility
    set insurance_status = reviewed_status,
        insurance_rejection_code = case when p_action = 'approved' then null else p_reason_code end,
        insurance_reviewed_at = reviewed_at,
        insurance_delete_after = p_delete_after,
        overall_status = case
          when p_action = 'rejected' then 'rejected'
          when p_action = 'approved' and other_status = 'approved' then 'approved'
          else 'pending'
        end,
        updated_at = reviewed_at
    where user_id = p_subject_user_id;
  end if;

  resulting_status := case
    when p_action = 'rejected' then 'rejected'
    when p_action = 'approved' and other_status = 'approved' then 'approved'
    else 'pending'
  end;

  insert into public.driver_eligibility_review_audit (
    subject_user_id, reviewer_user_id, action, reason_code
  ) values (
    p_subject_user_id, p_reviewer_user_id, p_action,
    case when p_action = 'approved' then null else p_reason_code end
  );

  return resulting_status;
end;
$$;

revoke all on function public.review_driver_eligibility_document(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.review_driver_eligibility_document(uuid, uuid, text, text, text, timestamptz)
  to service_role;
