-- =====================================================================
-- Generated payslip storage linkage
-- - Backfill generated-file metadata on canonical payslip rows
-- - Expose generated document metadata through existing secure read models
-- =====================================================================

UPDATE public."Payslip" ps
SET publication_metadata_json = jsonb_strip_nulls(
  COALESCE(ps.publication_metadata_json, '{}'::jsonb)
  || jsonb_build_object(
    'documentFileName', NULLIF(BTRIM(COALESCE(ps.file_name, '')), ''),
    'documentStoragePath', NULLIF(BTRIM(COALESCE(ps.storage_path, '')), ''),
    'contentType', CASE
      WHEN NULLIF(BTRIM(COALESCE(ps.file_name, '')), '') IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(ps.storage_path, '')), '') IS NOT NULL
        THEN COALESCE(
          NULLIF(BTRIM(COALESCE(ps.publication_metadata_json ->> 'contentType', '')), ''),
          'application/pdf'
        )
      ELSE NULL
    END
  )
)
WHERE ps.published_at IS NOT NULL;

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
  canonical_document_file_name text,
  canonical_document_storage_path text,
  canonical_document_content_type text,
  canonical_document_file_size_bytes bigint,
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
    canonical_payslip.file_name AS canonical_document_file_name,
    canonical_payslip.storage_path AS canonical_document_storage_path,
    CASE
      WHEN canonical_payslip.id IS NULL THEN NULL::text
      ELSE COALESCE(
        NULLIF(BTRIM(COALESCE(canonical_payslip.publication_metadata_json ->> 'contentType', '')), ''),
        CASE
          WHEN NULLIF(BTRIM(COALESCE(canonical_payslip.file_name, '')), '') IS NOT NULL
            AND NULLIF(BTRIM(COALESCE(canonical_payslip.storage_path, '')), '') IS NOT NULL
            THEN 'application/pdf'
          ELSE NULL
        END
      )
    END AS canonical_document_content_type,
    CASE
      WHEN canonical_payslip.id IS NULL THEN NULL::bigint
      WHEN NULLIF(BTRIM(COALESCE(canonical_payslip.publication_metadata_json ->> 'fileSizeBytes', '')), '') ~ '^[0-9]+$'
        THEN (canonical_payslip.publication_metadata_json ->> 'fileSizeBytes')::bigint
      ELSE NULL::bigint
    END AS canonical_document_file_size_bytes,
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
  canonical_document_file_name text,
  canonical_document_storage_path text,
  canonical_document_content_type text,
  canonical_document_file_size_bytes bigint,
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
    canonical_payslip.file_name AS canonical_document_file_name,
    canonical_payslip.storage_path AS canonical_document_storage_path,
    CASE
      WHEN canonical_payslip.id IS NULL THEN NULL::text
      ELSE COALESCE(
        NULLIF(BTRIM(COALESCE(canonical_payslip.publication_metadata_json ->> 'contentType', '')), ''),
        CASE
          WHEN NULLIF(BTRIM(COALESCE(canonical_payslip.file_name, '')), '') IS NOT NULL
            AND NULLIF(BTRIM(COALESCE(canonical_payslip.storage_path, '')), '') IS NOT NULL
            THEN 'application/pdf'
          ELSE NULL
        END
      )
    END AS canonical_document_content_type,
    CASE
      WHEN canonical_payslip.id IS NULL THEN NULL::bigint
      WHEN NULLIF(BTRIM(COALESCE(canonical_payslip.publication_metadata_json ->> 'fileSizeBytes', '')), '') ~ '^[0-9]+$'
        THEN (canonical_payslip.publication_metadata_json ->> 'fileSizeBytes')::bigint
      ELSE NULL::bigint
    END AS canonical_document_file_size_bytes,
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

DROP FUNCTION IF EXISTS public.get_employee_available_payslip_documents();
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
    COALESCE(
      NULLIF(BTRIM(COALESCE(ps.publication_metadata_json ->> 'contentType', '')), ''),
      'application/pdf'
    ) AS content_type,
    CASE
      WHEN NULLIF(BTRIM(COALESCE(ps.publication_metadata_json ->> 'fileSizeBytes', '')), '') ~ '^[0-9]+$'
        THEN (ps.publication_metadata_json ->> 'fileSizeBytes')::bigint
      ELSE NULL::bigint
    END AS file_size_bytes,
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
    AND public.resolve_payslip_document_ready(
      ps.publication_metadata_json,
      ps.file_name,
      ps.storage_path
    )
    AND NULLIF(BTRIM(COALESCE(ps.storage_path, '')), '') IS NOT NULL
    AND NULLIF(BTRIM(COALESCE(ps.file_name, '')), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public."PayslipDelivery" pd
      WHERE pd.payslip_id = ps.id
    )
  ORDER BY published_at DESC, created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_employee_payslip_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_payslip_requests(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_employee_available_payslip_documents() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_employee_payslip_requests()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_payslip_requests(text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_available_payslip_documents()
  TO authenticated, service_role;
