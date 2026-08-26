/*
# Add owner_attach_letter for student-side attachment completion

1. Why
- The previous migration revoked UPDATE from anon/authenticated so the owner password gate is the only way to change review fields.
- That also blocked the legitimate student flow: after uploading the acceptance letter to storage, the submit form needs to record the file path, name, size, and type on its own row.
- This migration adds a SECURITY DEFINER function that performs exactly that narrow update and nothing else.

2. New function
- owner_attach_letter(p_id uuid, p_path text, p_name text, p_size bigint, p_type text): sets acceptance_letter_path, acceptance_letter_name, acceptance_letter_size, and acceptance_letter_type for the row with id = p_id. It does not touch review_status, reviewer_response, or reviewed_at. Callable by anon/authenticated so the public submit form can use it.
*/

CREATE OR REPLACE FUNCTION public.owner_attach_letter(p_id uuid, p_path text, p_name text, p_size bigint, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.field_attachment_registrations
  SET
    acceptance_letter_path = p_path,
    acceptance_letter_name = p_name,
    acceptance_letter_size = p_size,
    acceptance_letter_type = p_type
  WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_attach_letter FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_attach_letter TO anon, authenticated;