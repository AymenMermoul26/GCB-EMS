-- =====================================================================
-- Payroll processing foundation
-- - Adds payroll periods, runs, run entries, and payslip metadata
-- - Preserves payroll role isolation and employee self-access to published payslips only
-- - Prepares lifecycle and audit scaffolding without implementing salary formulas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Payroll domain enums
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_period_status_enum'
  ) THEN
    CREATE TYPE public.payroll_period_status_enum AS ENUM (
      'DRAFT',
      'OPEN',
      'CLOSED',
      'ARCHIVED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_processing_status_enum'
  ) THEN
    CREATE TYPE public.payroll_processing_status_enum AS ENUM (
      'DRAFT',
      'CALCULATED',
      'UNDER_REVIEW',
      'FINALIZED',
      'PUBLISHED',
      'ARCHIVED'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2) Payroll processing tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."PayrollPeriod" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status public.payroll_period_status_enum NOT NULL DEFAULT 'DRAFT'::public.payroll_period_status_enum,
  notes text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payrollperiod_code UNIQUE (code),
  CONSTRAINT ck_payrollperiod_date_range CHECK (period_start <= period_end),
  CONSTRAINT fk_payrollperiod_created_by_user
    FOREIGN KEY (created_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."PayrollRun" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL,
  code text NOT NULL,
  run_type text NOT NULL DEFAULT 'REGULAR',
  status public.payroll_processing_status_enum NOT NULL DEFAULT 'DRAFT'::public.payroll_processing_status_enum,
  notes text,
  created_by_user_id uuid,
  calculated_at timestamptz,
  reviewed_at timestamptz,
  finalized_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payrollrun_code UNIQUE (code),
  CONSTRAINT uq_payrollrun_period_code UNIQUE (payroll_period_id, code),
  CONSTRAINT fk_payrollrun_period
    FOREIGN KEY (payroll_period_id)
    REFERENCES public."PayrollPeriod" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payrollrun_created_by_user
    FOREIGN KEY (created_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."PayrollRunEmploye" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL,
  employe_id uuid NOT NULL,
  status public.payroll_processing_status_enum NOT NULL DEFAULT 'DRAFT'::public.payroll_processing_status_enum,
  employee_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_notes text,
  calculated_at timestamptz,
  finalized_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payrollrunemploye_run_employe UNIQUE (payroll_run_id, employe_id),
  CONSTRAINT fk_payrollrunemploye_run
    FOREIGN KEY (payroll_run_id)
    REFERENCES public."PayrollRun" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payrollrunemploye_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public."Payslip" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL,
  payroll_run_employe_id uuid NOT NULL,
  employe_id uuid NOT NULL,
  status public.payroll_processing_status_enum NOT NULL DEFAULT 'FINALIZED'::public.payroll_processing_status_enum,
  file_name text,
  storage_path text,
  published_at timestamptz,
  published_by_user_id uuid,
  publication_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payslip_run_employe UNIQUE (payroll_run_employe_id),
  CONSTRAINT uq_payslip_run_employe_pair UNIQUE (payroll_run_id, employe_id),
  CONSTRAINT fk_payslip_run
    FOREIGN KEY (payroll_run_id)
    REFERENCES public."PayrollRun" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payslip_run_employe
    FOREIGN KEY (payroll_run_employe_id)
    REFERENCES public."PayrollRunEmploye" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_payslip_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_payslip_published_by_user
    FOREIGN KEY (published_by_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 3) Indexes and updated_at triggers
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payrollperiod_status
  ON public."PayrollPeriod" (status);
CREATE INDEX IF NOT EXISTS idx_payrollperiod_period_start
  ON public."PayrollPeriod" (period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payrollperiod_period_end
  ON public."PayrollPeriod" (period_end DESC);

CREATE INDEX IF NOT EXISTS idx_payrollrun_period_id
  ON public."PayrollRun" (payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payrollrun_status
  ON public."PayrollRun" (status);
CREATE INDEX IF NOT EXISTS idx_payrollrun_created_at
  ON public."PayrollRun" (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payrollrunemploye_run_id
  ON public."PayrollRunEmploye" (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payrollrunemploye_employe_id
  ON public."PayrollRunEmploye" (employe_id);
CREATE INDEX IF NOT EXISTS idx_payrollrunemploye_status
  ON public."PayrollRunEmploye" (status);

CREATE INDEX IF NOT EXISTS idx_payslip_employe_id
  ON public."Payslip" (employe_id);
CREATE INDEX IF NOT EXISTS idx_payslip_status
  ON public."Payslip" (status);
CREATE INDEX IF NOT EXISTS idx_payslip_published_at
  ON public."Payslip" (published_at DESC);

DROP TRIGGER IF EXISTS trg_payrollperiod_set_updated_at ON public."PayrollPeriod";
CREATE TRIGGER trg_payrollperiod_set_updated_at
BEFORE UPDATE ON public."PayrollPeriod"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payrollrun_set_updated_at ON public."PayrollRun";
CREATE TRIGGER trg_payrollrun_set_updated_at
BEFORE UPDATE ON public."PayrollRun"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payrollrunemploye_set_updated_at ON public."PayrollRunEmploye";
CREATE TRIGGER trg_payrollrunemploye_set_updated_at
BEFORE UPDATE ON public."PayrollRunEmploye"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payslip_set_updated_at ON public."Payslip";
CREATE TRIGGER trg_payslip_set_updated_at
BEFORE UPDATE ON public."Payslip"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4) Lifecycle guard functions
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_payroll_period_status_transition(
  p_old_status public.payroll_period_status_enum,
  p_new_status public.payroll_period_status_enum
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_old_status
    WHEN 'DRAFT'::public.payroll_period_status_enum THEN p_new_status IN (
      'DRAFT'::public.payroll_period_status_enum,
      'OPEN'::public.payroll_period_status_enum,
      'ARCHIVED'::public.payroll_period_status_enum
    )
    WHEN 'OPEN'::public.payroll_period_status_enum THEN p_new_status IN (
      'OPEN'::public.payroll_period_status_enum,
      'CLOSED'::public.payroll_period_status_enum,
      'ARCHIVED'::public.payroll_period_status_enum
    )
    WHEN 'CLOSED'::public.payroll_period_status_enum THEN p_new_status IN (
      'CLOSED'::public.payroll_period_status_enum,
      'ARCHIVED'::public.payroll_period_status_enum
    )
    WHEN 'ARCHIVED'::public.payroll_period_status_enum THEN p_new_status = 'ARCHIVED'::public.payroll_period_status_enum
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_payroll_processing_status_transition(
  p_old_status public.payroll_processing_status_enum,
  p_new_status public.payroll_processing_status_enum
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_old_status
    WHEN 'DRAFT'::public.payroll_processing_status_enum THEN p_new_status IN (
      'DRAFT'::public.payroll_processing_status_enum,
      'CALCULATED'::public.payroll_processing_status_enum,
      'ARCHIVED'::public.payroll_processing_status_enum
    )
    WHEN 'CALCULATED'::public.payroll_processing_status_enum THEN p_new_status IN (
      'CALCULATED'::public.payroll_processing_status_enum,
      'UNDER_REVIEW'::public.payroll_processing_status_enum,
      'ARCHIVED'::public.payroll_processing_status_enum
    )
    WHEN 'UNDER_REVIEW'::public.payroll_processing_status_enum THEN p_new_status IN (
      'UNDER_REVIEW'::public.payroll_processing_status_enum,
      'FINALIZED'::public.payroll_processing_status_enum,
      'ARCHIVED'::public.payroll_processing_status_enum
    )
    WHEN 'FINALIZED'::public.payroll_processing_status_enum THEN p_new_status IN (
      'FINALIZED'::public.payroll_processing_status_enum,
      'PUBLISHED'::public.payroll_processing_status_enum,
      'ARCHIVED'::public.payroll_processing_status_enum
    )
    WHEN 'PUBLISHED'::public.payroll_processing_status_enum THEN p_new_status IN (
      'PUBLISHED'::public.payroll_processing_status_enum,
      'ARCHIVED'::public.payroll_processing_status_enum
    )
    WHEN 'ARCHIVED'::public.payroll_processing_status_enum THEN p_new_status = 'ARCHIVED'::public.payroll_processing_status_enum
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.guard_payroll_period_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.is_valid_payroll_period_status_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid payroll period status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_payroll_processing_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.is_valid_payroll_processing_status_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid payroll processing status transition on %: % -> %', TG_TABLE_NAME, OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payrollperiod_guard_status ON public."PayrollPeriod";
CREATE TRIGGER trg_payrollperiod_guard_status
BEFORE UPDATE OF status ON public."PayrollPeriod"
FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_period_status_transition();

DROP TRIGGER IF EXISTS trg_payrollrun_guard_status ON public."PayrollRun";
CREATE TRIGGER trg_payrollrun_guard_status
BEFORE UPDATE OF status ON public."PayrollRun"
FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_processing_status_transition();

DROP TRIGGER IF EXISTS trg_payslip_guard_status ON public."Payslip";
CREATE TRIGGER trg_payslip_guard_status
BEFORE UPDATE OF status ON public."Payslip"
FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_processing_status_transition();

REVOKE ALL ON FUNCTION public.is_valid_payroll_period_status_transition(public.payroll_period_status_enum, public.payroll_period_status_enum) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_payroll_processing_status_transition(public.payroll_processing_status_enum, public.payroll_processing_status_enum) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_payroll_period_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_payroll_processing_status_transition() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_valid_payroll_period_status_transition(public.payroll_period_status_enum, public.payroll_period_status_enum) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_payroll_processing_status_transition(public.payroll_processing_status_enum, public.payroll_processing_status_enum) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_payroll_period_status_transition() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_payroll_processing_status_transition() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5) RLS and privileges
-- ---------------------------------------------------------------------
ALTER TABLE public."PayrollPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PayrollRunEmploye" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payslip" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_all_payrollperiod ON public."PayrollPeriod";
DROP POLICY IF EXISTS payroll_all_payrollrun ON public."PayrollRun";
DROP POLICY IF EXISTS payroll_all_payrollrunemploye ON public."PayrollRunEmploye";
DROP POLICY IF EXISTS payroll_all_payslip ON public."Payslip";
DROP POLICY IF EXISTS employee_select_own_published_payslip ON public."Payslip";

CREATE POLICY payroll_all_payrollperiod
ON public."PayrollPeriod"
FOR ALL
TO authenticated
USING (public.is_payroll_agent())
WITH CHECK (public.is_payroll_agent());

CREATE POLICY payroll_all_payrollrun
ON public."PayrollRun"
FOR ALL
TO authenticated
USING (public.is_payroll_agent())
WITH CHECK (public.is_payroll_agent());

CREATE POLICY payroll_all_payrollrunemploye
ON public."PayrollRunEmploye"
FOR ALL
TO authenticated
USING (public.is_payroll_agent())
WITH CHECK (public.is_payroll_agent());

CREATE POLICY payroll_all_payslip
ON public."Payslip"
FOR ALL
TO authenticated
USING (public.is_payroll_agent())
WITH CHECK (public.is_payroll_agent());

CREATE POLICY employee_select_own_published_payslip
ON public."Payslip"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
  AND published_at IS NOT NULL
  AND status IN (
    'PUBLISHED'::public.payroll_processing_status_enum,
    'ARCHIVED'::public.payroll_processing_status_enum
  )
);

REVOKE ALL PRIVILEGES ON TABLE public."PayrollPeriod" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."PayrollRun" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."PayrollRunEmploye" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."Payslip" FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PayrollPeriod" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PayrollRun" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PayrollRunEmploye" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Payslip" TO authenticated;

-- ---------------------------------------------------------------------
-- 6) Audit policies for payroll processing events
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
    'PAYROLL_PAYSLIP_PUBLISHED'
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
  )
);

-- ---------------------------------------------------------------------
-- 7) Payroll read models
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payroll_periods()
RETURNS TABLE (
  id uuid,
  code text,
  label text,
  period_start date,
  period_end date,
  status text,
  notes text,
  run_count integer,
  published_payslip_count integer,
  created_at timestamptz,
  updated_at timestamptz
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
    pp.status::text,
    pp.notes,
    COUNT(DISTINCT pr.id)::integer AS run_count,
    (
      COUNT(DISTINCT ps.id) FILTER (
        WHERE ps.published_at IS NOT NULL
      )
    )::integer AS published_payslip_count,
    pp.created_at,
    pp.updated_at
  FROM public."PayrollPeriod" pp
  LEFT JOIN public."PayrollRun" pr
    ON pr.payroll_period_id = pp.id
  LEFT JOIN public."Payslip" ps
    ON ps.payroll_run_id = pr.id
  WHERE auth.role() = 'service_role'
    OR public.is_payroll_agent()
  GROUP BY pp.id
  ORDER BY pp.period_start DESC, pp.created_at DESC;
$$;

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
    (
      COUNT(DISTINCT ps.id) FILTER (
        WHERE ps.published_at IS NOT NULL
      )
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
    ON ps.payroll_run_id = pr.id
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
    (
      COUNT(DISTINCT ps.id) FILTER (
        WHERE ps.published_at IS NOT NULL
      )
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
    ON ps.payroll_run_id = pr.id
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
  calculation_notes text,
  has_payslip boolean,
  payslip_status text,
  payslip_published_at timestamptz,
  employee_snapshot_json jsonb,
  result_summary_json jsonb,
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
    pre.calculation_notes,
    (ps.id IS NOT NULL) AS has_payslip,
    ps.status::text AS payslip_status,
    ps.published_at AS payslip_published_at,
    pre.employee_snapshot_json,
    pre.result_summary_json,
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

CREATE OR REPLACE FUNCTION public.get_employee_payslips()
RETURNS TABLE (
  id uuid,
  payroll_run_id uuid,
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

REVOKE ALL ON FUNCTION public.get_payroll_periods() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_runs(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_run_by_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_run_employee_entries(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_employee_payslips() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_payroll_periods() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_runs(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_run_by_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_run_employee_entries(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_payslips() TO authenticated, service_role;
