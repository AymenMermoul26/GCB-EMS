-- =====================================================================
-- Payslip request and delivery workflow foundation
-- - Adds employee self-service payslip requests
-- - Adds payroll-side request fulfillment and secure document delivery
-- - Preserves employee self-only access and payroll-only workflow control
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Request status enum
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payslip_request_status_enum'
  ) THEN
    CREATE TYPE public.payslip_request_status_enum AS ENUM (
      'PENDING',
      'IN_REVIEW',
      'FULFILLED',
      'REJECTED'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2) Payslip request and delivery tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."PayslipRequest" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL,
  payroll_period_id uuid NOT NULL,
  requested_by_user_id uuid NOT NULL,
  status public.payslip_request_status_enum NOT NULL DEFAULT 'PENDING'::public.payslip_request_status_enum,
  request_note text,
  review_note text,
  linked_payslip_id uuid,
  reviewed_by_user_id uuid,
  fulfilled_by_user_id uuid,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_paysliprequest_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_paysliprequest_payroll_period
    FOREIGN KEY (payroll_period_id)
    REFERENCES public."PayrollPeriod" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_paysliprequest_requested_by_user
    FOREIGN KEY (requested_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_paysliprequest_linked_payslip
    FOREIGN KEY (linked_payslip_id)
    REFERENCES public."Payslip" (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_paysliprequest_reviewed_by_user
    FOREIGN KEY (reviewed_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_paysliprequest_fulfilled_by_user
    FOREIGN KEY (fulfilled_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."PayslipDelivery" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_request_id uuid NOT NULL,
  employe_id uuid NOT NULL,
  payroll_period_id uuid NOT NULL,
  payslip_id uuid,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/pdf',
  file_size_bytes bigint,
  publication_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payslipdelivery_request UNIQUE (payslip_request_id),
  CONSTRAINT uq_payslipdelivery_storage_path UNIQUE (storage_path),
  CONSTRAINT ck_payslipdelivery_file_size_non_negative CHECK (
    file_size_bytes IS NULL OR file_size_bytes >= 0
  ),
  CONSTRAINT fk_payslipdelivery_request
    FOREIGN KEY (payslip_request_id)
    REFERENCES public."PayslipRequest" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payslipdelivery_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payslipdelivery_payroll_period
    FOREIGN KEY (payroll_period_id)
    REFERENCES public."PayrollPeriod" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payslipdelivery_payslip
    FOREIGN KEY (payslip_id)
    REFERENCES public."Payslip" (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_payslipdelivery_published_by_user
    FOREIGN KEY (published_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_paysliprequest_employe_status
  ON public."PayslipRequest" (employe_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paysliprequest_period_status
  ON public."PayslipRequest" (payroll_period_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paysliprequest_created_at
  ON public."PayslipRequest" (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_paysliprequest_open_request
  ON public."PayslipRequest" (employe_id, payroll_period_id)
  WHERE status IN (
    'PENDING'::public.payslip_request_status_enum,
    'IN_REVIEW'::public.payslip_request_status_enum
  );

CREATE INDEX IF NOT EXISTS idx_payslipdelivery_employe_published_at
  ON public."PayslipDelivery" (employe_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_payslipdelivery_period_published_at
  ON public."PayslipDelivery" (payroll_period_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_payslipdelivery_payslip_id
  ON public."PayslipDelivery" (payslip_id);

DROP TRIGGER IF EXISTS trg_paysliprequest_set_updated_at ON public."PayslipRequest";
CREATE TRIGGER trg_paysliprequest_set_updated_at
BEFORE UPDATE ON public."PayslipRequest"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payslipdelivery_set_updated_at ON public."PayslipDelivery";
CREATE TRIGGER trg_payslipdelivery_set_updated_at
BEFORE UPDATE ON public."PayslipDelivery"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3) Request lifecycle guards
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_payslip_request_status_transition(
  p_old_status public.payslip_request_status_enum,
  p_new_status public.payslip_request_status_enum
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_old_status
    WHEN 'PENDING'::public.payslip_request_status_enum THEN p_new_status IN (
      'PENDING'::public.payslip_request_status_enum,
      'IN_REVIEW'::public.payslip_request_status_enum,
      'FULFILLED'::public.payslip_request_status_enum,
      'REJECTED'::public.payslip_request_status_enum
    )
    WHEN 'IN_REVIEW'::public.payslip_request_status_enum THEN p_new_status IN (
      'IN_REVIEW'::public.payslip_request_status_enum,
      'FULFILLED'::public.payslip_request_status_enum,
      'REJECTED'::public.payslip_request_status_enum
    )
    WHEN 'FULFILLED'::public.payslip_request_status_enum THEN p_new_status = 'FULFILLED'::public.payslip_request_status_enum
    WHEN 'REJECTED'::public.payslip_request_status_enum THEN p_new_status = 'REJECTED'::public.payslip_request_status_enum
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.guard_payslip_request_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING'::public.payslip_request_status_enum THEN
      RAISE EXCEPTION 'Payslip requests must start in PENDING status.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.employe_id IS DISTINCT FROM OLD.employe_id
     OR NEW.payroll_period_id IS DISTINCT FROM OLD.payroll_period_id
     OR NEW.requested_by_user_id IS DISTINCT FROM OLD.requested_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Payslip request identity fields cannot be changed.';
  END IF;

  IF NOT public.is_valid_payslip_request_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Invalid payslip request status transition: % -> %.', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'REJECTED'::public.payslip_request_status_enum
     AND NULLIF(BTRIM(COALESCE(NEW.review_note, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'A review note is required when rejecting a payslip request.';
  END IF;

  IF NEW.status = 'FULFILLED'::public.payslip_request_status_enum
     AND NOT EXISTS (
       SELECT 1
       FROM public."PayslipDelivery" pd
       WHERE pd.payslip_request_id = NEW.id
     )
  THEN
    RAISE EXCEPTION 'A payslip delivery record is required before a request can be fulfilled.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payslip_request_mutation ON public."PayslipRequest";
CREATE TRIGGER trg_guard_payslip_request_mutation
BEFORE INSERT OR UPDATE ON public."PayslipRequest"
FOR EACH ROW EXECUTE FUNCTION public.guard_payslip_request_mutation();

REVOKE ALL ON FUNCTION public.is_valid_payslip_request_status_transition(
  public.payslip_request_status_enum,
  public.payslip_request_status_enum
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_payslip_request_status_transition(
  public.payslip_request_status_enum,
  public.payslip_request_status_enum
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.guard_payslip_request_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_payslip_request_mutation() TO authenticated, service_role;
-- ---------------------------------------------------------------------
-- 4) RLS and storage policies
-- ---------------------------------------------------------------------
ALTER TABLE public."PayslipRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PayslipDelivery" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_all_paysliprequest ON public."PayslipRequest";
DROP POLICY IF EXISTS employee_select_own_paysliprequest ON public."PayslipRequest";
DROP POLICY IF EXISTS employee_insert_own_paysliprequest ON public."PayslipRequest";

CREATE POLICY payroll_all_paysliprequest
ON public."PayslipRequest"
FOR ALL
TO authenticated
USING (public.is_payroll_agent())
WITH CHECK (public.is_payroll_agent());

CREATE POLICY employee_select_own_paysliprequest
ON public."PayslipRequest"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
);

CREATE POLICY employee_insert_own_paysliprequest
ON public."PayslipRequest"
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
  AND requested_by_user_id = auth.uid()
  AND status = 'PENDING'::public.payslip_request_status_enum
);

DROP POLICY IF EXISTS payroll_all_payslipdelivery ON public."PayslipDelivery";
DROP POLICY IF EXISTS employee_select_own_payslipdelivery ON public."PayslipDelivery";

CREATE POLICY payroll_all_payslipdelivery
ON public."PayslipDelivery"
FOR ALL
TO authenticated
USING (public.is_payroll_agent())
WITH CHECK (public.is_payroll_agent());

CREATE POLICY employee_select_own_payslipdelivery
ON public."PayslipDelivery"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
);

REVOKE ALL PRIVILEGES ON TABLE public."PayslipRequest" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."PayslipDelivery" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PayslipRequest" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PayslipDelivery" TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payslips', 'payslips', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS payroll_select_payslip_objects ON storage.objects;
DROP POLICY IF EXISTS payroll_insert_payslip_objects ON storage.objects;
DROP POLICY IF EXISTS payroll_update_payslip_objects ON storage.objects;
DROP POLICY IF EXISTS payroll_delete_payslip_objects ON storage.objects;
DROP POLICY IF EXISTS employee_select_own_payslip_objects ON storage.objects;

CREATE POLICY payroll_select_payslip_objects
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payslips'
  AND public.is_payroll_agent()
);

CREATE POLICY payroll_insert_payslip_objects
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payslips'
  AND public.is_payroll_agent()
);

CREATE POLICY payroll_update_payslip_objects
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payslips'
  AND public.is_payroll_agent()
)
WITH CHECK (
  bucket_id = 'payslips'
  AND public.is_payroll_agent()
);

CREATE POLICY payroll_delete_payslip_objects
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payslips'
  AND public.is_payroll_agent()
);

CREATE POLICY employee_select_own_payslip_objects
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payslips'
  AND public.is_employe_user()
  AND (storage.foldername(name))[1] = public.current_employe_id()::text
);

-- ---------------------------------------------------------------------
-- 5) Audit policy extensions for employee and payroll payslip activity
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS employee_insert_self_audit_log ON public.audit_log;

CREATE POLICY employee_insert_self_audit_log
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_employe_user()
  AND actor_user_id = auth.uid()
  AND (
    (
      action = 'EMPLOYEE_SELF_UPDATED'
      AND target_type = 'Employe'
      AND target_id = public.current_employe_id()
    )
    OR
    (
      action = 'REQUEST_SUBMITTED'
      AND target_type = 'DemandeModification'
      AND target_id IS NOT NULL
    )
    OR
    (
      action = 'PAYSLIP_REQUEST_CREATED'
      AND target_type = 'PayslipRequest'
      AND target_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."PayslipRequest" pr
        WHERE pr.id = target_id
          AND pr.employe_id = public.current_employe_id()
          AND pr.requested_by_user_id = auth.uid()
      )
    )
    OR
    (
      action IN ('PAYSLIP_DOCUMENT_VIEWED', 'PAYSLIP_DOCUMENT_DOWNLOADED')
      AND target_type = 'PayslipDelivery'
      AND target_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."PayslipDelivery" pd
        WHERE pd.id = target_id
          AND pd.employe_id = public.current_employe_id()
      )
    )
    OR
    (
      action IN ('PAYSLIP_DOCUMENT_VIEWED', 'PAYSLIP_DOCUMENT_DOWNLOADED')
      AND target_type = 'Payslip'
      AND target_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."Payslip" ps
        WHERE ps.id = target_id
          AND ps.employe_id = public.current_employe_id()
          AND ps.status = 'PUBLISHED'::public.payroll_processing_status_enum
      )
    )
  )
);

DROP POLICY IF EXISTS payroll_select_own_processing_audit_log ON public.audit_log;
DROP POLICY IF EXISTS payroll_insert_processing_audit_log ON public.audit_log;

CREATE POLICY payroll_select_own_processing_audit_log
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  public.is_payroll_agent()
  AND actor_user_id = auth.uid()
  AND action IN (
    'PAYROLL_PERIOD_CREATED',
    'PAYROLL_RUN_CREATED',
    'PAYROLL_RUN_UPDATED',
    'PAYROLL_RUN_FINALIZED',
    'PAYROLL_PAYSLIP_PUBLISHED',
    'PAYROLL_CALCULATION_STARTED',
    'PAYROLL_CALCULATION_COMPLETED',
    'PAYROLL_CALCULATION_FAILED',
    'PAYSLIP_REQUEST_STATUS_UPDATED',
    'PAYSLIP_REQUEST_FULFILLED',
    'PAYSLIP_DOCUMENT_PUBLISHED',
    'PAYSLIP_DOCUMENT_VIEWED',
    'PAYSLIP_DOCUMENT_DOWNLOADED'
  )
);

CREATE POLICY payroll_insert_processing_audit_log
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_payroll_agent()
  AND actor_user_id = auth.uid()
  AND (
    (action = 'PAYROLL_PERIOD_CREATED' AND target_type = 'PayrollPeriod' AND target_id IS NOT NULL)
    OR (action = 'PAYROLL_RUN_CREATED' AND target_type = 'PayrollRun' AND target_id IS NOT NULL)
    OR (action = 'PAYROLL_RUN_UPDATED' AND target_type = 'PayrollRun' AND target_id IS NOT NULL)
    OR (action = 'PAYROLL_RUN_FINALIZED' AND target_type = 'PayrollRun' AND target_id IS NOT NULL)
    OR (action = 'PAYROLL_PAYSLIP_PUBLISHED' AND target_type = 'Payslip' AND target_id IS NOT NULL)
    OR (action = 'PAYROLL_CALCULATION_STARTED' AND target_type = 'PayrollRun' AND target_id IS NOT NULL)
    OR (action = 'PAYROLL_CALCULATION_COMPLETED' AND target_type = 'PayrollRun' AND target_id IS NOT NULL)
    OR (action = 'PAYROLL_CALCULATION_FAILED' AND target_type = 'PayrollRun' AND target_id IS NOT NULL)
    OR (action = 'PAYSLIP_REQUEST_STATUS_UPDATED' AND target_type = 'PayslipRequest' AND target_id IS NOT NULL)
    OR (action = 'PAYSLIP_REQUEST_FULFILLED' AND target_type = 'PayslipRequest' AND target_id IS NOT NULL)
    OR (action = 'PAYSLIP_DOCUMENT_PUBLISHED' AND target_type = 'PayslipDelivery' AND target_id IS NOT NULL)
    OR (action = 'PAYSLIP_DOCUMENT_VIEWED' AND target_type IN ('PayslipDelivery', 'Payslip') AND target_id IS NOT NULL)
    OR (action = 'PAYSLIP_DOCUMENT_DOWNLOADED' AND target_type IN ('PayslipDelivery', 'Payslip') AND target_id IS NOT NULL)
  )
);
-- ---------------------------------------------------------------------
-- 6) Secure read models
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_employee_payslip_request_periods()
RETURNS TABLE (
  id uuid,
  code text,
  label text,
  period_start date,
  period_end date,
  status public.payroll_period_status_enum
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.id,
    pp.code,
    pp.label,
    pp.period_start,
    pp.period_end,
    pp.status
  FROM public."PayrollPeriod" pp
  WHERE (
      auth.role() = 'service_role'
      OR public.is_employe_user()
    )
    AND pp.status <> 'DRAFT'::public.payroll_period_status_enum
    AND NOT EXISTS (
      SELECT 1
      FROM public."PayslipRequest" pr
      WHERE pr.employe_id = public.current_employe_id()
        AND pr.payroll_period_id = pp.id
        AND pr.status IN (
          'PENDING'::public.payslip_request_status_enum,
          'IN_REVIEW'::public.payslip_request_status_enum,
          'FULFILLED'::public.payslip_request_status_enum
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public."PayslipDelivery" pd
      WHERE pd.employe_id = public.current_employe_id()
        AND pd.payroll_period_id = pp.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public."Payslip" ps
      INNER JOIN public."PayrollRun" prun
        ON prun.id = ps.payroll_run_id
      WHERE ps.employe_id = public.current_employe_id()
        AND prun.payroll_period_id = pp.id
        AND ps.status = 'PUBLISHED'::public.payroll_processing_status_enum
        AND NULLIF(BTRIM(COALESCE(ps.storage_path, '')), '') IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(ps.file_name, '')), '') IS NOT NULL
    )
  ORDER BY pp.period_start DESC, pp.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_payslip_requests()
