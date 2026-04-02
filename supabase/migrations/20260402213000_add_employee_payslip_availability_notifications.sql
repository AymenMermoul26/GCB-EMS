CREATE OR REPLACE FUNCTION public.notify_employee_payslip_available(
  p_employe_id uuid,
  p_payslip_id uuid,
  p_payroll_run_id uuid,
  p_payroll_period_id uuid,
  p_payroll_period_code text,
  p_payroll_period_label text,
  p_link text DEFAULT '/employee/payslips'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope constant text := 'employee_payslip_availability';
  v_dedupe_key text := p_payslip_id::text;
  v_user_id uuid;
  v_notification_id uuid;
  v_title text := 'Payslip available';
  v_period_label text := COALESCE(NULLIF(BTRIM(p_payroll_period_label), ''), NULLIF(BTRIM(p_payroll_period_code), ''), 'this payroll period');
  v_body text := format('Your payslip for %s is now available in your employee account.', v_period_label);
  v_link text := COALESCE(NULLIF(BTRIM(p_link), ''), '/employee/payslips');
  v_metadata jsonb;
BEGIN
  IF p_employe_id IS NULL OR p_payslip_id IS NULL OR p_payroll_run_id IS NULL OR p_payroll_period_id IS NULL THEN
    RAISE EXCEPTION 'Payslip availability notifications require employee, payslip, payroll run, and payroll period identifiers.';
  END IF;

  IF NOT public.is_payroll_agent() AND NOT public.is_admin_rh() THEN
    RAISE EXCEPTION 'Only payroll or admin users can notify employees about payslip availability.';
  END IF;

  SELECT pu.user_id
  INTO v_user_id
  FROM public."ProfilUtilisateur" pu
  WHERE pu.employe_id = p_employe_id
    AND pu.role = 'EMPLOYE'
    AND pu.user_id IS NOT NULL
  ORDER BY pu.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_metadata := jsonb_build_object(
    'scope', v_scope,
    'dedupe_key', v_dedupe_key,
    'event_key', 'PAYSLIP_AVAILABLE',
    'employe_id', p_employe_id,
    'payslip_id', p_payslip_id,
    'payroll_run_id', p_payroll_run_id,
    'payroll_period_id', p_payroll_period_id,
    'payroll_period_code', p_payroll_period_code,
    'payroll_period_label', p_payroll_period_label
  );

  SELECT n.id
  INTO v_notification_id
  FROM public.notifications n
  WHERE n.user_id = v_user_id
    AND n.metadata_json->>'scope' = v_scope
    AND n.metadata_json->>'dedupe_key' = v_dedupe_key
  ORDER BY n.created_at DESC
  LIMIT 1;

  IF v_notification_id IS NULL THEN
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
      v_title,
      v_body,
      v_link,
      false,
      v_metadata
    )
    RETURNING id INTO v_notification_id;
  ELSE
    UPDATE public.notifications
    SET title = v_title,
        body = v_body,
        link = v_link,
        metadata_json = v_metadata
    WHERE id = v_notification_id;
  END IF;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_employee_payslip_available(uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_employee_payslip_available(uuid, uuid, uuid, uuid, text, text, text) TO authenticated, service_role;
