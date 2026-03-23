-- =====================================================================
-- Payroll calculation engine foundation
-- - Adds payroll-only compensation inputs
-- - Adds authoritative calculation fields on payroll run employee entries
-- - Adds secure payroll calculation RPCs and calculation-readiness guards
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Calculation enums
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_calculation_status_enum'
  ) THEN
    CREATE TYPE public.payroll_calculation_status_enum AS ENUM (
      'PENDING',
      'CALCULATED',
      'EXCLUDED',
      'FAILED'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2) Payroll-only compensation inputs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."PayrollCompensationProfile" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL,
  base_salary_amount numeric(12, 2) NOT NULL DEFAULT 0,
  fixed_allowance_amount numeric(12, 2) NOT NULL DEFAULT 0,
  fixed_deduction_amount numeric(12, 2) NOT NULL DEFAULT 0,
  is_payroll_eligible boolean NOT NULL DEFAULT true,
  notes text,
  created_by_user_id uuid,
  updated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payrollcompensationprofile_employe UNIQUE (employe_id),
  CONSTRAINT ck_payrollcompensationprofile_base_salary_non_negative
    CHECK (base_salary_amount >= 0),
  CONSTRAINT ck_payrollcompensationprofile_fixed_allowance_non_negative
    CHECK (fixed_allowance_amount >= 0),
  CONSTRAINT ck_payrollcompensationprofile_fixed_deduction_non_negative
    CHECK (fixed_deduction_amount >= 0),
  CONSTRAINT fk_payrollcompensationprofile_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payrollcompensationprofile_created_by_user
    FOREIGN KEY (created_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_payrollcompensationprofile_updated_by_user
    FOREIGN KEY (updated_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payrollcompensationprofile_employe_id
  ON public."PayrollCompensationProfile" (employe_id);
CREATE INDEX IF NOT EXISTS idx_payrollcompensationprofile_is_payroll_eligible
  ON public."PayrollCompensationProfile" (is_payroll_eligible);

DROP TRIGGER IF EXISTS trg_payrollcompensationprofile_set_updated_at
  ON public."PayrollCompensationProfile";
CREATE TRIGGER trg_payrollcompensationprofile_set_updated_at
BEFORE UPDATE ON public."PayrollCompensationProfile"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public."PayrollCompensationProfile" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_all_payrollcompensationprofile
  ON public."PayrollCompensationProfile";
CREATE POLICY payroll_all_payrollcompensationprofile
ON public."PayrollCompensationProfile"
FOR ALL
TO authenticated
USING (public.is_payroll_agent())
WITH CHECK (public.is_payroll_agent());

REVOKE ALL PRIVILEGES ON TABLE public."PayrollCompensationProfile" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public."PayrollCompensationProfile" TO authenticated;

-- ---------------------------------------------------------------------
-- 3) Payroll run calculation fields
-- ---------------------------------------------------------------------
ALTER TABLE public."PayrollRunEmploye"
  ADD COLUMN IF NOT EXISTS calculation_status
    public.payroll_calculation_status_enum NOT NULL
    DEFAULT 'PENDING'::public.payroll_calculation_status_enum,
  ADD COLUMN IF NOT EXISTS exclusion_reason text,
  ADD COLUMN IF NOT EXISTS issue_flags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS base_salary_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS total_allowances_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS gross_pay_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS total_deductions_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS net_pay_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS calculated_by_user_id uuid
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payrollrunemploye_calculation_status
  ON public."PayrollRunEmploye" (calculation_status);

-- ---------------------------------------------------------------------
-- 4) Readiness guard for calculated payroll runs
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_payroll_run_calculation_readiness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pending_entries integer;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status = 'CALCULATED'::public.payroll_processing_status_enum
  THEN
    SELECT COUNT(*)
    INTO v_pending_entries
    FROM public."PayrollRunEmploye" pre
    WHERE pre.payroll_run_id = NEW.id
      AND pre.calculation_status NOT IN (
        'CALCULATED'::public.payroll_calculation_status_enum,
        'EXCLUDED'::public.payroll_calculation_status_enum
      );

    IF v_pending_entries > 0 THEN
      RAISE EXCEPTION 'Payroll run % cannot move to CALCULATED until all entries are calculated or excluded.', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payrollrun_guard_calculation_readiness
  ON public."PayrollRun";