RETURNS TABLE (
  id uuid,
  payroll_period_id uuid,
  payroll_period_code text,
  payroll_period_label text,
  period_start date,
  period_end date,
  status public.payslip_request_status_enum,
  request_note text,
  review_note text,
  linked_payslip_id uuid,
  document_id uuid,
  document_file_name text,
  document_storage_path text,
  document_published_at timestamptz,
  created_at timestamptz,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.id,
    pr.payroll_period_id,
    pp.code AS payroll_period_code,
    pp.label AS payroll_period_label,
    pp.period_start,
    pp.period_end,
    pr.status,
    pr.request_note,
    pr.review_note,
    pr.linked_payslip_id,
    pd.id AS document_id,
    pd.file_name AS document_file_name,
    pd.storage_path AS document_storage_path,
    pd.published_at AS document_published_at,
    pr.created_at,
    pr.reviewed_at,
    pr.fulfilled_at,
    pr.updated_at
  FROM public."PayslipRequest" pr
  INNER JOIN public."PayrollPeriod" pp
    ON pp.id = pr.payroll_period_id
  LEFT JOIN public."PayslipDelivery" pd
    ON pd.payslip_request_id = pr.id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_employe_user()
    )
    AND pr.employe_id = public.current_employe_id()
  ORDER BY pr.created_at DESC, pr.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_available_payslip_documents()
