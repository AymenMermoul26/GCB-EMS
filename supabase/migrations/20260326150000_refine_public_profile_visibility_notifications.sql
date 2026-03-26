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
  v_user_id uuid;
  v_employe_id uuid;
  v_request_id uuid;
  v_requested_field_keys text[] := ARRAY[]::text[];
  v_current_field_keys text[] := ARRAY[]::text[];
  v_employee_name text;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to submit a public profile visibility request.';
  END IF;

  SELECT profile.employe_id
  INTO v_employe_id
  FROM public."ProfilUtilisateur" profile
  WHERE profile.user_id = v_user_id
    AND profile.role = 'EMPLOYE'
  LIMIT 1;

  IF v_employe_id IS NULL THEN
    RAISE EXCEPTION 'Only employees can submit public profile visibility requests.';
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
  VALUES (
    v_user_id,
    'Public profile request submitted',
    'Your public profile visibility request was submitted for review.',
    '/employee/my-qr',
    false,
    jsonb_build_object(
      'scope', 'employee_public_profile_visibility_request',
      'event_key', 'REQUEST_SUBMITTED',
      'visibility_request_id', v_request_id,
      'employe_id', v_employe_id,
      'status', 'PENDING'
    )
  );

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
      'event_key', 'REQUEST_SUBMITTED',
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

CREATE OR REPLACE FUNCTION public.set_public_profile_visibility_request_status(
  p_request_id uuid,
  p_status text,
  p_review_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public."PublicProfileVisibilityRequest"%ROWTYPE;
  v_actor_user_id uuid;
  v_employee_user_id uuid;
  v_next_status public.public_profile_visibility_request_status_enum;
  v_review_note text := NULLIF(BTRIM(COALESCE(p_review_note, '')), '');
BEGIN
  IF NOT public.is_admin_rh() THEN
    RAISE EXCEPTION 'Only administrators can review public profile visibility requests.';
  END IF;

  v_actor_user_id := auth.uid();

  CASE UPPER(BTRIM(COALESCE(p_status, '')))
    WHEN 'IN_REVIEW' THEN
      v_next_status := 'IN_REVIEW'::public.public_profile_visibility_request_status_enum;
    WHEN 'APPROVED' THEN
      v_next_status := 'APPROVED'::public.public_profile_visibility_request_status_enum;
    WHEN 'REJECTED' THEN
      v_next_status := 'REJECTED'::public.public_profile_visibility_request_status_enum;
    ELSE
      RAISE EXCEPTION 'Unsupported public profile visibility request status: %', p_status;
  END CASE;

  SELECT request.*
  INTO v_request
  FROM public."PublicProfileVisibilityRequest" request
  WHERE request.id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public profile visibility request not found.';
  END IF;

  IF NOT public.is_valid_public_profile_visibility_request_status_transition(v_request.status, v_next_status) THEN
    RAISE EXCEPTION 'Invalid public profile visibility request status transition: % -> %', v_request.status, v_next_status;
  END IF;

  IF v_next_status = 'APPROVED'::public.public_profile_visibility_request_status_enum THEN
    PERFORM public.apply_public_profile_visibility_field_keys(
      v_request.employe_id,
      v_request.requested_field_keys
    );
  END IF;

  UPDATE public."PublicProfileVisibilityRequest"
  SET status = v_next_status,
      review_note = CASE
        WHEN v_review_note IS NULL THEN review_note
        ELSE v_review_note
      END,
      reviewed_by_user_id = v_actor_user_id,
      reviewed_at = now()
  WHERE id = p_request_id;

  SELECT profile.user_id
  INTO v_employee_user_id
  FROM public."ProfilUtilisateur" profile
  WHERE profile.employe_id = v_request.employe_id
    AND profile.role = 'EMPLOYE'
  LIMIT 1;

  IF v_employee_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link, is_read, metadata_json)
    VALUES (
      v_employee_user_id,
      CASE
        WHEN v_next_status = 'IN_REVIEW'::public.public_profile_visibility_request_status_enum THEN 'Public profile request in review'
        WHEN v_next_status = 'APPROVED'::public.public_profile_visibility_request_status_enum THEN 'Public profile updated'
        ELSE 'Public profile request rejected'
      END,
      CASE
        WHEN v_next_status = 'IN_REVIEW'::public.public_profile_visibility_request_status_enum THEN 'Your public profile visibility request is now under review.'
        WHEN v_next_status = 'APPROVED'::public.public_profile_visibility_request_status_enum THEN 'Your public profile visibility request was approved. Your QR profile has been updated.'
        ELSE 'Your public profile visibility request was rejected.'
      END,
      '/employee/my-qr',
      false,
      jsonb_build_object(
        'scope', 'employee_public_profile_visibility_request',
        'event_key', CASE
          WHEN v_next_status = 'IN_REVIEW'::public.public_profile_visibility_request_status_enum THEN 'REQUEST_IN_REVIEW'
          WHEN v_next_status = 'APPROVED'::public.public_profile_visibility_request_status_enum THEN 'REQUEST_APPROVED'
          ELSE 'REQUEST_REJECTED'
        END,
        'visibility_request_id', p_request_id,
        'employe_id', v_request.employe_id,
        'status', v_next_status::text
      )
    );
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    details_json
  )
  VALUES (
    v_actor_user_id,
    CASE v_next_status
      WHEN 'IN_REVIEW'::public.public_profile_visibility_request_status_enum THEN 'PUBLIC_PROFILE_VISIBILITY_REQUEST_IN_REVIEW'
      WHEN 'APPROVED'::public.public_profile_visibility_request_status_enum THEN 'PUBLIC_PROFILE_VISIBILITY_REQUEST_APPROVED'
      ELSE 'PUBLIC_PROFILE_VISIBILITY_REQUEST_REJECTED'
    END,
    'PublicProfileVisibilityRequest',
    p_request_id,
    jsonb_build_object(
      'employe_id', v_request.employe_id,
      'current_field_keys', v_request.current_field_keys,
      'requested_field_keys', v_request.requested_field_keys,
      'review_note', v_review_note,
      'status', v_next_status::text
    )
  );

  IF v_next_status = 'APPROVED'::public.public_profile_visibility_request_status_enum THEN
    INSERT INTO public.audit_log (
      actor_user_id,
      action,
      target_type,
      target_id,
      details_json
    )
    VALUES (
      v_actor_user_id,
      'VISIBILITY_UPDATED',
      'employee_visibility',
      v_request.employe_id,
      jsonb_build_object(
        'employe_id', v_request.employe_id,
        'public_field_keys', v_request.requested_field_keys,
        'trigger_source', 'public_profile_visibility_request_approval',
        'request_id', p_request_id
      )
    );
  END IF;

  RETURN p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_public_profile_visibility_request(text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_public_profile_visibility_request_status(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_my_public_profile_visibility_request(text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_public_profile_visibility_request_status(uuid, text, text) TO authenticated, service_role;
