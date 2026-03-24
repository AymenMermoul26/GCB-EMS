ALTER TABLE public."Employe"
ADD COLUMN IF NOT EXISTS universite text;

ALTER TABLE public."Employe"
DISABLE TRIGGER trg_guard_employee_self_update;

UPDATE public."Employe"
SET diplome = CASE
  WHEN diplome IS NULL OR BTRIM(diplome) = '' THEN NULL
  WHEN diplome IN (
    'Licence',
    'Master',
    'Ingenieur d''Etat / Diplome d''ingenieur',
    'Doctorat',
    'BTS / TS',
    'Autre diplome'
  ) THEN diplome
  WHEN LOWER(diplome) LIKE '%master%' THEN 'Master'
  WHEN LOWER(diplome) LIKE '%licence%' THEN 'Licence'
  WHEN LOWER(diplome) LIKE '%ingenieur%' OR LOWER(diplome) LIKE '%ingenie%' THEN 'Ingenieur d''Etat / Diplome d''ingenieur'
  WHEN LOWER(diplome) LIKE '%doctor%' THEN 'Doctorat'
  WHEN LOWER(diplome) LIKE '%bts%' OR LOWER(diplome) LIKE '%technicien%' OR LOWER(diplome) LIKE '%ts%' THEN 'BTS / TS'
  ELSE 'Autre diplome'
END;

UPDATE public."Employe"
SET specialite = CASE
  WHEN specialite IS NULL OR BTRIM(specialite) = '' THEN NULL
  WHEN specialite IN (
    'Ressources humaines',
    'Informatique',
    'Genie logiciel',
    'Reseaux et telecommunications',
    'Finance / Comptabilite',
    'Gestion',
    'Achats / Approvisionnement',
    'Logistique',
    'HSE',
    'Droit',
    'Administration publique',
    'Formation / Ingenierie pedagogique',
    'Statistiques / Data',
    'Petrole / Gaz',
    'Geologie',
    'Maintenance industrielle',
    'Genie civil',
    'Genie mecanique',
    'Genie electrique',
    'Electrotechnique',
    'Automatisation',
    'Chimie industrielle',
    'Autre specialisation'
  ) THEN specialite
  WHEN LOWER(specialite) LIKE '%formation%' OR LOWER(specialite) LIKE '%pedagog%' THEN 'Formation / Ingenierie pedagogique'
  WHEN LOWER(specialite) LIKE '%hse%' OR LOWER(specialite) LIKE '%risque%' OR LOWER(specialite) LIKE '%prevention%' THEN 'HSE'
  WHEN LOWER(specialite) LIKE '%finance%' OR LOWER(specialite) LIKE '%compta%' OR LOWER(specialite) LIKE '%controle%' THEN 'Finance / Comptabilite'
  WHEN LOWER(specialite) LIKE '%achat%' OR LOWER(specialite) LIKE '%approvisionnement%' THEN 'Achats / Approvisionnement'
  WHEN LOWER(specialite) LIKE '%logist%' OR LOWER(specialite) LIKE '%transport%' OR LOWER(specialite) LIKE '%stock%' THEN 'Logistique'
  WHEN LOWER(specialite) LIKE '%support%' OR LOWER(specialite) LIKE '%applicatif%' OR LOWER(specialite) LIKE '%informat%' THEN 'Informatique'
  WHEN LOWER(specialite) LIKE '%reseau%' OR LOWER(specialite) LIKE '%telecom%' THEN 'Reseaux et telecommunications'
  WHEN LOWER(specialite) LIKE '%logiciel%' THEN 'Genie logiciel'
  WHEN LOWER(specialite) LIKE '%ressource%' OR LOWER(specialite) LIKE '%personnel%' OR LOWER(specialite) LIKE '%recrut%' OR LOWER(specialite) LIKE '%carriere%' OR LOWER(specialite) LIKE '%travail%' OR LOWER(specialite) LIKE '%integration%' THEN 'Ressources humaines'
  WHEN LOWER(specialite) LIKE '%stat%' OR LOWER(specialite) LIKE '%data%' OR LOWER(specialite) LIKE '%effectif%' OR LOWER(specialite) LIKE '%planification%' THEN 'Statistiques / Data'
  WHEN LOWER(specialite) LIKE '%administrat%' THEN 'Administration publique'
  WHEN LOWER(specialite) LIKE '%droit%' OR LOWER(specialite) LIKE '%relation%' THEN 'Droit'
  WHEN LOWER(specialite) LIKE '%petrol%' OR LOWER(specialite) LIKE '%gaz%' THEN 'Petrole / Gaz'
  WHEN LOWER(specialite) LIKE '%geolog%' THEN 'Geologie'
  WHEN LOWER(specialite) LIKE '%maintenance%' THEN 'Maintenance industrielle'
  WHEN LOWER(specialite) LIKE '%chimie%' THEN 'Chimie industrielle'
  WHEN LOWER(specialite) LIKE '%electrotech%' THEN 'Electrotechnique'
  WHEN LOWER(specialite) LIKE '%electriq%' THEN 'Genie electrique'
  WHEN LOWER(specialite) LIKE '%automat%' THEN 'Automatisation'
  WHEN LOWER(specialite) LIKE '%civil%' THEN 'Genie civil'
  WHEN LOWER(specialite) LIKE '%mecan%' THEN 'Genie mecanique'
  WHEN LOWER(specialite) LIKE '%gestion%' THEN 'Gestion'
  ELSE 'Autre specialisation'
