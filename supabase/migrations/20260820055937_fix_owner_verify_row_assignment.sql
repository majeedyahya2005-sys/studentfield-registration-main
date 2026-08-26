/*
# Fix owner_verify row assignment bug

1. Why
- owner_verify declared v_row as public.owner_credentials (a composite row type with id, password_hash, password_salt, updated_at).
- SELECT password_hash, password_salt INTO v_row assigns columns positionally into the row variable's fields. The first field is id (integer), so the text hash was being cast to integer, causing "invalid input syntax for type integer".
- This is why every password check failed.

2. Fix
- Change to SELECT * INTO v_row so the entire row maps correctly by position to the composite variable.
*/

CREATE OR REPLACE FUNCTION public.owner_verify(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_row public.owner_credentials;
BEGIN
  SELECT * INTO v_row FROM public.owner_credentials WHERE id = 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  RETURN v_row.password_hash = encode(
    extensions.digest(v_row.password_salt || COALESCE(p_password, ''), 'sha256'),
    'hex'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_verify FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_verify TO anon, authenticated;