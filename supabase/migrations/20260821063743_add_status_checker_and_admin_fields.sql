/*
# Add student status checker and admin application fields

1. New columns on field_attachment_registrations
- acceptance_message (text, nullable) — message the admin writes when accepting a student.
- rejection_reason (text, nullable) — reason the admin gives when rejecting a student.
- updated_at (timestamptz, defaults to now()) — timestamp of the last admin update.

2. New SECURITY DEFINER function: student_check_status
- student_check_status(p_email text) returns a single row with ONLY the fields a student should see:
  full_name, registration_number, email, host_organisation, placement_location, start_date, end_date,
  review_status, reviewer_response, acceptance_message, rejection_reason, created_at, updated_at.
- Limited projection — does NOT expose phone, emergency contact, supervisor names, letter path, or id.
- Runs as SECURITY DEFINER, bypasses the RLS that locks the table for anon SELECT.
- Callable by anon + authenticated. Email is lowercased/trimmed before matching.

3. Replaced function: owner_update_review
- DROPped and recreated with new signature: p_acceptance_message, p_rejection_reason,
  p_host_organisation, p_placement_location, p_start_date, p_end_date added.
- Sets updated_at = now() on every update. Validates status server-side.

4. Security
- No new RLS policies. Table stays locked. student_check_status exposes only a safe subset.

5. Notes
- updated_at is separate from reviewed_at (reviewed_at is null while pending).
- New columns are nullable so existing rows are unaffected.
*/

ALTER TABLE public.field_attachment_registrations
  ADD COLUMN IF NOT EXISTS acceptance_message text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS field_attachment_registrations_email_idx
ON public.field_attachment_registrations (lower(email));

CREATE OR REPLACE FUNCTION public.student_check_status(p_email text)
RETURNS TABLE (
  full_name text,
  registration_number text,
  email text,
  host_organisation text,
  placement_location text,
  start_date date,
  end_date date,
  review_status text,
  reviewer_response text,
  acceptance_message text,
  rejection_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT
    r.full_name, r.registration_number, r.email, r.host_organisation, r.placement_location,
    r.start_date, r.end_date, r.review_status, r.reviewer_response, r.acceptance_message,
    r.rejection_reason, r.created_at, r.updated_at
  FROM public.field_attachment_registrations r
  WHERE lower(r.email) = lower(TRIM(COALESCE(p_email, '')))
  ORDER BY r.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.student_check_status(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_check_status(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.owner_update_review(uuid, text, text);

CREATE OR REPLACE FUNCTION public.owner_update_review(
  p_id uuid,
  p_status text,
  p_response text,
  p_acceptance_message text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_host_organisation text DEFAULT NULL,
  p_placement_location text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS public.field_attachment_registrations
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.field_attachment_registrations;
BEGIN
  IF p_status NOT IN ('pending', 'approved', 'needs_changes', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.field_attachment_registrations
  SET review_status = p_status,
      reviewer_response = NULLIF(TRIM(COALESCE(p_response, '')), ''),
      acceptance_message = NULLIF(TRIM(COALESCE(p_acceptance_message, '')), ''),
      rejection_reason = NULLIF(TRIM(COALESCE(p_rejection_reason, '')), ''),
      host_organisation = COALESCE(p_host_organisation, host_organisation),
      placement_location = COALESCE(p_placement_location, placement_location),
      start_date = COALESCE(p_start_date, start_date),
      end_date = COALESCE(p_end_date, end_date),
      reviewed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_update_review(uuid, text, text, text, text, text, text, date, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_update_review(uuid, text, text, text, text, text, text, date, date) TO anon, authenticated;
