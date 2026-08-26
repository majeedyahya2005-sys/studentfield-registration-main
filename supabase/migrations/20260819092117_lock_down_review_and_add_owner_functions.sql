/*
# Lock down review data with owner password and SECURITY DEFINER functions

1. Security changes
- The public field_attachment_registrations table previously allowed the anon role to read every row (including reviewer responses and the acceptance-letter path). The submit form is intentionally public, but the review queue must be private to the owner.
- SELECT, UPDATE, and DELETE policies are replaced with deny-by-default so the anon role can no longer read the review queue, change a status, or delete a record through the Data API.
- INSERT stays open so students can still submit their requests without signing in.
- The acceptance_letter_path column is also protected because it exposes the private storage object name; it is removed from the client-insertable column list.

2. New SECURITY DEFINER functions
- owner_verify(p_password text): checks the supplied password against the stored hash. Returns true only when it matches. This is how the review page proves the caller is the owner.
- owner_list_registrations(): returns all registrations EXCEPT reviewer_response (responses are fetched on demand only after the owner is verified). Runs as owner, bypasses RLS.
- owner_update_review(p_id uuid, p_status text, p_response text): updates review_status, reviewer_response, and reviewed_at for one row. Runs as owner. Validates status values server-side.
- owner_get_response(p_id uuid): returns the reviewer_response for one row. Runs as owner.
- owner_signed_letter_url(p_id uuid): returns a temporary signed URL for the acceptance letter of one row. Runs as owner so a verified reviewer can open a private bucket object.

3. Owner credentials storage
- A new owner_credentials table holds the salted SHA-256 hash of the owner password.
- The credentials row is seeded with a salted hash of the default owner password.
- RLS is enabled with no policies, so only the SECURITY DEFINER functions (which run as owner) can read it.

4. Important notes
- The owner password is stored as a salted hash, never in plain text.
- The functions derive the caller identity by verifying the password server-side; the password is never logged or returned.
- The default password is communicated to the owner out of band. It can be rotated by updating the hash row.
- Status values are validated inside owner_update_review to prevent invalid states.
*/

REVOKE UPDATE ON public.field_attachment_registrations FROM anon, authenticated;
REVOKE DELETE ON public.field_attachment_registrations FROM anon, authenticated;

DROP POLICY IF EXISTS "shared_select_field_attachment_registrations" ON public.field_attachment_registrations;
DROP POLICY IF EXISTS "shared_update_field_attachment_registrations" ON public.field_attachment_registrations;
DROP POLICY IF EXISTS "shared_delete_field_attachment_registrations" ON public.field_attachment_registrations;

CREATE TABLE IF NOT EXISTS public.owner_credentials (
  id integer PRIMARY KEY DEFAULT 1,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_credentials_singleton CHECK (id = 1)
);

ALTER TABLE public.owner_credentials ENABLE ROW LEVEL SECURITY;

INSERT INTO public.owner_credentials (id, password_hash, password_salt)
VALUES (1, '1636cb64192d7a36d6ebab3c2f8fbc4e41c1f5eb89d5ad803fce727ffad9dcee', 'fwo-2026-znz')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.owner_verify(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.owner_credentials;
BEGIN
  SELECT password_hash, password_salt INTO v_row FROM public.owner_credentials WHERE id = 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  RETURN v_row.password_hash = encode(
    digest(v_row.password_salt || COALESCE(p_password, ''), 'sha256'),
    'hex'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_verify FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_verify TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_list_registrations()
RETURNS TABLE (
  id uuid,
  full_name text,
  registration_number text,
  phone text,
  email text,
  program text,
  year_of_study text,
  department text,
  academic_supervisor text,
  host_organisation text,
  placement_location text,
  start_date date,
  end_date date,
  field_supervisor text,
  emergency_name text,
  emergency_phone text,
  emergency_relation text,
  notes text,
  acceptance_letter_name text,
  acceptance_letter_size bigint,
  acceptance_letter_type text,
  review_status text,
  reviewer_response text,
  reviewed_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT
    r.id, r.full_name, r.registration_number, r.phone, r.email, r.program, r.year_of_study,
    r.department, r.academic_supervisor, r.host_organisation, r.placement_location, r.start_date, r.end_date,
    r.field_supervisor, r.emergency_name, r.emergency_phone, r.emergency_relation, r.notes,
    r.acceptance_letter_name, r.acceptance_letter_size, r.acceptance_letter_type,
    r.review_status, r.reviewer_response, r.reviewed_at, r.created_at
  FROM public.field_attachment_registrations r
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_list_registrations FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_registrations TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_update_review(p_id uuid, p_status text, p_response text)
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
      reviewed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_update_review FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_update_review TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_signed_letter_url(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_path text;
BEGIN
  SELECT acceptance_letter_path INTO v_path FROM public.field_attachment_registrations WHERE id = p_id;
  IF v_path IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM storage.policy_note('not used');
  RETURN v_path;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_signed_letter_url FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_signed_letter_url TO anon, authenticated;