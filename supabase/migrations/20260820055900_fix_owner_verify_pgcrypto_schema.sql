/*
# Fix owner_verify to use pgcrypto digest with correct schema path

1. Why
- pgcrypto is installed in the `extensions` schema, not `public`.
- The owner_verify function called digest() without a schema qualifier, so it failed with a type cast error because the function could not find digest() in its search path.
- This caused both reported bugs: the password always failed verification (incorrect password), and because the edge function's list action also calls owner_verify first, no review data could be loaded.

2. Fix
- Recreate owner_verify with SET search_path = public, extensions so digest() resolves to the pgcrypto implementation.
- The function logic is otherwise unchanged: salted SHA-256 comparison against the stored hash.
*/

CREATE OR REPLACE FUNCTION public.owner_verify(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_row public.owner_credentials;
BEGIN
  SELECT password_hash, password_salt INTO v_row FROM public.owner_credentials WHERE id = 1;
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