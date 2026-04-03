CREATE OR REPLACE FUNCTION public.get_payroll_run_activity(
  p_run_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  action text,
  target_type text,
  target_id uuid,
  details_json jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250);
BEGIN
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'Payroll run activity requires a payroll run id.';
  END IF;

  IF NOT public.is_payroll_agent() THEN
    RAISE EXCEPTION 'Only payroll agents can access payroll run activity.';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.target_type,
    al.target_id,
    al.details_json,
    al.created_at
  FROM public.audit_log AS al
  WHERE al.action IN (
    'PAYROLL_RUN_CREATED',
    'PAYROLL_RUN_UPDATED',
    'PAYROLL_RUN_FINALIZED',
    'PAYROLL_CALCULATION_STARTED',
    'PAYROLL_CALCULATION_COMPLETED',
    'PAYROLL_CALCULATION_FAILED',
    'PAYROLL_PAYSLIP_PUBLISHED',
    'PAYSLIP_DOCUMENT_PUBLISHED'
  )
    AND (
      (al.target_type = 'PayrollRun' AND al.target_id = p_run_id)
      OR al.details_json->>'payroll_run_id' = p_run_id::text
    )
  ORDER BY al.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_run_activity(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_run_activity(uuid, integer)
  TO authenticated, service_role;