CREATE TRIGGER trg_payrollrun_guard_calculation_readiness
BEFORE UPDATE OF status ON public."PayrollRun"
FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_run_calculation_readiness();

REVOKE ALL ON FUNCTION public.guard_payroll_run_calculation_readiness() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_payroll_run_calculation_readiness()
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5) Payroll calculation audit policy extension
-- ---------------------------------------------------------------------
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
    'PAYROLL_CALCULATION_FAILED'
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
  )
);

-- ---------------------------------------------------------------------
-- 6) Compensation read model
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payroll_compensation_profiles(
  p_search text DEFAULT NULL,
  p_payroll_eligible boolean DEFAULT NULL
)
RETURNS TABLE (
  compensation_profile_id uuid,
  employe_id uuid,
  matricule text,
  nom text,
  prenom text,
  departement_nom text,
  poste text,
  categorie_professionnelle text,
  type_contrat text,
  is_active boolean,
  has_profile boolean,
  is_payroll_eligible boolean,
  base_salary_amount numeric,
  fixed_allowance_amount numeric,
  fixed_deduction_amount numeric,
  notes text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pcp.id AS compensation_profile_id,
    e.id AS employe_id,
    e.matricule,
    e.nom,
    e.prenom,
    d.nom AS departement_nom,
    e.poste,
    e.categorie_professionnelle,
    e.type_contrat,
    e.is_active,
    (pcp.id IS NOT NULL) AS has_profile,
    COALESCE(pcp.is_payroll_eligible, false) AS is_payroll_eligible,
    pcp.base_salary_amount,
    pcp.fixed_allowance_amount,
    pcp.fixed_deduction_amount,
    pcp.notes,
    pcp.updated_at
  FROM public."Employe" e
  LEFT JOIN public."Departement" d
    ON d.id = e.departement_id
  LEFT JOIN public."PayrollCompensationProfile" pcp
    ON pcp.employe_id = e.id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_payroll_agent()
    )
    AND (
      NULLIF(BTRIM(p_search), '') IS NULL
      OR e.nom ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR e.prenom ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR CONCAT_WS(' ', e.prenom, e.nom) ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR e.matricule ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
    )
    AND (
      p_payroll_eligible IS NULL
      OR COALESCE(pcp.is_payroll_eligible, false) = p_payroll_eligible
    )
  ORDER BY LOWER(e.nom), LOWER(e.prenom), e.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_compensation_profiles(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_compensation_profiles(text, boolean)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7) Authoritative payroll calculation RPC
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_payroll_run(p_run_id uuid)
RETURNS TABLE (
  payroll_run_id uuid,
  employee_count integer,
  calculated_employee_count integer,
  excluded_employee_count integer,
  failed_employee_count integer,
  total_gross_pay numeric,
  total_deductions_amount numeric,
  total_net_pay numeric,
  calculated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public."PayrollRun"%ROWTYPE;
  v_now timestamptz := now();
  v_actor_user_id uuid := auth.uid();
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_payroll_agent()
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges to calculate payroll runs.';
  END IF;

  SELECT *
  INTO v_run
  FROM public."PayrollRun"
  WHERE id = p_run_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run not found.';
  END IF;

  IF v_run.status IN (
    'FINALIZED'::public.payroll_processing_status_enum,
    'PUBLISHED'::public.payroll_processing_status_enum,
    'ARCHIVED'::public.payroll_processing_status_enum
  ) THEN
    RAISE EXCEPTION 'Payroll run % can no longer be recalculated from status %.', p_run_id, v_run.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."PayrollRunEmploye" pre
    WHERE pre.payroll_run_id = p_run_id
  ) THEN
    RAISE EXCEPTION 'Cannot calculate a payroll run with no employee entries.';
  END IF;

  UPDATE public."PayrollRunEmploye" pre
  SET
    calculation_status = CASE
      WHEN e.is_active IS NOT TRUE THEN 'EXCLUDED'::public.payroll_calculation_status_enum
      WHEN pcp.id IS NULL THEN 'EXCLUDED'::public.payroll_calculation_status_enum
      WHEN pcp.is_payroll_eligible IS NOT TRUE THEN 'EXCLUDED'::public.payroll_calculation_status_enum
      ELSE 'CALCULATED'::public.payroll_calculation_status_enum
    END,
    exclusion_reason = CASE
      WHEN e.is_active IS NOT TRUE THEN 'Employee is inactive.'
      WHEN pcp.id IS NULL THEN 'Missing payroll compensation profile.'
      WHEN pcp.is_payroll_eligible IS NOT TRUE THEN 'Employee is marked as payroll-ineligible.'
      ELSE NULL
    END,
    issue_flags_json = CASE
      WHEN e.is_active IS NOT TRUE THEN jsonb_build_array('employee_inactive')
      WHEN pcp.id IS NULL THEN jsonb_build_array('missing_compensation_profile')
      WHEN pcp.is_payroll_eligible IS NOT TRUE THEN jsonb_build_array('payroll_marked_ineligible')
      WHEN (
        COALESCE(pcp.base_salary_amount, 0) + COALESCE(pcp.fixed_allowance_amount, 0)
      ) < COALESCE(pcp.fixed_deduction_amount, 0) THEN jsonb_build_array('deductions_exceed_gross')
      ELSE '[]'::jsonb
    END,
    calculation_input_json = jsonb_strip_nulls(
      jsonb_build_object(
        'baseSalaryAmount', pcp.base_salary_amount,
        'fixedAllowanceAmount', pcp.fixed_allowance_amount,
        'fixedDeductionAmount', pcp.fixed_deduction_amount,
        'isPayrollEligible', pcp.is_payroll_eligible,
        'compensationProfileUpdatedAt', pcp.updated_at
      )
    ),
    base_salary_amount = CASE
      WHEN e.is_active IS TRUE AND pcp.id IS NOT NULL AND pcp.is_payroll_eligible IS TRUE
        THEN COALESCE(pcp.base_salary_amount, 0)
      ELSE NULL
    END,
    total_allowances_amount = CASE
      WHEN e.is_active IS TRUE AND pcp.id IS NOT NULL AND pcp.is_payroll_eligible IS TRUE
        THEN COALESCE(pcp.fixed_allowance_amount, 0)
      ELSE NULL
    END,
    gross_pay_amount = CASE
      WHEN e.is_active IS TRUE AND pcp.id IS NOT NULL AND pcp.is_payroll_eligible IS TRUE
        THEN COALESCE(pcp.base_salary_amount, 0) + COALESCE(pcp.fixed_allowance_amount, 0)
      ELSE NULL
    END,
    total_deductions_amount = CASE
      WHEN e.is_active IS TRUE AND pcp.id IS NOT NULL AND pcp.is_payroll_eligible IS TRUE
        THEN COALESCE(pcp.fixed_deduction_amount, 0)
      ELSE NULL
    END,
    net_pay_amount = CASE
      WHEN e.is_active IS TRUE AND pcp.id IS NOT NULL AND pcp.is_payroll_eligible IS TRUE
        THEN GREATEST(
          (COALESCE(pcp.base_salary_amount, 0) + COALESCE(pcp.fixed_allowance_amount, 0))
          - COALESCE(pcp.fixed_deduction_amount, 0),
          0
        )
      ELSE NULL
    END,
    calculation_notes = CASE
      WHEN e.is_active IS NOT TRUE THEN 'Excluded from payroll calculation because the employee is inactive.'
      WHEN pcp.id IS NULL THEN 'Excluded from payroll calculation because compensation inputs are missing.'
      WHEN pcp.is_payroll_eligible IS NOT TRUE THEN 'Excluded from payroll calculation because the employee is marked as payroll-ineligible.'
      WHEN (
        COALESCE(pcp.base_salary_amount, 0) + COALESCE(pcp.fixed_allowance_amount, 0)
      ) < COALESCE(pcp.fixed_deduction_amount, 0) THEN 'Calculated with net pay floored at zero because deductions exceed gross pay.'
      ELSE 'Calculated from the fixed payroll compensation profile.'
    END,
    result_summary_json = CASE
      WHEN e.is_active IS TRUE AND pcp.id IS NOT NULL AND pcp.is_payroll_eligible IS TRUE
        THEN jsonb_build_object(
          'lifecycleStage', 'CALCULATED',
          'calculationStatus', 'CALCULATED',
          'baseSalaryAmount', COALESCE(pcp.base_salary_amount, 0),
          'totalAllowancesAmount', COALESCE(pcp.fixed_allowance_amount, 0),
          'grossPayAmount', COALESCE(pcp.base_salary_amount, 0) + COALESCE(pcp.fixed_allowance_amount, 0),
          'totalDeductionsAmount', COALESCE(pcp.fixed_deduction_amount, 0),
          'netPayAmount', GREATEST(
            (COALESCE(pcp.base_salary_amount, 0) + COALESCE(pcp.fixed_allowance_amount, 0))
            - COALESCE(pcp.fixed_deduction_amount, 0),
            0
          ),
          'publicationState', 'NOT_PUBLISHED'
        )
      ELSE jsonb_build_object(
        'lifecycleStage', 'CALCULATED',
        'calculationStatus', 'EXCLUDED',
        'exclusionReason', CASE
          WHEN e.is_active IS NOT TRUE THEN 'Employee is inactive.'
          WHEN pcp.id IS NULL THEN 'Missing payroll compensation profile.'
          WHEN pcp.is_payroll_eligible IS NOT TRUE THEN 'Employee is marked as payroll-ineligible.'
          ELSE 'Excluded'
        END,
        'publicationState', 'NOT_PUBLISHED'
      )
    END,
    calculated_at = v_now,
    calculated_by_user_id = v_actor_user_id,
    status = 'CALCULATED'::public.payroll_processing_status_enum
  FROM public."Employe" e
  LEFT JOIN public."PayrollCompensationProfile" pcp
    ON pcp.employe_id = e.id
  WHERE pre.payroll_run_id = p_run_id
    AND e.id = pre.employe_id;

  UPDATE public."PayrollRun"
  SET
    status = 'CALCULATED'::public.payroll_processing_status_enum,
    calculated_at = v_now
  WHERE id = p_run_id;

  RETURN QUERY
  SELECT
    pre.payroll_run_id,
    COUNT(*)::integer AS employee_count,
    COUNT(*) FILTER (
      WHERE pre.calculation_status = 'CALCULATED'::public.payroll_calculation_status_enum
    )::integer AS calculated_employee_count,
    COUNT(*) FILTER (
      WHERE pre.calculation_status = 'EXCLUDED'::public.payroll_calculation_status_enum
    )::integer AS excluded_employee_count,
    COUNT(*) FILTER (
      WHERE pre.calculation_status = 'FAILED'::public.payroll_calculation_status_enum
    )::integer AS failed_employee_count,
    COALESCE(ROUND(SUM(pre.gross_pay_amount), 2), 0)::numeric AS total_gross_pay,
    COALESCE(ROUND(SUM(pre.total_deductions_amount), 2), 0)::numeric AS total_deductions_amount,
    COALESCE(ROUND(SUM(pre.net_pay_amount), 2), 0)::numeric AS total_net_pay,
    v_now AS calculated_at
  FROM public."PayrollRunEmploye" pre
  WHERE pre.payroll_run_id = p_run_id
  GROUP BY pre.payroll_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_payroll_run(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_payroll_run(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8) Extend payroll run read models with calculation summaries
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_payroll_runs(uuid);
DROP FUNCTION IF EXISTS public.get_payroll_run_by_id(uuid);
DROP FUNCTION IF EXISTS public.get_payroll_run_employee_entries(uuid);

CREATE OR REPLACE FUNCTION public.get_payroll_runs(p_period_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  payroll_period_id uuid,
  period_code text,
  period_label text,
  code text,
  run_type text,
  status text,
  notes text,
  employee_count integer,
  calculated_employee_count integer,
  excluded_employee_count integer,
  failed_employee_count integer,
  total_gross_pay numeric,
  total_deductions_amount numeric,
  total_net_pay numeric,
  published_payslip_count integer,
  created_at timestamptz,
  calculated_at timestamptz,
  reviewed_at timestamptz,
  finalized_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.id,
    pr.payroll_period_id,
    pp.code AS period_code,
    pp.label AS period_label,
    pr.code,
    pr.run_type,
    pr.status::text,
    pr.notes,
    COUNT(DISTINCT pre.id)::integer AS employee_count,
    COUNT(DISTINCT pre.id) FILTER (
      WHERE pre.calculation_status = 'CALCULATED'::public.payroll_calculation_status_enum
    )::integer AS calculated_employee_count,
    COUNT(DISTINCT pre.id) FILTER (
      WHERE pre.calculation_status = 'EXCLUDED'::public.payroll_calculation_status_enum
    )::integer AS excluded_employee_count,
    COUNT(DISTINCT pre.id) FILTER (
      WHERE pre.calculation_status = 'FAILED'::public.payroll_calculation_status_enum
    )::integer AS failed_employee_count,
    COALESCE(ROUND(SUM(pre.gross_pay_amount), 2), 0)::numeric AS total_gross_pay,
    COALESCE(ROUND(SUM(pre.total_deductions_amount), 2), 0)::numeric AS total_deductions_amount,
    COALESCE(ROUND(SUM(pre.net_pay_amount), 2), 0)::numeric AS total_net_pay,
    COUNT(DISTINCT ps.id) FILTER (
      WHERE ps.published_at IS NOT NULL
    )::integer AS published_payslip_count,
    pr.created_at,
    pr.calculated_at,
    pr.reviewed_at,
    pr.finalized_at,
    pr.published_at,
    pr.archived_at
  FROM public."PayrollRun" pr
  INNER JOIN public."PayrollPeriod" pp
    ON pp.id = pr.payroll_period_id
  LEFT JOIN public."PayrollRunEmploye" pre
    ON pre.payroll_run_id = pr.id
  LEFT JOIN public."Payslip" ps
    ON ps.payroll_run_employe_id = pre.id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_payroll_agent()
    )
    AND (p_period_id IS NULL OR pr.payroll_period_id = p_period_id)
  GROUP BY pr.id, pp.code, pp.label, pp.period_start
  ORDER BY pp.period_start DESC, pr.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_payroll_run_by_id(p_run_id uuid)
RETURNS TABLE (
  id uuid,
  payroll_period_id uuid,
  period_code text,
  period_label text,
  period_start date,
  period_end date,
  code text,
  run_type text,
  status text,
  notes text,
  employee_count integer,
  calculated_employee_count integer,
  excluded_employee_count integer,
  failed_employee_count integer,
  total_gross_pay numeric,
  total_deductions_amount numeric,
  total_net_pay numeric,
  published_payslip_count integer,
  created_at timestamptz,
  calculated_at timestamptz,
  reviewed_at timestamptz,
  finalized_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.id,
    pr.payroll_period_id,
    pp.code AS period_code,
    pp.label AS period_label,
    pp.period_start,
    pp.period_end,
    pr.code,
    pr.run_type,
    pr.status::text,
    pr.notes,
    COUNT(DISTINCT pre.id)::integer AS employee_count,
    COUNT(DISTINCT pre.id) FILTER (
      WHERE pre.calculation_status = 'CALCULATED'::public.payroll_calculation_status_enum
    )::integer AS calculated_employee_count,
    COUNT(DISTINCT pre.id) FILTER (
      WHERE pre.calculation_status = 'EXCLUDED'::public.payroll_calculation_status_enum
    )::integer AS excluded_employee_count,
    COUNT(DISTINCT pre.id) FILTER (
      WHERE pre.calculation_status = 'FAILED'::public.payroll_calculation_status_enum
    )::integer AS failed_employee_count,
    COALESCE(ROUND(SUM(pre.gross_pay_amount), 2), 0)::numeric AS total_gross_pay,
    COALESCE(ROUND(SUM(pre.total_deductions_amount), 2), 0)::numeric AS total_deductions_amount,
    COALESCE(ROUND(SUM(pre.net_pay_amount), 2), 0)::numeric AS total_net_pay,
    COUNT(DISTINCT ps.id) FILTER (
      WHERE ps.published_at IS NOT NULL
    )::integer AS published_payslip_count,
    pr.created_at,
    pr.calculated_at,
    pr.reviewed_at,
    pr.finalized_at,
    pr.published_at,
    pr.archived_at
  FROM public."PayrollRun" pr
  INNER JOIN public."PayrollPeriod" pp
    ON pp.id = pr.payroll_period_id
  LEFT JOIN public."PayrollRunEmploye" pre
    ON pre.payroll_run_id = pr.id
  LEFT JOIN public."Payslip" ps
    ON ps.payroll_run_employe_id = pre.id
  WHERE pr.id = p_run_id
    AND (
      auth.role() = 'service_role'
      OR public.is_payroll_agent()
    )
  GROUP BY pr.id, pp.code, pp.label, pp.period_start, pp.period_end
  LIMIT 1;
$$;

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

REVOKE ALL ON FUNCTION public.get_payroll_runs(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_run_by_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_run_employee_entries(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_payroll_runs(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_run_by_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_run_employee_entries(uuid) TO authenticated, service_role;
