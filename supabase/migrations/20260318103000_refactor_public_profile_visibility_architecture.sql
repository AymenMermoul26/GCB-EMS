-- =====================================================================
-- Public profile visibility architecture hardening
-- - Keeps QR token validation on TokenQR
-- - Uses structured employee data only (no audit_log dependency)
-- - Returns explicit status + filtered profile payload
-- - Enforces an allowlist of public-safe fields even if visibility rows exist
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
  v_allowed_field_keys text[] := ARRAY[
    'nom',
    'prenom',
    'poste',
    'email',
    'telephone',
    'photo_url',
    'departement',
    'matricule'
  ];
  v_visible_field_keys text[] := ARRAY[]::text[];
  v_payload jsonb := '{}'::jsonb;
  v_profile jsonb := '{}'::jsonb;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object(
      'status', 'INVALID_OR_REVOKED',
      'profile', NULL
    );
  END IF;

  SELECT t.*
    INTO v_token
  FROM public."TokenQR" t
  WHERE t.token = p_token
  LIMIT 1;

  IF NOT FOUND OR v_token.statut_token <> 'ACTIF'::public.statut_token_enum THEN
    RETURN jsonb_build_object(
      'status', 'INVALID_OR_REVOKED',
      'profile', NULL
    );
  END IF;

  IF v_token.expires_at IS NOT NULL AND v_token.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'status', 'EXPIRED',
      'profile', NULL
    );
  END IF;

  SELECT e.*
    INTO v_employe
  FROM public."Employe" e
  WHERE e.id = v_token.employe_id
    AND e.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'INVALID_OR_REVOKED',
      'profile', NULL
    );
  END IF;

  SELECT d.nom
    INTO v_departement_nom
  FROM public."Departement" d
  WHERE d.id = v_employe.departement_id;

  SELECT COALESCE(array_agg(ev.field_key), ARRAY[]::text[])
    INTO v_visible_field_keys
  FROM public.employee_visibility ev
  WHERE ev.employe_id = v_employe.id
    AND ev.is_public = true
    AND ev.field_key = ANY(v_allowed_field_keys);

  v_payload := jsonb_strip_nulls(
    jsonb_build_object(
      'nom', v_employe.nom,
      'prenom', v_employe.prenom,
      'poste', v_employe.poste,
      'email', v_employe.email,
      'telephone', v_employe.telephone,
      'photo_url', v_employe.photo_url,
      'departement', v_departement_nom,
      'matricule', v_employe.matricule
    )
  );

  SELECT COALESCE(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
    INTO v_profile
  FROM jsonb_each(v_payload) AS kv(key, value)
  WHERE kv.key = ANY(v_visible_field_keys);

  RETURN jsonb_build_object(
    'status', 'VALID',
    'profile', v_profile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_token(text) TO anon, authenticated, service_role;

-- =====================================================================
-- End migration
-- =====================================================================
