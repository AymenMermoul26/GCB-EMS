-- =====================================================================
-- Expand public profile safe professional and education fields
-- - Extends the employee-request/admin-approval visibility allowlist
-- - Keeps the live employee_visibility state separate from pending requests
-- - Expands the public QR read model with approved professional/education data
-- =====================================================================

CREATE OR REPLACE FUNCTION public.normalize_public_profile_visibility_field_keys(p_field_keys text[])
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  WITH allowed(field_key, position) AS (
    SELECT * FROM unnest(
      ARRAY[
        'nom',
        'prenom',
        'poste',
        'email',
        'telephone',
        'photo_url',
        'departement',
        'matricule',
        'categorie_professionnelle',
        'diplome',
        'specialite',
        'universite'
      ]::text[],
      ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[]
    )
  ),
  normalized AS (
    SELECT DISTINCT a.field_key, a.position
    FROM unnest(COALESCE(p_field_keys, ARRAY[]::text[])) AS requested(field_key)
    INNER JOIN allowed a
      ON a.field_key = NULLIF(BTRIM(requested.field_key), '')
  )
  SELECT COALESCE(array_agg(field_key ORDER BY position), ARRAY[]::text[])
  FROM normalized;
$$;

CREATE OR REPLACE FUNCTION public.apply_public_profile_visibility_field_keys(
  p_employe_id uuid,
  p_field_keys text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_field_keys text[] := public.normalize_public_profile_visibility_field_keys(p_field_keys);
BEGIN
  INSERT INTO public.employee_visibility (
    employe_id,
    field_key,
    is_public
  )
  SELECT
    p_employe_id,
    field_key,
    field_key = ANY(v_requested_field_keys)
  FROM unnest(
    ARRAY[
      'nom',
      'prenom',
      'poste',
      'email',
      'telephone',
      'photo_url',
      'departement',
      'matricule',
      'categorie_professionnelle',
      'diplome',
      'specialite',
      'universite'
    ]::text[]
  ) AS allowed(field_key)
  ON CONFLICT (employe_id, field_key)
  DO UPDATE SET
    is_public = EXCLUDED.is_public,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_my_public_profile_visibility_request(
  p_requested_field_keys text[] DEFAULT ARRAY[]::text[],
  p_request_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employe_id uuid;
  v_user_id uuid;
  v_request_id uuid;
  v_requested_field_keys text[];
  v_current_field_keys text[];
  v_employee_name text;
BEGIN
  IF NOT public.is_employe_user() THEN
    RAISE EXCEPTION 'Only employees can create public profile visibility requests.';
  END IF;

  v_user_id := auth.uid();
  v_employe_id := public.current_employe_id();

  IF v_user_id IS NULL OR v_employe_id IS NULL THEN
    RAISE EXCEPTION 'Current employee context could not be resolved.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_requested_field_keys, ARRAY[]::text[])) AS requested(field_key)
    WHERE NULLIF(BTRIM(requested.field_key), '') IS NOT NULL
      AND NULLIF(BTRIM(requested.field_key), '') <> ALL (
        ARRAY[
          'nom',
          'prenom',
          'poste',
          'email',
          'telephone',
          'photo_url',
          'departement',
          'matricule',
          'categorie_professionnelle',
          'diplome',
          'specialite',
          'universite'
        ]::text[]
      )
  ) THEN
    RAISE EXCEPTION 'Unsupported public profile fields were submitted.';
  END IF;

  v_requested_field_keys := public.normalize_public_profile_visibility_field_keys(p_requested_field_keys);
  v_current_field_keys := public.get_published_public_profile_field_keys(v_employe_id);

  IF v_requested_field_keys = v_current_field_keys THEN
    RAISE EXCEPTION 'Requested visibility matches the current published public profile.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."PublicProfileVisibilityRequest" request
    WHERE request.employe_id = v_employe_id
      AND request.status IN (
        'PENDING'::public.public_profile_visibility_request_status_enum,
        'IN_REVIEW'::public.public_profile_visibility_request_status_enum
      )
  ) THEN
    RAISE EXCEPTION 'A public profile visibility request is already pending review.';
  END IF;

  INSERT INTO public."PublicProfileVisibilityRequest" (
    employe_id,
    requested_by_user_id,
    status,
    current_field_keys,
    requested_field_keys,
    request_note
  )
  VALUES (
    v_employe_id,
    v_user_id,
    'PENDING'::public.public_profile_visibility_request_status_enum,
    v_current_field_keys,
    v_requested_field_keys,
    NULLIF(BTRIM(COALESCE(p_request_note, '')), '')
  )
  RETURNING id INTO v_request_id;

  SELECT CONCAT_WS(' ', employee.prenom, employee.nom)
  INTO v_employee_name
  FROM public."Employe" employee
  WHERE employee.id = v_employe_id
  LIMIT 1;

  INSERT INTO public.notifications (user_id, title, body, link, is_read, metadata_json)
  SELECT
    profile.user_id,
    'New public profile visibility request',
    FORMAT(
      '%s submitted public profile visibility changes for review.',
      COALESCE(NULLIF(BTRIM(v_employee_name), ''), 'An employee')
    ),
    '/admin/requests',
    false,
    jsonb_build_object(
      'scope', 'admin_public_profile_visibility_request',
      'visibility_request_id', v_request_id,
      'employe_id', v_employe_id,
      'status', 'PENDING'
    )
  FROM public."ProfilUtilisateur" profile
  WHERE profile.role = 'ADMIN_RH'
    AND profile.user_id IS NOT NULL;

  INSERT INTO public.audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    details_json
  )
  VALUES (
    v_user_id,
    'PUBLIC_PROFILE_VISIBILITY_REQUEST_SUBMITTED',
    'PublicProfileVisibilityRequest',
    v_request_id,
    jsonb_build_object(
      'employe_id', v_employe_id,
      'current_field_keys', v_current_field_keys,
      'requested_field_keys', v_requested_field_keys,
      'request_note', NULLIF(BTRIM(COALESCE(p_request_note, '')), '')
    )
  );

  RETURN v_request_id;
