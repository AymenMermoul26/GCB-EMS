ALTER TABLE public."Employe"
ADD COLUMN IF NOT EXISTS regional_branch text;

ALTER TABLE public."Employe"
DISABLE TRIGGER trg_guard_employee_self_update;

UPDATE public."Employe"
SET regional_branch = CASE LOWER(BTRIM(email))
  WHEN 'hradmin@gcb.com' THEN 'Alger (El Harrach, Oued Smar)'
  WHEN 'yacine.bensaid@gcb.com' THEN 'Alger (El Harrach, Oued Smar)'
  WHEN 'amine.kherfi@gcb.com' THEN 'Boumerdès'
  WHEN 'sara.meziane@gcb.com' THEN 'Arzew'
  WHEN 'lina.boudiaf@gcb.com' THEN 'Hassi Messaoud'
  WHEN 'walid.cheriet@gcb.com' THEN 'Hassi R’Mel'
  WHEN 'ilyes.ferhat@gcb.com' THEN 'In Salah'
  WHEN 'ines.rahmani@gcb.com' THEN 'Adrar'
  WHEN 'karim.touati@gcb.com' THEN 'In Amenas'
  WHEN 'nadia.benali@gcb.com' THEN 'Boumerdès'
  WHEN 'samir.bouzid@gcb.com' THEN 'Alger (El Harrach, Oued Smar)'
  WHEN 'ryma.saadi@gcb.com' THEN 'Arzew'
  WHEN 'mourad.hamidi@gcb.com' THEN 'Hassi Messaoud'
  ELSE regional_branch
END
WHERE regional_branch IS NULL
  AND email IS NOT NULL;

ALTER TABLE public."Employe"
ENABLE TRIGGER trg_guard_employee_self_update;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_regional_branch_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_regional_branch_check
    CHECK (
      regional_branch IS NULL
      OR regional_branch IN (
        'Alger (El Harrach, Oued Smar)',
        'Boumerdès',
        'Arzew',
        'Hassi Messaoud',
        'Hassi R’Mel',
        'In Salah',
        'Adrar',
        'In Amenas'
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_employe_regional_branch
ON public."Employe" (regional_branch);

DROP FUNCTION IF EXISTS public.get_employee_self_profile(uuid);

CREATE FUNCTION public.get_employee_self_profile(p_employee_id uuid)
RETURNS TABLE (
  id uuid,
  departement_id uuid,
  regional_branch text,
  matricule text,
  nom text,
  prenom text,
  sexe text,
  date_naissance date,
  lieu_naissance text,
  nationalite text,
  situation_familiale text,
  nombre_enfants integer,
  adresse text,
  diplome text,
  specialite text,
  historique_postes text,
  poste text,
  categorie_professionnelle text,
  type_contrat text,
  date_recrutement date,
  email text,
  telephone text,
  photo_url text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.departement_id,
    e.regional_branch,
    e.matricule,
    e.nom,
    e.prenom,
    e.sexe,
    e.date_naissance,
    e.lieu_naissance,
    e.nationalite,
    e.situation_familiale,
    e.nombre_enfants,
    e.adresse,
    e.diplome,
    e.specialite,
    e.historique_postes,
    e.poste,
    e.categorie_professionnelle,
    e.type_contrat,
    e.date_recrutement,
    e.email,
    e.telephone,
    e.photo_url,
    e.is_active,
    e.created_at,
    e.updated_at
  FROM public."Employe" e
  WHERE e.id = p_employee_id
    AND (
      auth.role() = 'service_role'
      OR (
        public.is_employe_user()
        AND e.id = public.current_employe_id()
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_employee_self_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_self_profile(uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_payroll_employees(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.get_payroll_employees(text, uuid, text, text, text);

CREATE FUNCTION public.get_payroll_employees(
  p_search text DEFAULT NULL,
  p_departement_id uuid DEFAULT NULL,
  p_regional_branch text DEFAULT NULL,
  p_status text DEFAULT 'ALL',
  p_type_contrat text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  departement_id uuid,
  departement_nom text,
  regional_branch text,
  matricule text,
  nom text,
  prenom text,
  poste text,
  categorie_professionnelle text,
  type_contrat text,
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
    e.regional_branch,
    e.matricule,
    e.nom,
    e.prenom,
    e.poste,
    e.categorie_professionnelle,
    e.type_contrat,
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
      OR COALESCE(e.regional_branch, '') ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
    )
    AND (
      p_departement_id IS NULL
      OR e.departement_id = p_departement_id
    )
    AND (
      NULLIF(BTRIM(p_regional_branch), '') IS NULL
      OR e.regional_branch = NULLIF(BTRIM(p_regional_branch), '')
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

REVOKE ALL ON FUNCTION public.get_payroll_employees(text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_employees(text, uuid, text, text, text)
TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_payroll_employee_by_id(uuid);

CREATE FUNCTION public.get_payroll_employee_by_id(p_employee_id uuid)
RETURNS TABLE (
  id uuid,
  departement_id uuid,
  departement_nom text,
  regional_branch text,
  matricule text,
  nom text,
  prenom text,
  photo_url text,
  poste text,
  categorie_professionnelle text,
  type_contrat text,
  date_recrutement date,
  email text,
  telephone text,
  sexe text,
  date_naissance date,
  lieu_naissance text,
  nationalite text,
  situation_familiale text,
  nombre_enfants integer,
  adresse text,
  numero_securite_sociale text,
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
    e.regional_branch,
    e.matricule,
    e.nom,
    e.prenom,
    e.photo_url,
    e.poste,
    e.categorie_professionnelle,
    e.type_contrat,
    e.date_recrutement,
    e.email,
    e.telephone,
    e.sexe,
    e.date_naissance,
    e.lieu_naissance,
    e.nationalite,
    e.situation_familiale,
    e.nombre_enfants,
    e.adresse,
    e.numero_securite_sociale,
    e.is_active
  FROM public."Employe" e
  LEFT JOIN public."Departement" d
    ON d.id = e.departement_id
  WHERE e.id = p_employee_id
    AND (
      auth.role() = 'service_role'
      OR public.is_admin_rh()
      OR public.is_payroll_agent()
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_employee_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_employee_by_id(uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_payroll_employee_export_rows(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.get_payroll_employee_export_rows(text, uuid, text, text, text);

CREATE FUNCTION public.get_payroll_employee_export_rows(
  p_search text DEFAULT NULL,
  p_departement_id uuid DEFAULT NULL,
  p_regional_branch text DEFAULT NULL,
  p_status text DEFAULT 'ALL',
  p_type_contrat text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  departement_id uuid,
  departement_nom text,
  regional_branch text,
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
    e.regional_branch,
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
      OR COALESCE(e.regional_branch, '') ILIKE '%' || NULLIF(BTRIM(p_search), '') || '%'
    )
    AND (
      p_departement_id IS NULL
      OR e.departement_id = p_departement_id
    )
    AND (
      NULLIF(BTRIM(p_regional_branch), '') IS NULL
      OR e.regional_branch = NULLIF(BTRIM(p_regional_branch), '')
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

REVOKE ALL ON FUNCTION public.get_payroll_employee_export_rows(text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_employee_export_rows(text, uuid, text, text, text)
TO authenticated, service_role;
