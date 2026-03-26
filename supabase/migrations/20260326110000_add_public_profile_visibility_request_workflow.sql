
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'public_profile_visibility_request_status_enum'
  ) THEN
    CREATE TYPE public.public_profile_visibility_request_status_enum AS ENUM (
      'PENDING',
      'IN_REVIEW',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2) Request table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."PublicProfileVisibilityRequest" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL,
  requested_by_user_id uuid NOT NULL,
  status public.public_profile_visibility_request_status_enum NOT NULL DEFAULT 'PENDING'::public.public_profile_visibility_request_status_enum,
  current_field_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  requested_field_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  request_note text,
  review_note text,
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_publicprofilevisibilityrequest_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_publicprofilevisibilityrequest_requested_by_user
    FOREIGN KEY (requested_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_publicprofilevisibilityrequest_reviewed_by_user
    FOREIGN KEY (reviewed_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_publicprofilevisibilityrequest_employe_status
  ON public."PublicProfileVisibilityRequest" (employe_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_publicprofilevisibilityrequest_status_created_at
  ON public."PublicProfileVisibilityRequest" (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_publicprofilevisibilityrequest_created_at
  ON public."PublicProfileVisibilityRequest" (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_publicprofilevisibilityrequest_open_request
  ON public."PublicProfileVisibilityRequest" (employe_id)
  WHERE status IN (
    'PENDING'::public.public_profile_visibility_request_status_enum,
    'IN_REVIEW'::public.public_profile_visibility_request_status_enum
  );

DROP TRIGGER IF EXISTS trg_publicprofilevisibilityrequest_set_updated_at ON public."PublicProfileVisibilityRequest";
CREATE TRIGGER trg_publicprofilevisibilityrequest_set_updated_at
BEFORE UPDATE ON public."PublicProfileVisibilityRequest"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3) Helper functions
-- ---------------------------------------------------------------------
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
        'matricule'
      ]::text[],
      ARRAY[1, 2, 3, 4, 5, 6, 7, 8]::int[]
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

CREATE OR REPLACE FUNCTION public.get_published_public_profile_field_keys(p_employe_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT public.normalize_public_profile_visibility_field_keys(
    COALESCE(
      (
        SELECT array_agg(ev.field_key)
        FROM public.employee_visibility ev
        WHERE ev.employe_id = p_employe_id
          AND ev.is_public = true
      ),
      ARRAY[]::text[]
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_valid_public_profile_visibility_request_status_transition(
  p_old_status public.public_profile_visibility_request_status_enum,
  p_new_status public.public_profile_visibility_request_status_enum
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_old_status
    WHEN 'PENDING'::public.public_profile_visibility_request_status_enum THEN p_new_status IN (
      'PENDING'::public.public_profile_visibility_request_status_enum,
      'IN_REVIEW'::public.public_profile_visibility_request_status_enum,
      'APPROVED'::public.public_profile_visibility_request_status_enum,
      'REJECTED'::public.public_profile_visibility_request_status_enum
    )
    WHEN 'IN_REVIEW'::public.public_profile_visibility_request_status_enum THEN p_new_status IN (
      'IN_REVIEW'::public.public_profile_visibility_request_status_enum,
      'APPROVED'::public.public_profile_visibility_request_status_enum,
      'REJECTED'::public.public_profile_visibility_request_status_enum
    )
    WHEN 'APPROVED'::public.public_profile_visibility_request_status_enum THEN p_new_status = 'APPROVED'::public.public_profile_visibility_request_status_enum
    WHEN 'REJECTED'::public.public_profile_visibility_request_status_enum THEN p_new_status = 'REJECTED'::public.public_profile_visibility_request_status_enum
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.guard_public_profile_visibility_request_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.current_field_keys := public.normalize_public_profile_visibility_field_keys(NEW.current_field_keys);
  NEW.requested_field_keys := public.normalize_public_profile_visibility_field_keys(NEW.requested_field_keys);

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING'::public.public_profile_visibility_request_status_enum THEN
      RAISE EXCEPTION 'Public profile visibility requests must start in PENDING status.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.employe_id IS DISTINCT FROM OLD.employe_id
     OR NEW.requested_by_user_id IS DISTINCT FROM OLD.requested_by_user_id
     OR NEW.current_field_keys IS DISTINCT FROM OLD.current_field_keys
     OR NEW.requested_field_keys IS DISTINCT FROM OLD.requested_field_keys
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Public profile visibility request payload fields are immutable after creation.';
  END IF;

  IF NOT public.is_valid_public_profile_visibility_request_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Invalid public profile visibility request status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_publicprofilevisibilityrequest_mutation ON public."PublicProfileVisibilityRequest";
CREATE TRIGGER trg_guard_publicprofilevisibilityrequest_mutation
BEFORE INSERT OR UPDATE ON public."PublicProfileVisibilityRequest"
FOR EACH ROW EXECUTE FUNCTION public.guard_public_profile_visibility_request_mutation();

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
      'matricule'
    ]::text[]
  ) AS allowed(field_key)
  ON CONFLICT (employe_id, field_key)
  DO UPDATE SET
    is_public = EXCLUDED.is_public,
    updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------
-- 4) Request query / command RPCs
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_public_profile_visibility_requests()
RETURNS TABLE (
  id uuid,
  employe_id uuid,
  requested_by_user_id uuid,
  status text,
  current_field_keys text[],
  requested_field_keys text[],
  request_note text,
  review_note text,
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employe_id uuid;
BEGIN
  IF NOT public.is_employe_user() THEN
    RAISE EXCEPTION 'Only employees can access public profile visibility requests.';
  END IF;

  v_employe_id := public.current_employe_id();

  IF v_employe_id IS NULL THEN
    RAISE EXCEPTION 'Current employee context could not be resolved.';
  END IF;

  RETURN QUERY
  SELECT
    request.id,
    request.employe_id,
    request.requested_by_user_id,
    request.status::text,
    request.current_field_keys,
    request.requested_field_keys,
    request.request_note,
    request.review_note,
    request.reviewed_by_user_id,
    request.reviewed_at,
    request.created_at,
    request.updated_at
  FROM public."PublicProfileVisibilityRequest" request
  WHERE request.employe_id = v_employe_id
  ORDER BY request.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_public_profile_visibility_requests(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_departement_id uuid DEFAULT NULL,
  p_employe_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  employe_id uuid,
  employe_matricule text,
  employe_nom text,
  employe_prenom text,
  departement_id uuid,
  departement_nom text,
  requested_by_user_id uuid,
  status text,
  current_field_keys text[],
  requested_field_keys text[],
  live_field_keys text[],
  request_note text,
  review_note text,
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := NULLIF(BTRIM(COALESCE(p_status, '')), '');
  v_search text := NULLIF(LOWER(BTRIM(COALESCE(p_search, ''))), '');
BEGIN
  IF NOT public.is_admin_rh() THEN
    RAISE EXCEPTION 'Only administrators can review public profile visibility requests.';
  END IF;

  RETURN QUERY
  SELECT
    request.id,
    request.employe_id,
    employee.matricule,
    employee.nom,
    employee.prenom,
    employee.departement_id,
    department.nom,
    request.requested_by_user_id,
    request.status::text,
    request.current_field_keys,
    request.requested_field_keys,
    public.get_published_public_profile_field_keys(request.employe_id),
    request.request_note,
    request.review_note,
    request.reviewed_by_user_id,
    request.reviewed_at,
    request.created_at,
    request.updated_at
  FROM public."PublicProfileVisibilityRequest" request
  INNER JOIN public."Employe" employee
    ON employee.id = request.employe_id
  LEFT JOIN public."Departement" department
    ON department.id = employee.departement_id
  WHERE (
      v_status IS NULL
      OR request.status::text = v_status
    )
    AND (
      p_departement_id IS NULL
      OR employee.departement_id = p_departement_id
    )
    AND (
      p_employe_id IS NULL
      OR request.employe_id = p_employe_id
    )
    AND (
      v_search IS NULL
      OR LOWER(
        CONCAT_WS(
          ' ',
          employee.prenom,
          employee.nom,
          employee.matricule,
          COALESCE(request.request_note, ''),
          COALESCE(request.review_note, '')
        )
      ) LIKE '%' || v_search || '%'
    )
  ORDER BY request.created_at DESC;
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
          'matricule'
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
        WHEN v_next_status = 'IN_REVIEW'::public.public_profile_visibility_request_status_enum THEN 'Public profile visibility request under review'
        WHEN v_next_status = 'APPROVED'::public.public_profile_visibility_request_status_enum THEN 'Public profile visibility request approved'
        ELSE 'Public profile visibility request rejected'
      END,
      CASE
        WHEN v_next_status = 'IN_REVIEW'::public.public_profile_visibility_request_status_enum THEN 'HR is reviewing your requested public profile visibility changes.'
        WHEN v_next_status = 'APPROVED'::public.public_profile_visibility_request_status_enum THEN 'Your approved public profile visibility settings are now live.'
        ELSE 'Your requested public profile visibility changes were rejected.'
      END,
      '/employee/my-qr',
      false,
      jsonb_build_object(
        'scope', 'employee_public_profile_visibility_request',
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
      'previous_status', v_request.status::text,
      'next_status', v_next_status::text,
      'review_note', v_review_note
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
        'request_id', p_request_id,
        'current_field_keys', v_request.current_field_keys,
        'requested_field_keys', v_request.requested_field_keys,
        'public_fields', v_request.requested_field_keys,
        'trigger_source', 'public_profile_visibility_request_approval'
      )
    );
  END IF;

  RETURN p_request_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------
ALTER TABLE public."PublicProfileVisibilityRequest" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_publicprofilevisibilityrequest ON public."PublicProfileVisibilityRequest";
DROP POLICY IF EXISTS employee_select_own_publicprofilevisibilityrequest ON public."PublicProfileVisibilityRequest";

CREATE POLICY admin_all_publicprofilevisibilityrequest
ON public."PublicProfileVisibilityRequest"
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY employee_select_own_publicprofilevisibilityrequest
ON public."PublicProfileVisibilityRequest"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
);

-- ---------------------------------------------------------------------
-- 6) Grants
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PublicProfileVisibilityRequest" TO authenticated;

REVOKE ALL ON FUNCTION public.normalize_public_profile_visibility_field_keys(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_published_public_profile_field_keys(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_public_profile_visibility_request_status_transition(
  public.public_profile_visibility_request_status_enum,
  public.public_profile_visibility_request_status_enum
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_public_profile_visibility_request_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_public_profile_visibility_field_keys(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_public_profile_visibility_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_public_profile_visibility_requests(text, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_my_public_profile_visibility_request(text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_public_profile_visibility_request_status(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_public_profile_visibility_field_keys(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_published_public_profile_field_keys(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_public_profile_visibility_request_status_transition(
  public.public_profile_visibility_request_status_enum,
  public.public_profile_visibility_request_status_enum
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_public_profile_visibility_request_mutation() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_public_profile_visibility_field_keys(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_public_profile_visibility_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_public_profile_visibility_requests(text, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_my_public_profile_visibility_request(text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_public_profile_visibility_request_status(uuid, text, text) TO authenticated, service_role;

-- =====================================================================
-- End migration
-- =====================================================================
