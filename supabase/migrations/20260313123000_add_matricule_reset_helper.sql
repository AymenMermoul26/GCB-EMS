-- Helper for dev/demo resets to explicitly control the custom employee matricule sequence.
-- TRUNCATE ... RESTART IDENTITY does not reset standalone sequences such as employe_matricule_seq.

CREATE OR REPLACE FUNCTION public.reset_employe_matricule_sequence(
  p_value bigint DEFAULT 1,
  p_is_called boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM setval(
    'public.employe_matricule_seq',
    GREATEST(COALESCE(p_value, 1), 1),
    COALESCE(p_is_called, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_employe_matricule_sequence(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_employe_matricule_sequence(bigint, boolean) TO service_role;
