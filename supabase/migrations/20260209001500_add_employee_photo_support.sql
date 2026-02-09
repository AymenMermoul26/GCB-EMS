-- =====================================================================
-- Add employee photo support
-- - Adds photo_url to "Employe"
-- - Extends get_public_profile_by_token to expose photo_url when public
-- =====================================================================

ALTER TABLE public."Employe"
ADD COLUMN IF NOT EXISTS photo_url text;

CREATE OR REPLACE FUNCTION public.get_public_profile_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employe public."Employe"%ROWTYPE;
  v_departement_nom text;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT e.*
    INTO v_employe
  FROM public."TokenQR" t
  INNER JOIN public."Employe" e ON e.id = t.employe_id
  WHERE t.token = p_token
    AND t.statut_token = 'ACTIF'::public.statut_token_enum
    AND e.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT d.nom
    INTO v_departement_nom
  FROM public."Departement" d
  WHERE d.id = v_employe.departement_id;

  v_payload := jsonb_build_object(
    'id', v_employe.id,
    'matricule', v_employe.matricule,
    'nom', v_employe.nom,
    'prenom', v_employe.prenom,
    'poste', v_employe.poste,
    'email', v_employe.email,
    'telephone', v_employe.telephone,
    'departement', v_departement_nom,
    'photo_url', v_employe.photo_url
  );

  SELECT COALESCE(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
    INTO v_result
  FROM jsonb_each(v_payload) AS kv(key, value)
  INNER JOIN public.employee_visibility ev
    ON ev.employe_id = v_employe.id
   AND ev.field_key = kv.key
   AND ev.is_public = true;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_token(text) TO anon, authenticated, service_role;

-- =====================================================================
-- End migration
-- =====================================================================