RETURNS TABLE (
  id uuid,
  payslip_id uuid,
  payslip_request_id uuid,
  source text,
  payroll_period_id uuid,
  payroll_period_code text,
  payroll_period_label text,
  period_start date,
  period_end date,
  file_name text,
  storage_path text,
  content_type text,
  file_size_bytes bigint,
  published_at timestamptz,
  created_at timestamptz,
  audit_target_type text,
  audit_target_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pd.id,
    pd.payslip_id,
    pd.payslip_request_id,
    'REQUEST_DELIVERY'::text AS source,
    pd.payroll_period_id,
    pp.code AS payroll_period_code,
    pp.label AS payroll_period_label,
    pp.period_start,
    pp.period_end,
    pd.file_name,
    pd.storage_path,
    pd.content_type,
    pd.file_size_bytes,
    pd.published_at,
    pd.created_at,
    'PayslipDelivery'::text AS audit_target_type,
    pd.id AS audit_target_id
  FROM public."PayslipDelivery" pd
  INNER JOIN public."PayrollPeriod" pp
    ON pp.id = pd.payroll_period_id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_employe_user()
    )
    AND pd.employe_id = public.current_employe_id()

  UNION ALL

  SELECT
    ps.id,
    ps.id AS payslip_id,
    NULL::uuid AS payslip_request_id,
    'PAYROLL_PUBLICATION'::text AS source,
    prun.payroll_period_id,
    pp.code AS payroll_period_code,
    pp.label AS payroll_period_label,
    pp.period_start,
    pp.period_end,
    ps.file_name,
    ps.storage_path,
    'application/pdf'::text AS content_type,
    NULL::bigint AS file_size_bytes,
    ps.published_at,
    ps.created_at,
    'Payslip'::text AS audit_target_type,
    ps.id AS audit_target_id
  FROM public."Payslip" ps
  INNER JOIN public."PayrollRun" prun
    ON prun.id = ps.payroll_run_id
  INNER JOIN public."PayrollPeriod" pp
    ON pp.id = prun.payroll_period_id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_employe_user()
    )
    AND ps.employe_id = public.current_employe_id()
    AND ps.status = 'PUBLISHED'::public.payroll_processing_status_enum
    AND NULLIF(BTRIM(COALESCE(ps.storage_path, '')), '') IS NOT NULL
    AND NULLIF(BTRIM(COALESCE(ps.file_name, '')), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public."PayslipDelivery" pd
      WHERE pd.payslip_id = ps.id
    )
  ORDER BY published_at DESC, created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_payroll_payslip_requests(
  p_status text DEFAULT 'ALL',
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  employe_id uuid,
  employe_matricule text,
  employe_nom text,
  employe_prenom text,
  employe_email text,
  departement_nom text,
  payroll_period_id uuid,
  payroll_period_code text,
  payroll_period_label text,
  period_start date,
  period_end date,
  status public.payslip_request_status_enum,
  request_note text,
  review_note text,
  linked_payslip_id uuid,
  document_id uuid,
  document_file_name text,
  document_storage_path text,
  document_published_at timestamptz,
  reviewed_by_user_id uuid,
  fulfilled_by_user_id uuid,
  created_at timestamptz,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.id,
    pr.employe_id,
    e.matricule AS employe_matricule,
    e.nom AS employe_nom,
    e.prenom AS employe_prenom,
    e.email AS employe_email,
    d.nom AS departement_nom,
    pr.payroll_period_id,
    pp.code AS payroll_period_code,
    pp.label AS payroll_period_label,
    pp.period_start,
    pp.period_end,
    pr.status,
    pr.request_note,
    pr.review_note,
    pr.linked_payslip_id,
    pd.id AS document_id,
    pd.file_name AS document_file_name,
    pd.storage_path AS document_storage_path,
    pd.published_at AS document_published_at,
    pr.reviewed_by_user_id,
    pr.fulfilled_by_user_id,
    pr.created_at,
    pr.reviewed_at,
    pr.fulfilled_at,
    pr.updated_at
  FROM public."PayslipRequest" pr
  INNER JOIN public."Employe" e
    ON e.id = pr.employe_id
  INNER JOIN public."PayrollPeriod" pp
    ON pp.id = pr.payroll_period_id
  LEFT JOIN public."Departement" d
    ON d.id = e.departement_id
  LEFT JOIN public."PayslipDelivery" pd
    ON pd.payslip_request_id = pr.id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_payroll_agent()
    )
    AND (
      UPPER(COALESCE(p_status, 'ALL')) = 'ALL'
      OR pr.status::text = UPPER(COALESCE(p_status, 'ALL'))
    )
    AND (
      NULLIF(BTRIM(p_search), '') IS NULL
      OR e.nom ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR e.prenom ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR CONCAT_WS(' ', e.prenom, e.nom) ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR e.matricule ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR COALESCE(e.email, '') ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR pp.code ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR pp.label ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
    )
  ORDER BY pr.created_at DESC, pr.updated_at DESC;