END;
$$;

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
    'matricule',
    'categorie_professionnelle',
    'diplome',
    'specialite',
    'universite'
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
      'matricule', v_employe.matricule,
      'categorie_professionnelle', v_employe.categorie_professionnelle,
      'diplome', v_employe.diplome,
      'specialite', v_employe.specialite,
      'universite', v_employe.universite
    )
  );

  SELECT COALESCE(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
    INTO v_profile
  FROM jsonb_each(v_payload) AS kv(key, value)
  WHERE kv.key = ANY(v_visible_field_keys);

  IF v_profile <> '{}'::jsonb THEN
    INSERT INTO public.audit_log (
      actor_user_id,
      action,
      target_type,
      target_id,
      details_json
    )
    VALUES (
      NULL,
      'PUBLIC_PROFILE_VIEWED',
      'Employe',
      v_employe.id,
      jsonb_strip_nulls(
        jsonb_build_object(
          'employee_id', v_employe.id,
          'employee_name', concat_ws(' ', v_employe.prenom, v_employe.nom),
          'matricule', v_employe.matricule,
          'token_id', v_token.id,
          'public_fields', to_jsonb(v_visible_field_keys),
          'public_fields_count', COALESCE(array_length(v_visible_field_keys, 1), 0),
          'access_channel', 'public_qr'
        )
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'VALID',
    'profile', v_profile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_public_profile_visibility_field_keys(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_public_profile_visibility_field_keys(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_my_public_profile_visibility_request(text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_profile_by_token(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_public_profile_visibility_field_keys(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_public_profile_visibility_field_keys(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_my_public_profile_visibility_request(text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_token(text) TO anon, authenticated, service_role;

-- =====================================================================
-- End migration
-- =====================================================================
