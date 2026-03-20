CREATE OR REPLACE FUNCTION public.get_employee_self_profile(p_employee_id uuid)
RETURNS TABLE (
  id uuid,
  departement_id uuid,
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