$$;
-- ---------------------------------------------------------------------
-- 7) Workflow mutations
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_employee_payslip_request(
  p_payroll_period_id uuid,
  p_request_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
  v_employee_id uuid;
  v_user_id uuid;
  v_period_code text;
  v_period_label text;
BEGIN
  IF NOT public.is_employe_user() THEN
    RAISE EXCEPTION 'Only employees can submit payslip requests.';
  END IF;

  v_employee_id := public.current_employe_id();
  v_user_id := auth.uid();

  IF v_employee_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Employee context is not available.';
  END IF;

  SELECT pp.code, pp.label
  INTO v_period_code, v_period_label
  FROM public."PayrollPeriod" pp
  WHERE pp.id = p_payroll_period_id
    AND pp.status <> 'DRAFT'::public.payroll_period_status_enum
  LIMIT 1;

  IF v_period_code IS NULL THEN
    RAISE EXCEPTION 'Payroll period is unavailable for payslip requests.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."PayslipRequest" pr
    WHERE pr.employe_id = v_employee_id
      AND pr.payroll_period_id = p_payroll_period_id
      AND pr.status IN (
        'PENDING'::public.payslip_request_status_enum,
        'IN_REVIEW'::public.payslip_request_status_enum,
        'FULFILLED'::public.payslip_request_status_enum
      )
  ) THEN
    RAISE EXCEPTION 'A payslip request already exists for this payroll period.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."PayslipDelivery" pd
    WHERE pd.employe_id = v_employee_id
      AND pd.payroll_period_id = p_payroll_period_id
  ) THEN
    RAISE EXCEPTION 'A delivered payslip already exists for this payroll period.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Payslip" ps
    INNER JOIN public."PayrollRun" prun
      ON prun.id = ps.payroll_run_id
    WHERE ps.employe_id = v_employee_id
      AND prun.payroll_period_id = p_payroll_period_id
      AND ps.status = 'PUBLISHED'::public.payroll_processing_status_enum
      AND NULLIF(BTRIM(COALESCE(ps.storage_path, '')), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(ps.file_name, '')), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A published payslip document already exists for this payroll period.';
  END IF;

  INSERT INTO public."PayslipRequest" (
    employe_id,
    payroll_period_id,
    requested_by_user_id,
    status,
    request_note
  )
  VALUES (
    v_employee_id,
    p_payroll_period_id,
    v_user_id,
    'PENDING'::public.payslip_request_status_enum,
    NULLIF(BTRIM(COALESCE(p_request_note, '')), '')
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    is_read,
    metadata_json
  )
  VALUES (
    v_user_id,
    'Payslip request submitted',
    FORMAT('Your payslip request for %s has been submitted for payroll review.', v_period_label),
    '/employee/payslips',
    false,
    jsonb_build_object(
      'scope', 'employee_payslip_request',
      'payslip_request_id', v_request_id,
      'payroll_period_id', p_payroll_period_id,
      'payroll_period_code', v_period_code,
      'payroll_period_label', v_period_label,
      'status', 'PENDING'
    )
  );

  INSERT INTO public.audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    details_json
  )
  VALUES (
    v_user_id,
    'PAYSLIP_REQUEST_CREATED',
    'PayslipRequest',
    v_request_id,
    jsonb_build_object(
      'employe_id', v_employee_id,
      'payroll_period_id', p_payroll_period_id,
      'payroll_period_code', v_period_code,
      'payroll_period_label', v_period_label,
      'request_note', NULLIF(BTRIM(COALESCE(p_request_note, '')), '')
    )
  );

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_payslip_request_status(
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
  v_status public.payslip_request_status_enum;
  v_request public."PayslipRequest"%ROWTYPE;
  v_employee_user_id uuid;
  v_period_label text;
  v_period_code text;
  v_actor_user_id uuid;
BEGIN
  IF NOT public.is_payroll_agent() THEN
    RAISE EXCEPTION 'Only payroll users can review payslip requests.';
  END IF;

  v_actor_user_id := auth.uid();

  BEGIN
    v_status := UPPER(COALESCE(p_status, ''))::public.payslip_request_status_enum;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'Unsupported payslip request status: %', p_status;
  END;

  IF v_status NOT IN (
    'IN_REVIEW'::public.payslip_request_status_enum,
    'REJECTED'::public.payslip_request_status_enum
  ) THEN
    RAISE EXCEPTION 'Payslip request status can only be changed to IN_REVIEW or REJECTED here.';
  END IF;

  SELECT pr.*
  INTO v_request
  FROM public."PayslipRequest" pr
  WHERE pr.id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payslip request not found.';
  END IF;

  IF v_request.status IN (
    'FULFILLED'::public.payslip_request_status_enum,
    'REJECTED'::public.payslip_request_status_enum
  ) THEN
    RAISE EXCEPTION 'This payslip request can no longer be reviewed.';
  END IF;

  IF v_status = 'REJECTED'::public.payslip_request_status_enum
     AND NULLIF(BTRIM(COALESCE(p_review_note, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'A rejection note is required.';
  END IF;

  SELECT pp.code, pp.label
  INTO v_period_code, v_period_label
  FROM public."PayrollPeriod" pp
  WHERE pp.id = v_request.payroll_period_id
  LIMIT 1;

  SELECT pu.user_id
  INTO v_employee_user_id
  FROM public."ProfilUtilisateur" pu
  WHERE pu.employe_id = v_request.employe_id
    AND pu.role = 'EMPLOYE'
  LIMIT 1;

  UPDATE public."PayslipRequest"
  SET status = v_status,
      review_note = CASE
        WHEN NULLIF(BTRIM(COALESCE(p_review_note, '')), '') IS NULL THEN review_note
        ELSE NULLIF(BTRIM(COALESCE(p_review_note, '')), '')
      END,
      reviewed_by_user_id = v_actor_user_id,
      reviewed_at = now()
  WHERE id = p_request_id;

  IF v_employee_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      link,
      is_read,
      metadata_json
    )
    VALUES (
      v_employee_user_id,
      CASE
        WHEN v_status = 'IN_REVIEW'::public.payslip_request_status_enum THEN 'Payslip request in review'
        ELSE 'Payslip request rejected'
      END,
      CASE
        WHEN v_status = 'IN_REVIEW'::public.payslip_request_status_enum THEN FORMAT('Your payslip request for %s is now under payroll review.', v_period_label)
        ELSE FORMAT('Your payslip request for %s was rejected.', v_period_label)
      END,
      '/employee/payslips',
      false,
      jsonb_build_object(
        'scope', 'employee_payslip_request',
        'payslip_request_id', p_request_id,
        'payroll_period_id', v_request.payroll_period_id,
        'payroll_period_code', v_period_code,
        'payroll_period_label', v_period_label,
        'status', v_status::text
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
    'PAYSLIP_REQUEST_STATUS_UPDATED',
    'PayslipRequest',
    p_request_id,
    jsonb_build_object(
      'employe_id', v_request.employe_id,
      'payroll_period_id', v_request.payroll_period_id,
      'payroll_period_code', v_period_code,
      'payroll_period_label', v_period_label,
      'previous_status', v_request.status,
      'next_status', v_status,
      'review_note', NULLIF(BTRIM(COALESCE(p_review_note, '')), '')
    )
  );

  RETURN p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_payslip_request(
  p_request_id uuid,
  p_file_name text,
  p_storage_path text,
  p_content_type text DEFAULT 'application/pdf',
  p_file_size_bytes bigint DEFAULT NULL,
  p_review_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public."PayslipRequest"%ROWTYPE;
  v_delivery_id uuid;
  v_payslip_id uuid;
  v_employee_user_id uuid;
  v_actor_user_id uuid;
  v_period_code text;
  v_period_label text;
BEGIN
  IF NOT public.is_payroll_agent() THEN
    RAISE EXCEPTION 'Only payroll users can fulfill payslip requests.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_file_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A file name is required.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_storage_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A storage path is required.';
  END IF;

  v_actor_user_id := auth.uid();

  SELECT pr.*
  INTO v_request
  FROM public."PayslipRequest" pr
  WHERE pr.id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payslip request not found.';
  END IF;

  IF v_request.status = 'FULFILLED'::public.payslip_request_status_enum THEN
    RAISE EXCEPTION 'This payslip request has already been fulfilled.';
  END IF;

  IF v_request.status = 'REJECTED'::public.payslip_request_status_enum THEN
    RAISE EXCEPTION 'Rejected payslip requests cannot be fulfilled.';
  END IF;

  SELECT pp.code, pp.label
  INTO v_period_code, v_period_label
  FROM public."PayrollPeriod" pp
  WHERE pp.id = v_request.payroll_period_id
  LIMIT 1;

  SELECT pu.user_id
  INTO v_employee_user_id
  FROM public."ProfilUtilisateur" pu
  WHERE pu.employe_id = v_request.employe_id
    AND pu.role = 'EMPLOYE'
  LIMIT 1;

  SELECT ps.id
  INTO v_payslip_id
  FROM public."Payslip" ps
  INNER JOIN public."PayrollRun" prun
    ON prun.id = ps.payroll_run_id
  WHERE ps.employe_id = v_request.employe_id
    AND prun.payroll_period_id = v_request.payroll_period_id
  ORDER BY COALESCE(ps.published_at, ps.created_at) DESC, ps.created_at DESC
  LIMIT 1;

  IF v_payslip_id IS NOT NULL THEN
    UPDATE public."Payslip"
    SET status = 'PUBLISHED'::public.payroll_processing_status_enum,
        file_name = NULLIF(BTRIM(COALESCE(p_file_name, '')), ''),
        storage_path = NULLIF(BTRIM(COALESCE(p_storage_path, '')), ''),
        published_at = COALESCE(published_at, now()),
        published_by_user_id = COALESCE(published_by_user_id, v_actor_user_id),
        publication_metadata_json = COALESCE(publication_metadata_json, '{}'::jsonb) || jsonb_build_object(
          'publicationSource', 'payslip_request_workflow',
          'requestId', p_request_id,
          'documentReady', true
        )
    WHERE id = v_payslip_id;
  END IF;

  INSERT INTO public."PayslipDelivery" (
    payslip_request_id,
    employe_id,
    payroll_period_id,
    payslip_id,
    file_name,
    storage_path,
    content_type,
    file_size_bytes,
    publication_metadata_json,
    published_at,
    published_by_user_id
  )
  VALUES (
    p_request_id,
    v_request.employe_id,
    v_request.payroll_period_id,
    v_payslip_id,
    NULLIF(BTRIM(COALESCE(p_file_name, '')), ''),
    NULLIF(BTRIM(COALESCE(p_storage_path, '')), ''),
    COALESCE(NULLIF(BTRIM(COALESCE(p_content_type, '')), ''), 'application/pdf'),
    p_file_size_bytes,
    jsonb_build_object(
      'publicationSource', 'payslip_request_workflow',
      'requestId', p_request_id,
      'linkedPayslipId', v_payslip_id,
      'documentReady', true
    ),
    now(),
    v_actor_user_id
  )
  RETURNING id INTO v_delivery_id;

  UPDATE public."PayslipRequest"
  SET status = 'FULFILLED'::public.payslip_request_status_enum,
      review_note = CASE
        WHEN NULLIF(BTRIM(COALESCE(p_review_note, '')), '') IS NULL THEN review_note
        ELSE NULLIF(BTRIM(COALESCE(p_review_note, '')), '')
      END,
      linked_payslip_id = COALESCE(v_payslip_id, linked_payslip_id),
      reviewed_by_user_id = COALESCE(reviewed_by_user_id, v_actor_user_id),
      fulfilled_by_user_id = v_actor_user_id,
      reviewed_at = COALESCE(reviewed_at, now()),
      fulfilled_at = now()
  WHERE id = p_request_id;

  IF v_employee_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      link,
      is_read,
      metadata_json
    )
    VALUES
      (
        v_employee_user_id,
        'Payslip request fulfilled',
        FORMAT('Your payslip request for %s has been fulfilled by payroll.', v_period_label),
        '/employee/payslips',
        false,
        jsonb_build_object(
          'scope', 'employee_payslip_request',
          'payslip_request_id', p_request_id,
          'payroll_period_id', v_request.payroll_period_id,
          'payroll_period_code', v_period_code,
          'payroll_period_label', v_period_label,
          'status', 'FULFILLED'
        )
      ),
      (
        v_employee_user_id,
        'Payslip available in your account',
        FORMAT('Your payslip for %s is now available in your employee account.', v_period_label),
        '/employee/payslips',
        false,
        jsonb_build_object(
          'scope', 'employee_payslip_delivery',
          'payslip_request_id', p_request_id,
          'payroll_period_id', v_request.payroll_period_id,
          'payroll_period_code', v_period_code,
          'payroll_period_label', v_period_label,
          'document_id', v_delivery_id
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
  VALUES
    (
      v_actor_user_id,
      'PAYSLIP_REQUEST_FULFILLED',
      'PayslipRequest',
      p_request_id,
      jsonb_build_object(
        'employe_id', v_request.employe_id,
        'payroll_period_id', v_request.payroll_period_id,
        'payroll_period_code', v_period_code,
        'payroll_period_label', v_period_label,
        'linked_payslip_id', v_payslip_id,
        'review_note', NULLIF(BTRIM(COALESCE(p_review_note, '')), '')
      )
    ),
    (
      v_actor_user_id,
      'PAYSLIP_DOCUMENT_PUBLISHED',
      'PayslipDelivery',
      v_delivery_id,
      jsonb_build_object(
        'employe_id', v_request.employe_id,
        'payroll_period_id', v_request.payroll_period_id,
        'payroll_period_code', v_period_code,
        'payroll_period_label', v_period_label,
        'linked_payslip_id', v_payslip_id,
        'file_name', NULLIF(BTRIM(COALESCE(p_file_name, '')), ''),
        'storage_path', NULLIF(BTRIM(COALESCE(p_storage_path, '')), ''),
        'content_type', COALESCE(NULLIF(BTRIM(COALESCE(p_content_type, '')), ''), 'application/pdf'),
        'file_size_bytes', p_file_size_bytes
      )
    );

  RETURN p_request_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 8) Grants
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_employee_payslip_request_periods() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_employee_payslip_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_employee_available_payslip_documents() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_payslip_requests(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee_payslip_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_payslip_request_status(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_payslip_request(uuid, text, text, text, bigint, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_employee_payslip_request_periods() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_payslip_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_available_payslip_documents() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_payslip_requests(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_employee_payslip_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_payslip_request_status(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_payslip_request(uuid, text, text, text, bigint, text) TO authenticated, service_role;
