-- =====================================================================
-- Public profile function: expose expired-link status
-- - Keeps anon access through RPC only
-- - Returns {"__status":"EXPIRED"} when token exists but is expired
-- - Returns NULL for invalid/revoked/non-active employee
-- - Returns visibility-filtered profile payload when valid
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_public_profile_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public."TokenQR"%ROWTYPE;
  v_employe public."Employe"%ROWTYPE;
  v_departement_nom text;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT t.*
    INTO v_token
  FROM public."TokenQR" t
  WHERE t.token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_token.statut_token <> 'ACTIF'::public.statut_token_enum THEN
    RETURN NULL;
  END IF;

  IF v_token.expires_at IS NOT NULL AND v_token.expires_at <= now() THEN
    RETURN jsonb_build_object('__status', 'EXPIRED');
  END IF;

  SELECT e.*
    INTO v_employe
  FROM public."Employe" e
  WHERE e.id = v_token.employe_id
    AND e.is_active = true
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
