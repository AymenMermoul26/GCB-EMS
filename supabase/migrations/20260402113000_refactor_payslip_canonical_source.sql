-- =====================================================================
-- Payslip canonical source alignment
-- - Treat payroll run employee results as the canonical payslip source
-- - Keep document storage as a secondary representation of that record
-- - Preserve existing request and delivery history where possible
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Shared helpers for canonical payslip state
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_payslip_document_ready(
  p_publication_metadata_json jsonb,
  p_file_name text,
  p_storage_path text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN LOWER(COALESCE(p_publication_metadata_json ->> 'documentReady', '')) = 'true' THEN true
    WHEN LOWER(COALESCE(p_publication_metadata_json ->> 'documentReady', '')) = 'false' THEN false
    WHEN NULLIF(BTRIM(COALESCE(p_file_name, '')), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(p_storage_path, '')), '') IS NOT NULL
      THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_payslip_document_representation_mode(
  p_publication_metadata_json jsonb,
  p_file_name text,
  p_storage_path text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(BTRIM(COALESCE(p_publication_metadata_json ->> 'documentRepresentationMode', '')), '') IS NOT NULL
      THEN NULLIF(BTRIM(COALESCE(p_publication_metadata_json ->> 'documentRepresentationMode', '')), '')
    WHEN NULLIF(BTRIM(COALESCE(p_file_name, '')), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(p_storage_path, '')), '') IS NOT NULL
      THEN CASE
        WHEN COALESCE(p_publication_metadata_json ->> 'publicationSource', '') = 'payslip_request_workflow'
          THEN 'MANUAL_UPLOAD'
        ELSE 'GENERATED_PDF'
      END
    ELSE 'NONE'
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_published_payroll_result_source(
  p_employe_id uuid,
  p_payroll_period_id uuid
)
RETURNS TABLE (
  payroll_run_id uuid,
  payroll_run_employe_id uuid,
  payroll_run_status public.payroll_processing_status_enum,
  payroll_run_published_at timestamptz,
  payroll_run_finalized_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pre.payroll_run_id,
    pre.id AS payroll_run_employe_id,
    prun.status AS payroll_run_status,
    prun.published_at AS payroll_run_published_at,
    prun.finalized_at AS payroll_run_finalized_at
  FROM public."PayrollRunEmploye" pre
  INNER JOIN public."PayrollRun" prun
    ON prun.id = pre.payroll_run_id
  WHERE pre.employe_id = p_employe_id
    AND prun.payroll_period_id = p_payroll_period_id
    AND pre.calculation_status = 'CALCULATED'::public.payroll_calculation_status_enum
    AND prun.status IN (
      'PUBLISHED'::public.payroll_processing_status_enum,
      'ARCHIVED'::public.payroll_processing_status_enum
    )
  ORDER BY
    COALESCE(prun.published_at, prun.archived_at, prun.finalized_at, prun.created_at) DESC,
    pre.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_payslip_document_ready(jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_payslip_document_representation_mode(jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_latest_published_payroll_result_source(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_payslip_document_ready(jsonb, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_payslip_document_representation_mode(jsonb, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_latest_published_payroll_result_source(uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) Canonical metadata backfill and legacy delivery linking
-- ---------------------------------------------------------------------
UPDATE public."Payslip" ps
SET publication_metadata_json = jsonb_strip_nulls(
  COALESCE(ps.publication_metadata_json, '{}'::jsonb)
  || jsonb_build_object(
    'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
    'canonicalPayrollRunId', ps.payroll_run_id,
    'canonicalPayrollRunEmployeeId', ps.payroll_run_employe_id,
    'canonicalEmployeeId', ps.employe_id,
    'documentReady', public.resolve_payslip_document_ready(
      ps.publication_metadata_json,
      ps.file_name,
      ps.storage_path
    ),
    'documentRepresentationMode', public.resolve_payslip_document_representation_mode(
      ps.publication_metadata_json,
      ps.file_name,
      ps.storage_path
    ),
    'documentAttachedAt', CASE
      WHEN public.resolve_payslip_document_ready(
        ps.publication_metadata_json,
        ps.file_name,
        ps.storage_path
      ) THEN COALESCE(ps.published_at, ps.updated_at, ps.created_at)
      ELSE NULL
    END
  )
);

WITH delivery_sources AS (
  SELECT DISTINCT ON (src.payroll_run_employe_id)
    pr.id AS payslip_request_id,
    pr.employe_id,
    pd.file_name,
    pd.storage_path,
    pd.published_at,
    pd.published_by_user_id,
    src.payroll_run_id,
    src.payroll_run_employe_id
  FROM public."PayslipRequest" pr
  INNER JOIN public."PayslipDelivery" pd
    ON pd.payslip_request_id = pr.id
  INNER JOIN LATERAL public.get_latest_published_payroll_result_source(
    pr.employe_id,
    pr.payroll_period_id
  ) src
    ON true
  LEFT JOIN public."Payslip" ps
    ON ps.payroll_run_employe_id = src.payroll_run_employe_id
  WHERE ps.id IS NULL
  ORDER BY src.payroll_run_employe_id, COALESCE(pd.published_at, pr.fulfilled_at, pr.created_at) DESC
)
INSERT INTO public."Payslip" (
  payroll_run_id,
  payroll_run_employe_id,
  employe_id,
  status,
  file_name,
  storage_path,
  published_at,
  published_by_user_id,
  publication_metadata_json
)
SELECT
  ds.payroll_run_id,
  ds.payroll_run_employe_id,
  ds.employe_id,
  'PUBLISHED'::public.payroll_processing_status_enum,
  ds.file_name,
  ds.storage_path,
  COALESCE(ds.published_at, now()),
  ds.published_by_user_id,
  jsonb_build_object(
    'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
    'canonicalPayrollRunId', ds.payroll_run_id,
    'canonicalPayrollRunEmployeeId', ds.payroll_run_employe_id,
    'canonicalEmployeeId', ds.employe_id,
    'publicationSource', 'payslip_request_workflow',
    'requestId', ds.payslip_request_id,
    'documentReady', true,
    'documentRepresentationMode', 'MANUAL_UPLOAD',
    'documentAttachedAt', COALESCE(ds.published_at, now())
  )
FROM delivery_sources ds
ON CONFLICT (payroll_run_employe_id) DO NOTHING;

WITH resolved_links AS (
  SELECT
    pd.id AS delivery_id,
    pr.id AS request_id,
    ps.id AS payslip_id
  FROM public."PayslipRequest" pr
  INNER JOIN public."PayslipDelivery" pd
    ON pd.payslip_request_id = pr.id
  INNER JOIN LATERAL public.get_latest_published_payroll_result_source(
    pr.employe_id,
    pr.payroll_period_id
  ) src
    ON true
  INNER JOIN public."Payslip" ps
    ON ps.payroll_run_employe_id = src.payroll_run_employe_id
)
UPDATE public."PayslipDelivery" pd
SET payslip_id = rl.payslip_id,
    publication_metadata_json = jsonb_strip_nulls(
      COALESCE(pd.publication_metadata_json, '{}'::jsonb)
      || jsonb_build_object(
        'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
        'linkedPayslipId', rl.payslip_id,
        'documentReady', true,
        'documentRepresentationMode', 'MANUAL_UPLOAD'
      )
    )
FROM resolved_links rl
WHERE pd.id = rl.delivery_id
  AND (pd.payslip_id IS DISTINCT FROM rl.payslip_id OR pd.payslip_id IS NULL);

WITH resolved_request_links AS (
  SELECT
    pr.id AS request_id,
    ps.id AS payslip_id
  FROM public."PayslipRequest" pr
  INNER JOIN LATERAL public.get_latest_published_payroll_result_source(
    pr.employe_id,
    pr.payroll_period_id
  ) src
    ON true
  INNER JOIN public."Payslip" ps
    ON ps.payroll_run_employe_id = src.payroll_run_employe_id
)
UPDATE public."PayslipRequest" pr
SET linked_payslip_id = rrl.payslip_id
FROM resolved_request_links rrl
WHERE pr.id = rrl.request_id
  AND pr.linked_payslip_id IS NULL;

-- ---------------------------------------------------------------------
-- 3) Read models aligned with canonical payslip relationships
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_payroll_run_employee_entries(uuid);
CREATE OR REPLACE FUNCTION public.get_payroll_run_employee_entries(p_run_id uuid)
RETURNS TABLE (
  id uuid,
  payroll_run_id uuid,
  employe_id uuid,
  matricule text,
  nom text,
  prenom text,
  departement_nom text,
  poste text,
  categorie_professionnelle text,
  type_contrat text,
  status text,
  calculation_status text,
  exclusion_reason text,
  calculation_notes text,
  has_payslip boolean,
  payslip_status text,
  payslip_published_at timestamptz,
  payslip_document_ready boolean,
  payslip_document_representation_mode text,
  issue_flags_json jsonb,
  calculation_input_json jsonb,
  employee_snapshot_json jsonb,
  result_summary_json jsonb,
  base_salary_amount numeric,
  total_allowances_amount numeric,
  gross_pay_amount numeric,
  total_deductions_amount numeric,
  net_pay_amount numeric,
  calculated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pre.id,
    pre.payroll_run_id,
    pre.employe_id,
    e.matricule,
    e.nom,
    e.prenom,
    d.nom AS departement_nom,
    e.poste,
    e.categorie_professionnelle,
    e.type_contrat,
    pre.status::text,
    pre.calculation_status::text,
    pre.exclusion_reason,
    pre.calculation_notes,
    (ps.id IS NOT NULL) AS has_payslip,
    ps.status::text AS payslip_status,
    ps.published_at AS payslip_published_at,
    CASE
      WHEN ps.id IS NULL THEN false
      ELSE public.resolve_payslip_document_ready(
        ps.publication_metadata_json,
        ps.file_name,
        ps.storage_path
      )
    END AS payslip_document_ready,
    CASE
      WHEN ps.id IS NULL THEN NULL::text
      ELSE public.resolve_payslip_document_representation_mode(
        ps.publication_metadata_json,
        ps.file_name,
        ps.storage_path
      )
    END AS payslip_document_representation_mode,
    pre.issue_flags_json,
    pre.calculation_input_json,
    pre.employee_snapshot_json,
    pre.result_summary_json,
    pre.base_salary_amount,
    pre.total_allowances_amount,
    pre.gross_pay_amount,
    pre.total_deductions_amount,
    pre.net_pay_amount,
    pre.calculated_at,
    pre.created_at,
    pre.updated_at
  FROM public."PayrollRunEmploye" pre
  INNER JOIN public."Employe" e
    ON e.id = pre.employe_id
  LEFT JOIN public."Departement" d
    ON d.id = e.departement_id
  LEFT JOIN public."Payslip" ps
    ON ps.payroll_run_employe_id = pre.id
  WHERE pre.payroll_run_id = p_run_id
    AND (
      auth.role() = 'service_role'
      OR public.is_payroll_agent()
    )
  ORDER BY LOWER(e.nom), LOWER(e.prenom);
$$;

DROP FUNCTION IF EXISTS public.get_employee_payslips();
CREATE OR REPLACE FUNCTION public.get_employee_payslips()
RETURNS TABLE (
  id uuid,
  payroll_run_id uuid,
  payroll_run_employe_id uuid,
  payroll_period_id uuid,
  payroll_period_code text,
  payroll_period_label text,
  period_start date,
  period_end date,
  payroll_run_code text,
  status text,
  published_at timestamptz,
  file_name text,
  storage_path text,
  publication_metadata_json jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.id,
    ps.payroll_run_id,
    ps.payroll_run_employe_id,
    pr.payroll_period_id,
    pp.code AS payroll_period_code,
    pp.label AS payroll_period_label,
    pp.period_start,
    pp.period_end,
    pr.code AS payroll_run_code,
    ps.status::text,
    ps.published_at,
    ps.file_name,
    ps.storage_path,
    ps.publication_metadata_json,
    ps.created_at
  FROM public."Payslip" ps
  INNER JOIN public."PayrollRun" pr
    ON pr.id = ps.payroll_run_id
  INNER JOIN public."PayrollPeriod" pp
    ON pp.id = pr.payroll_period_id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_employe_user()
    )
    AND ps.employe_id = public.current_employe_id()
    AND ps.published_at IS NOT NULL
    AND ps.status IN (
      'PUBLISHED'::public.payroll_processing_status_enum,
      'ARCHIVED'::public.payroll_processing_status_enum
    )
  ORDER BY COALESCE(ps.published_at, ps.created_at) DESC;
$$;

DROP FUNCTION IF EXISTS public.get_employee_payslip_requests();
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
  canonical_source_payroll_run_id uuid,
  canonical_source_payroll_run_employe_id uuid,
  canonical_payslip_id uuid,
  canonical_payslip_status text,
  canonical_payslip_published_at timestamptz,
  canonical_document_ready boolean,
  canonical_document_representation_mode text,
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
    canonical_source.payroll_run_id AS canonical_source_payroll_run_id,
    canonical_source.payroll_run_employe_id AS canonical_source_payroll_run_employe_id,
    canonical_payslip.id AS canonical_payslip_id,
    canonical_payslip.status::text AS canonical_payslip_status,
    canonical_payslip.published_at AS canonical_payslip_published_at,
    CASE
      WHEN canonical_payslip.id IS NULL THEN false
      ELSE public.resolve_payslip_document_ready(
        canonical_payslip.publication_metadata_json,
        canonical_payslip.file_name,
        canonical_payslip.storage_path
      )
    END AS canonical_document_ready,
    CASE
      WHEN canonical_payslip.id IS NULL THEN NULL::text
      ELSE public.resolve_payslip_document_representation_mode(
        canonical_payslip.publication_metadata_json,
        canonical_payslip.file_name,
        canonical_payslip.storage_path
      )
    END AS canonical_document_representation_mode,
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
  LEFT JOIN LATERAL public.get_latest_published_payroll_result_source(
    pr.employe_id,
    pr.payroll_period_id
  ) canonical_source
    ON true
  LEFT JOIN LATERAL (
    SELECT
      ps.id,
      ps.status,
      ps.published_at,
      ps.file_name,
      ps.storage_path,
      ps.publication_metadata_json,
      ps.created_at
    FROM public."Payslip" ps
    WHERE (
        canonical_source.payroll_run_employe_id IS NOT NULL
        AND ps.payroll_run_employe_id = canonical_source.payroll_run_employe_id
      )
      OR (
        canonical_source.payroll_run_employe_id IS NULL
        AND pr.linked_payslip_id IS NOT NULL
        AND ps.id = pr.linked_payslip_id
      )
    ORDER BY
      CASE WHEN ps.id = pr.linked_payslip_id THEN 0 ELSE 1 END,
      COALESCE(ps.published_at, ps.created_at) DESC,
      ps.created_at DESC
    LIMIT 1
  ) canonical_payslip
    ON true
  LEFT JOIN public."PayslipDelivery" pd
    ON pd.payslip_request_id = pr.id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_employe_user()
    )
    AND pr.employe_id = public.current_employe_id()
  ORDER BY pr.created_at DESC, pr.updated_at DESC;
$$;

DROP FUNCTION IF EXISTS public.get_payroll_payslip_requests(text, text);
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
  canonical_source_payroll_run_id uuid,
  canonical_source_payroll_run_employe_id uuid,
  canonical_payslip_id uuid,
  canonical_payslip_status text,
  canonical_payslip_published_at timestamptz,
  canonical_document_ready boolean,
  canonical_document_representation_mode text,
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
    canonical_source.payroll_run_id AS canonical_source_payroll_run_id,
    canonical_source.payroll_run_employe_id AS canonical_source_payroll_run_employe_id,
    canonical_payslip.id AS canonical_payslip_id,
    canonical_payslip.status::text AS canonical_payslip_status,
    canonical_payslip.published_at AS canonical_payslip_published_at,
    CASE
      WHEN canonical_payslip.id IS NULL THEN false
      ELSE public.resolve_payslip_document_ready(
        canonical_payslip.publication_metadata_json,
        canonical_payslip.file_name,
        canonical_payslip.storage_path
      )
    END AS canonical_document_ready,
    CASE
      WHEN canonical_payslip.id IS NULL THEN NULL::text
      ELSE public.resolve_payslip_document_representation_mode(
        canonical_payslip.publication_metadata_json,
        canonical_payslip.file_name,
        canonical_payslip.storage_path
      )
    END AS canonical_document_representation_mode,
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
  LEFT JOIN LATERAL public.get_latest_published_payroll_result_source(
    pr.employe_id,
    pr.payroll_period_id
  ) canonical_source
    ON true
  LEFT JOIN LATERAL (
    SELECT
      ps.id,
      ps.status,
      ps.published_at,
      ps.file_name,
      ps.storage_path,
      ps.publication_metadata_json,
      ps.created_at
    FROM public."Payslip" ps
    WHERE (
        canonical_source.payroll_run_employe_id IS NOT NULL
        AND ps.payroll_run_employe_id = canonical_source.payroll_run_employe_id
      )
      OR (
        canonical_source.payroll_run_employe_id IS NULL
        AND pr.linked_payslip_id IS NOT NULL
        AND ps.id = pr.linked_payslip_id
      )
    ORDER BY
      CASE WHEN ps.id = pr.linked_payslip_id THEN 0 ELSE 1 END,
      COALESCE(ps.published_at, ps.created_at) DESC,
      ps.created_at DESC
    LIMIT 1
  ) canonical_payslip
    ON true
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
-- 4) Request fulfillment aligned to payroll-derived payslip records
-- ---------------------------------------------------------------------
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
  v_source_payroll_run_id uuid;
  v_source_payroll_run_employe_id uuid;
  v_source_published_at timestamptz;
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

  IF v_request.linked_payslip_id IS NOT NULL THEN
    SELECT ps.id, ps.payroll_run_id, ps.payroll_run_employe_id, ps.published_at
    INTO v_payslip_id, v_source_payroll_run_id, v_source_payroll_run_employe_id, v_source_published_at
    FROM public."Payslip" ps
    WHERE ps.id = v_request.linked_payslip_id
    LIMIT 1;
  END IF;

  IF v_source_payroll_run_employe_id IS NULL THEN
    SELECT
      src.payroll_run_id,
      src.payroll_run_employe_id,
      COALESCE(src.payroll_run_published_at, src.payroll_run_finalized_at, now())
    INTO v_source_payroll_run_id, v_source_payroll_run_employe_id, v_source_published_at
    FROM public.get_latest_published_payroll_result_source(
      v_request.employe_id,
      v_request.payroll_period_id
    ) src
    LIMIT 1;
  END IF;

  IF v_source_payroll_run_employe_id IS NULL THEN
    RAISE EXCEPTION 'This payslip request cannot be fulfilled until a published payroll result exists for the requested period.';
  END IF;

  IF v_payslip_id IS NULL THEN
    SELECT ps.id
    INTO v_payslip_id
    FROM public."Payslip" ps
    WHERE ps.payroll_run_employe_id = v_source_payroll_run_employe_id
    LIMIT 1;
  END IF;

  IF v_payslip_id IS NULL THEN
    INSERT INTO public."Payslip" (
      payroll_run_id,
      payroll_run_employe_id,
      employe_id,
      status,
      file_name,
      storage_path,
      published_at,
      published_by_user_id,
      publication_metadata_json
    )
    VALUES (
      v_source_payroll_run_id,
      v_source_payroll_run_employe_id,
      v_request.employe_id,
      'PUBLISHED'::public.payroll_processing_status_enum,
      NULLIF(BTRIM(COALESCE(p_file_name, '')), ''),
      NULLIF(BTRIM(COALESCE(p_storage_path, '')), ''),
      COALESCE(v_source_published_at, now()),
      v_actor_user_id,
      jsonb_build_object(
        'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
        'canonicalPayrollRunId', v_source_payroll_run_id,
        'canonicalPayrollRunEmployeeId', v_source_payroll_run_employe_id,
        'canonicalEmployeeId', v_request.employe_id,
        'publicationSource', 'payslip_request_workflow',
        'requestId', p_request_id,
        'documentReady', true,
        'documentRepresentationMode', 'MANUAL_UPLOAD',
        'documentAttachedAt', now()
      )
    )
    RETURNING id INTO v_payslip_id;
  END IF;

  UPDATE public."Payslip"
  SET status = 'PUBLISHED'::public.payroll_processing_status_enum,
      file_name = NULLIF(BTRIM(COALESCE(p_file_name, '')), ''),
      storage_path = NULLIF(BTRIM(COALESCE(p_storage_path, '')), ''),
      published_at = COALESCE(published_at, v_source_published_at, now()),
      published_by_user_id = COALESCE(published_by_user_id, v_actor_user_id),
      publication_metadata_json = jsonb_strip_nulls(
        COALESCE(publication_metadata_json, '{}'::jsonb)
        || jsonb_build_object(
          'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
          'canonicalPayrollRunId', payroll_run_id,
          'canonicalPayrollRunEmployeeId', payroll_run_employe_id,
          'canonicalEmployeeId', employe_id,
          'publicationSource', 'payslip_request_workflow',
          'requestId', p_request_id,
          'documentReady', true,
          'documentRepresentationMode', 'MANUAL_UPLOAD',
          'documentAttachedAt', now()
        )
      )
  WHERE id = v_payslip_id;

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
      'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
      'requestId', p_request_id,
      'linkedPayslipId', v_payslip_id,
      'documentReady', true,
      'documentRepresentationMode', 'MANUAL_UPLOAD'
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
      linked_payslip_id = v_payslip_id,
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
          'status', 'FULFILLED',
          'canonical_payslip_id', v_payslip_id
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
          'document_id', v_delivery_id,
          'canonical_payslip_id', v_payslip_id
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
        'canonical_source', 'PAYROLL_RUN_EMPLOYEE_RESULT',
        'payroll_run_id', v_source_payroll_run_id,
        'payroll_run_employe_id', v_source_payroll_run_employe_id,
        'document_representation_mode', 'MANUAL_UPLOAD',
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
        'canonical_source', 'PAYROLL_RUN_EMPLOYEE_RESULT',
        'payroll_run_id', v_source_payroll_run_id,
        'payroll_run_employe_id', v_source_payroll_run_employe_id,
        'file_name', NULLIF(BTRIM(COALESCE(p_file_name, '')), ''),
        'storage_path', NULLIF(BTRIM(COALESCE(p_storage_path, '')), ''),
        'content_type', COALESCE(NULLIF(BTRIM(COALESCE(p_content_type, '')), ''), 'application/pdf'),
        'file_size_bytes', p_file_size_bytes,
        'document_representation_mode', 'MANUAL_UPLOAD'
      )
    );

  RETURN p_request_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 5) Grants for updated read models and mutations
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_payroll_run_employee_entries(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_employee_payslips() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_employee_payslip_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_payslip_requests(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_payslip_request(uuid, text, text, text, bigint, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_payroll_run_employee_entries(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_payslips()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_payslip_requests()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_payslip_requests(text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_payslip_request(uuid, text, text, text, bigint, text)
  TO authenticated, service_role;