END;

UPDATE public."Employe"
SET universite = CASE
  WHEN universite IN (
    'USTHB',
    'Universite d''Alger 1',
    'Universite d''Alger 2',
    'Universite d''Alger 3',
    'Universite Mhamed Bougara de Boumerdes',
    'Universite Saad Dahlab de Blida',
    'Universite d''Oran 1 Ahmed Ben Bella',
    'Universite des Sciences et de la Technologie d''Oran Mohamed Boudiaf',
    'Universite Freres Mentouri Constantine 1',
    'Universite Mohamed Khider de Biskra',
    'Universite de Bejaia',
    'Universite Mouloud Mammeri de Tizi Ouzou',
    'Universite Abou Bekr Belkaid de Tlemcen',
    'Universite Kasdi Merbah Ouargla',
    'Universite d''Adrar Ahmed Draia',
    'Centre universitaire d''In Salah',
    'Autre etablissement algerien'
  ) THEN universite
  WHEN universite IS NOT NULL AND BTRIM(universite) <> '' THEN 'Autre etablissement algerien'
  WHEN LOWER(BTRIM(email)) = 'hradmin@gcb.com' THEN 'Universite d''Alger 3'
  WHEN LOWER(BTRIM(email)) = 'yacine.bensaid@gcb.com' THEN 'Universite d''Alger 3'
  WHEN LOWER(BTRIM(email)) = 'amine.kherfi@gcb.com' THEN 'Universite Mhamed Bougara de Boumerdes'
  WHEN LOWER(BTRIM(email)) = 'sara.meziane@gcb.com' THEN 'Universite des Sciences et de la Technologie d''Oran Mohamed Boudiaf'
  WHEN LOWER(BTRIM(email)) = 'lina.boudiaf@gcb.com' THEN 'Universite Freres Mentouri Constantine 1'
  WHEN LOWER(BTRIM(email)) = 'walid.cheriet@gcb.com' THEN 'Universite d''Oran 1 Ahmed Ben Bella'
  WHEN LOWER(BTRIM(email)) = 'ilyes.ferhat@gcb.com' THEN 'Universite Saad Dahlab de Blida'
  WHEN LOWER(BTRIM(email)) = 'ines.rahmani@gcb.com' THEN 'Universite Abou Bekr Belkaid de Tlemcen'
  WHEN LOWER(BTRIM(email)) = 'karim.touati@gcb.com' THEN 'Universite de Bejaia'
  WHEN LOWER(BTRIM(email)) = 'nadia.benali@gcb.com' THEN 'Universite d''Alger 2'
  WHEN LOWER(BTRIM(email)) = 'samir.bouzid@gcb.com' THEN 'Universite d''Alger 2'
  WHEN LOWER(BTRIM(email)) = 'ryma.saadi@gcb.com' THEN 'Universite Mouloud Mammeri de Tizi Ouzou'
  WHEN LOWER(BTRIM(email)) = 'mourad.hamidi@gcb.com' THEN 'Universite Abou Bekr Belkaid de Tlemcen'
  ELSE NULL
END;

ALTER TABLE public."Employe"
ENABLE TRIGGER trg_guard_employee_self_update;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_diplome_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_diplome_check
    CHECK (
      diplome IS NULL
      OR diplome IN (
        'Licence',
        'Master',
        'Ingenieur d''Etat / Diplome d''ingenieur',
        'Doctorat',
        'BTS / TS',
        'Autre diplome'
      )
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_specialite_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_specialite_check
    CHECK (
      specialite IS NULL
      OR specialite IN (
        'Ressources humaines',
        'Informatique',
        'Genie logiciel',
        'Reseaux et telecommunications',
        'Finance / Comptabilite',
        'Gestion',
        'Achats / Approvisionnement',
        'Logistique',
        'HSE',
        'Droit',
        'Administration publique',
        'Formation / Ingenierie pedagogique',
        'Statistiques / Data',
        'Petrole / Gaz',
        'Geologie',
        'Maintenance industrielle',
        'Genie civil',
        'Genie mecanique',
        'Genie electrique',
        'Electrotechnique',
        'Automatisation',
        'Chimie industrielle',
        'Autre specialisation'
      )
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_universite_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_universite_check
    CHECK (
      universite IS NULL
      OR universite IN (
        'USTHB',
        'Universite d''Alger 1',
        'Universite d''Alger 2',
        'Universite d''Alger 3',
        'Universite Mhamed Bougara de Boumerdes',
        'Universite Saad Dahlab de Blida',
        'Universite d''Oran 1 Ahmed Ben Bella',
        'Universite des Sciences et de la Technologie d''Oran Mohamed Boudiaf',
        'Universite Freres Mentouri Constantine 1',
        'Universite Mohamed Khider de Biskra',
        'Universite de Bejaia',
        'Universite Mouloud Mammeri de Tizi Ouzou',
        'Universite Abou Bekr Belkaid de Tlemcen',
        'Universite Kasdi Merbah Ouargla',
        'Universite d''Adrar Ahmed Draia',
        'Centre universitaire d''In Salah',
        'Autre etablissement algerien'
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_employe_diplome
ON public."Employe" (diplome);

CREATE INDEX IF NOT EXISTS idx_employe_specialite
ON public."Employe" (specialite);

CREATE INDEX IF NOT EXISTS idx_employe_universite
ON public."Employe" (universite);

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
  universite text,
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
    e.universite,
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
