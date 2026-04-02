-- =====================================================================
-- Retire manual payslip upload as the primary request workflow
-- - fulfill_payslip_request now delivers an existing canonical payslip document
-- - manual upload remains legacy-compatible only through historical records
-- =====================================================================

REVOKE ALL ON FUNCTION public.fulfill_payslip_request(uuid, text, text, text, bigint, text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.fulfill_payslip_request(uuid, text, text, text, bigint, text);

CREATE OR REPLACE FUNCTION public.fulfill_payslip_request(
  p_request_id uuid,
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
  v_payslip public."Payslip"%ROWTYPE;
  v_employee_user_id uuid;
  v_actor_user_id uuid;
  v_period_code text;
  v_period_label text;
  v_source_payroll_run_id uuid;
  v_source_payroll_run_employe_id uuid;
  v_document_representation_mode text;
BEGIN
  IF NOT public.is_payroll_agent() THEN
    RAISE EXCEPTION 'Only payroll users can fulfill payslip requests.';
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
    SELECT ps.*
    INTO v_payslip
    FROM public."Payslip" ps
    WHERE ps.id = v_request.linked_payslip_id
    LIMIT 1;
  END IF;

  IF v_payslip.id IS NOT NULL THEN
    v_source_payroll_run_id := v_payslip.payroll_run_id;
    v_source_payroll_run_employe_id := v_payslip.payroll_run_employe_id;
  END IF;

  IF v_source_payroll_run_employe_id IS NULL THEN
    SELECT src.payroll_run_id, src.payroll_run_employe_id
    INTO v_source_payroll_run_id, v_source_payroll_run_employe_id
    FROM public.get_latest_published_payroll_result_source(
      v_request.employe_id,
      v_request.payroll_period_id
    ) src
    LIMIT 1;
  END IF;

  IF v_source_payroll_run_employe_id IS NULL THEN
    RAISE EXCEPTION 'This payslip request cannot be fulfilled until a published payroll result exists for the requested period.';
  END IF;

  IF v_payslip.id IS NULL THEN
    SELECT ps.*
    INTO v_payslip
    FROM public."Payslip" ps
    WHERE ps.payroll_run_employe_id = v_source_payroll_run_employe_id
    LIMIT 1;
  END IF;

  IF v_payslip.id IS NULL THEN
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
      NULL,
      NULL,
      now(),
      v_actor_user_id,
      jsonb_build_object(
        'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
        'canonicalPayrollRunId', v_source_payroll_run_id,
        'canonicalPayrollRunEmployeeId', v_source_payroll_run_employe_id,
        'canonicalEmployeeId', v_request.employe_id,
        'publicationSource', 'payroll_processing_foundation',
        'documentReady', false,
        'documentRepresentationMode', 'NONE',
        'documentAttachedAt', NULL
      )
    )
    RETURNING * INTO v_payslip;
  END IF;

  IF NOT public.resolve_payslip_document_ready(
    v_payslip.publication_metadata_json,
    v_payslip.file_name,
    v_payslip.storage_path
  ) THEN
    RAISE EXCEPTION 'This payslip request cannot be fulfilled until a generated or legacy document representation exists for the canonical payslip record.';
  END IF;

  v_document_representation_mode := public.resolve_payslip_document_representation_mode(
    v_payslip.publication_metadata_json,
    v_payslip.file_name,
    v_payslip.storage_path
  );

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
    v_payslip.id,
    v_payslip.file_name,
    v_payslip.storage_path,
    'application/pdf',
    NULL,
    jsonb_build_object(
      'canonicalSource', 'PAYROLL_RUN_EMPLOYEE_RESULT',
      'requestId', p_request_id,
      'linkedPayslipId', v_payslip.id,
      'documentReady', true,
      'documentRepresentationMode', v_document_representation_mode,
      'deliverySource', 'CANONICAL_PAYSLIP'
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
      linked_payslip_id = v_payslip.id,
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
          'canonical_payslip_id', v_payslip.id
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
          'canonical_payslip_id', v_payslip.id,
          'document_representation_mode', v_document_representation_mode,
          'delivery_source', 'CANONICAL_PAYSLIP'
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
        'linked_payslip_id', v_payslip.id,
        'canonical_source', 'PAYROLL_RUN_EMPLOYEE_RESULT',
        'payroll_run_id', v_source_payroll_run_id,
        'payroll_run_employe_id', v_source_payroll_run_employe_id,
        'document_representation_mode', v_document_representation_mode,
        'delivery_source', 'CANONICAL_PAYSLIP',
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
        'linked_payslip_id', v_payslip.id,
        'canonical_source', 'PAYROLL_RUN_EMPLOYEE_RESULT',
        'payroll_run_id', v_source_payroll_run_id,
        'payroll_run_employe_id', v_source_payroll_run_employe_id,
        'file_name', v_payslip.file_name,
        'storage_path', v_payslip.storage_path,
        'content_type', 'application/pdf',
        'file_size_bytes', NULL,
        'document_representation_mode', v_document_representation_mode,
        'delivery_source', 'CANONICAL_PAYSLIP'
      )
    );

  RETURN p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_payslip_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_payslip_request(uuid, text)
  TO authenticated, service_role;
