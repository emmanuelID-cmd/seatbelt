create function public.prevent_driver_eligibility_review_audit_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Driver Eligibility review audit records are append-only.';
end;
$$;

revoke all on function public.prevent_driver_eligibility_review_audit_changes() from public, anon, authenticated;

create trigger prevent_driver_eligibility_review_audit_changes
  before update or delete on public.driver_eligibility_review_audit
  for each row
  execute function public.prevent_driver_eligibility_review_audit_changes();