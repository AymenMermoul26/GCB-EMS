CREATE OR REPLACE FUNCTION public.get_payroll_employee_export_rows(
  p_search text DEFAULT NULL,
  p_departement_id uuid DEFAULT NULL,
  p_status text DEFAULT 'ALL',
  p_type_contrat text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  departement_id uuid,
  departement_nom text,
  matricule text,
  nom text,
  prenom text,
  poste text,
  categorie_professionnelle text,
  type_contrat text,
  date_recrutement date,
  email text,
  telephone text,
  adresse text,
  situation_familiale text,
  nombre_enfants integer,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.departement_id,
    d.nom AS departement_nom,
    e.matricule,
    e.nom,
    e.prenom,
    e.poste,
    e.categorie_professionnelle,
    e.type_contrat,
    e.date_recrutement,
    e.email,
    e.telephone,
    e.adresse,
    e.situation_familiale,
    e.nombre_enfants,
    e.is_active
  FROM public."Employe" e
  LEFT JOIN public."Departement" d
    ON d.id = e.departement_id
  WHERE (
      auth.role() = 'service_role'
      OR public.is_admin_rh()
      OR public.is_payroll_agent()
    )
    AND (
      NULLIF(BTRIM(p_search), '') IS NULL
      OR e.nom ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR e.prenom ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR CONCAT_WS(' ', e.prenom, e.nom) ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR e.matricule ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
      OR COALESCE(e.email, '') ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
    )
    AND (
      p_departement_id IS NULL
      OR e.departement_id = p_departement_id
    )
    AND (
      UPPER(COALESCE(p_status, 'ALL')) = 'ALL'
      OR (UPPER(p_status) = 'ACTIVE' AND e.is_active = TRUE)
      OR (UPPER(p_status) = 'INACTIVE' AND e.is_active = FALSE)
    )
    AND (
      NULLIF(BTRIM(p_type_contrat), '') IS NULL
      OR e.type_contrat = NULLIF(BTRIM(p_type_contrat), '')
    )
  ORDER BY LOWER(e.nom), LOWER(e.prenom), e.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_employee_export_rows(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_employee_export_rows(text, uuid, text, text)
TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_action_created_at
ON public.audit_log (actor_user_id, action, created_at DESC);

DROP POLICY IF EXISTS payroll_select_own_export_audit_log ON public.audit_log;
DROP POLICY IF EXISTS payroll_insert_export_audit_log ON public.audit_log;

CREATE POLICY payroll_select_own_export_audit_log
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  public.is_payroll_agent()
  AND actor_user_id = auth.uid()
  AND action IN ('PAYROLL_EXPORT_GENERATED', 'PAYROLL_EXPORT_PRINT_INITIATED')
);

CREATE POLICY payroll_insert_export_audit_log
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_payroll_agent()
  AND actor_user_id = auth.uid()
  AND (
    (
      action = 'PAYROLL_EXPORT_GENERATED'
      AND target_type = 'payroll_export'
      AND target_id IS NULL
    )
    OR (
      action = 'PAYROLL_EXPORT_PRINT_INITIATED'
      AND target_type = 'Employe'
      AND target_id IS NOT NULL
    )
  )
);
