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
  payslip_id uuid,
  payslip_status text,
  payslip_published_at timestamptz,
  payslip_document_ready boolean,
  payslip_document_representation_mode text,
  payslip_generation_status text,
  payslip_generated_at timestamptz,
  payslip_generation_error text,
  payslip_file_name text,
  payslip_storage_path text,
  payslip_content_type text,
  payslip_file_size_bytes bigint,
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
    ps.id AS payslip_id,
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
    CASE
      WHEN ps.id IS NULL THEN NULL::text
      ELSE NULLIF(ps.publication_metadata_json ->> 'generationStatus', '')
    END AS payslip_generation_status,
    CASE
      WHEN ps.id IS NULL THEN NULL::timestamptz
      ELSE NULLIF(ps.publication_metadata_json ->> 'generatedAt', '')::timestamptz
    END AS payslip_generated_at,
    CASE
      WHEN ps.id IS NULL THEN NULL::text
      ELSE NULLIF(ps.publication_metadata_json ->> 'generationError', '')
    END AS payslip_generation_error,
    ps.file_name AS payslip_file_name,
    ps.storage_path AS payslip_storage_path,
    CASE
      WHEN ps.id IS NULL THEN NULL::text
      ELSE COALESCE(
        NULLIF(BTRIM(COALESCE(ps.publication_metadata_json ->> 'contentType', '')), ''),
        CASE
          WHEN NULLIF(BTRIM(COALESCE(ps.file_name, '')), '') IS NOT NULL
            AND NULLIF(BTRIM(COALESCE(ps.storage_path, '')), '') IS NOT NULL
            THEN 'application/pdf'
          ELSE NULL
        END
      )
    END AS payslip_content_type,
    CASE
      WHEN ps.id IS NULL THEN NULL::bigint
      WHEN NULLIF(BTRIM(COALESCE(ps.publication_metadata_json ->> 'fileSizeBytes', '')), '') ~ '^[0-9]+$'
        THEN (ps.publication_metadata_json ->> 'fileSizeBytes')::bigint
      ELSE NULL::bigint
    END AS payslip_file_size_bytes,
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

REVOKE ALL ON FUNCTION public.get_payroll_run_employee_entries(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_run_employee_entries(uuid)
  TO authenticated, service_role;
