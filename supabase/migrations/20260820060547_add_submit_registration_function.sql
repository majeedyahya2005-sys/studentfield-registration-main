/*
# Add submit_registration function for student submissions

1. Why
- The lockdown migration dropped the SELECT policy on field_attachment_registrations so anon can no longer read rows through the Data API.
- The frontend used .insert(payload).select('id') to get the new row's id after insert. The insert succeeds (the INSERT policy is open), but the returning SELECT is blocked by RLS, so the client gets null and shows "Your application could not be saved."
- This function inserts a new row and returns only the new id, running as SECURITY DEFINER so it bypasses RLS for the return. The frontend calls this via RPC instead of a direct table insert.

2. New function
- submit_registration(p_* fields): inserts one row with all student-provided fields and returns the new uuid id. review_status defaults to 'pending', review fields stay null.
- Callable by anon/authenticated so the public form works without signing in.
- Only inserts student-writable columns; review_status, reviewer_response, reviewed_at, and acceptance_letter_* are not set here (acceptance letter is attached separately via owner_attach_letter).
*/

CREATE OR REPLACE FUNCTION public.submit_registration(
  p_full_name text,
  p_registration_number text,
  p_phone text,
  p_email text,
  p_program text,
  p_year_of_study text,
  p_department text,
  p_academic_supervisor text,
  p_host_organisation text,
  p_placement_location text,
  p_start_date date,
  p_end_date date,
  p_field_supervisor text,
  p_emergency_name text,
  p_emergency_phone text,
  p_emergency_relation text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.field_attachment_registrations (
    full_name, registration_number, phone, email, program, year_of_study, department, academic_supervisor,
    host_organisation, placement_location, start_date, end_date, field_supervisor,
    emergency_name, emergency_phone, emergency_relation, notes
  ) VALUES (
    p_full_name, p_registration_number, p_phone, p_email, p_program, p_year_of_study, p_department, p_academic_supervisor,
    p_host_organisation, p_placement_location, p_start_date, p_end_date, p_field_supervisor,
    p_emergency_name, p_emergency_phone, p_emergency_relation, p_notes
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_registration FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_registration TO anon, authenticated;