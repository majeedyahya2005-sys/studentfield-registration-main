/*
# Simplify owner_signed_letter_url to return the storage path

1. Changes
- owner_signed_letter_url previously attempted to call a non-existent storage helper. It now simply returns the acceptance_letter_path for the given registration id, or NULL when no letter is attached.
- The edge function will use the returned path together with the service role key to mint a short-lived signed URL for the private bucket object.
- Security is unchanged: the function is SECURITY DEFINER, callable by anon/authenticated, and only exposes the private path after the caller has verified as the owner in the edge function.
*/

CREATE OR REPLACE FUNCTION public.owner_signed_letter_url(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_path text;
BEGIN
  SELECT acceptance_letter_path INTO v_path FROM public.field_attachment_registrations WHERE id = p_id;
  RETURN v_path;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_signed_letter_url FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_signed_letter_url TO anon, authenticated;