ALTER TABLE public."Employe"
DISABLE TRIGGER trg_guard_employee_self_update;

UPDATE public."Employe"
SET nationalite = CASE
  WHEN nationalite IN (
    'Algerian',
    'Tunisian',
    'Moroccan',
    'Mauritanian',
    'Libyan',
    'Egyptian',
    'French',
    'Italian',
    'Spanish',
    'Turkish',
    'Chinese',
    'Canadian',
    'Other nationality'
  ) THEN nationalite
  WHEN nationalite IS NULL OR BTRIM(nationalite) = '' THEN CASE
    WHEN LOWER(BTRIM(email)) IN (
      'hradmin@gcb.com',
      'yacine.bensaid@gcb.com',
      'amine.kherfi@gcb.com',
      'sara.meziane@gcb.com',
      'lina.boudiaf@gcb.com',
      'walid.cheriet@gcb.com',
      'ilyes.ferhat@gcb.com',
      'ines.rahmani@gcb.com',
      'karim.touati@gcb.com',
      'nadia.benali@gcb.com',
      'samir.bouzid@gcb.com',
      'ryma.saadi@gcb.com',
      'mourad.hamidi@gcb.com'
    ) THEN 'Algerian'
    ELSE NULL
  END
  WHEN LOWER(BTRIM(nationalite)) IN (
    'algerian',
    'algerienne',
    'algerien',
    'algérienne',
    'algérien',
    'algeria',
    'algerie'
  ) THEN 'Algerian'
  WHEN LOWER(BTRIM(nationalite)) IN ('tunisian', 'tunisienne', 'tunisien', 'tunisia', 'tunisie') THEN 'Tunisian'
  WHEN LOWER(BTRIM(nationalite)) IN ('moroccan', 'marocaine', 'marocain', 'morocco', 'maroc') THEN 'Moroccan'
  WHEN LOWER(BTRIM(nationalite)) IN ('mauritanian', 'mauritanienne', 'mauritanien', 'mauritania', 'mauritanie') THEN 'Mauritanian'
  WHEN LOWER(BTRIM(nationalite)) IN ('libyan', 'libyenne', 'libyen', 'libya', 'libye') THEN 'Libyan'
  WHEN LOWER(BTRIM(nationalite)) IN ('egyptian', 'egyptienne', 'egyptien', 'egypt', 'egypte', 'égypte') THEN 'Egyptian'
  WHEN LOWER(BTRIM(nationalite)) IN ('french', 'francaise', 'francais', 'française', 'français', 'france') THEN 'French'
  WHEN LOWER(BTRIM(nationalite)) IN ('italian', 'italienne', 'italien', 'italy', 'italie') THEN 'Italian'
  WHEN LOWER(BTRIM(nationalite)) IN ('spanish', 'espagnole', 'espagnol', 'spain', 'espagne') THEN 'Spanish'
  WHEN LOWER(BTRIM(nationalite)) IN ('turkish', 'turque', 'turc', 'turkey', 'turquie') THEN 'Turkish'
  WHEN LOWER(BTRIM(nationalite)) IN ('chinese', 'chinoise', 'chinois', 'china', 'chine') THEN 'Chinese'
  WHEN LOWER(BTRIM(nationalite)) IN ('canadian', 'canadienne', 'canadien', 'canada') THEN 'Canadian'
  ELSE 'Other nationality'
END;

UPDATE public."Employe"
SET poste = CASE
  WHEN poste IN (
    'HR Administrator',
    'HR Operations Manager',
    'Workforce Planning Analyst',
    'IT Support Engineer',
    'Financial Controller',
    'Procurement Officer',
    'Logistics Coordinator',
    'HSE Specialist',
    'Administrative Supervisor',
    'Career Development Officer',
    'Training Coordinator',
    'Recruitment Specialist',
    'Labour Relations Officer',
    'Payroll Officer',
    'Payroll Manager',
    'Accountant',
    'Administrative Assistant',
    'Department Manager',
    'Engineer',
    'Technician',
    'Team Leader',
    'Operator',
    'Analyst',
    'Other role'
  ) THEN poste
  WHEN poste IS NULL OR BTRIM(poste) = '' THEN CASE
    WHEN LOWER(BTRIM(email)) = 'hradmin@gcb.com' THEN 'HR Administrator'
    WHEN LOWER(BTRIM(email)) = 'yacine.bensaid@gcb.com' THEN 'HR Operations Manager'
    WHEN LOWER(BTRIM(email)) = 'amine.kherfi@gcb.com' THEN 'Workforce Planning Analyst'
    WHEN LOWER(BTRIM(email)) = 'sara.meziane@gcb.com' THEN 'IT Support Engineer'
    WHEN LOWER(BTRIM(email)) = 'lina.boudiaf@gcb.com' THEN 'Financial Controller'
    WHEN LOWER(BTRIM(email)) = 'walid.cheriet@gcb.com' THEN 'Procurement Officer'
    WHEN LOWER(BTRIM(email)) = 'ilyes.ferhat@gcb.com' THEN 'Logistics Coordinator'
    WHEN LOWER(BTRIM(email)) = 'ines.rahmani@gcb.com' THEN 'HSE Specialist'
    WHEN LOWER(BTRIM(email)) = 'karim.touati@gcb.com' THEN 'Administrative Supervisor'
    WHEN LOWER(BTRIM(email)) = 'nadia.benali@gcb.com' THEN 'Career Development Officer'
    WHEN LOWER(BTRIM(email)) = 'samir.bouzid@gcb.com' THEN 'Training Coordinator'
    WHEN LOWER(BTRIM(email)) = 'ryma.saadi@gcb.com' THEN 'Recruitment Specialist'
    WHEN LOWER(BTRIM(email)) = 'mourad.hamidi@gcb.com' THEN 'Labour Relations Officer'
    ELSE NULL
  END
  WHEN LOWER(BTRIM(poste)) IN ('administrateur rh', 'hr administrator') THEN 'HR Administrator'
  WHEN LOWER(BTRIM(poste)) IN ('responsable rh', 'hr operations manager', 'hr manager') THEN 'HR Operations Manager'
  WHEN LOWER(BTRIM(poste)) IN ('workforce planning analyst', 'analyste planification effectifs', 'analyste planification des effectifs') THEN 'Workforce Planning Analyst'
  WHEN LOWER(BTRIM(poste)) IN ('it support engineer', 'ingenieur support informatique', 'ingénieur support informatique', 'support engineer') THEN 'IT Support Engineer'
  WHEN LOWER(BTRIM(poste)) IN ('financial controller', 'controleur financier', 'contrôleur financier') THEN 'Financial Controller'
  WHEN LOWER(BTRIM(poste)) IN ('procurement officer', 'responsable approvisionnement', 'agent approvisionnement', 'acheteur') THEN 'Procurement Officer'
  WHEN LOWER(BTRIM(poste)) IN ('logistics coordinator', 'coordinateur logistique', 'coordonnateur logistique') THEN 'Logistics Coordinator'
  WHEN LOWER(BTRIM(poste)) IN ('hse specialist', 'specialiste hse', 'spécialiste hse', 'agent hse') THEN 'HSE Specialist'
  WHEN LOWER(BTRIM(poste)) IN ('administrative supervisor', 'superviseur administratif', 'responsable administratif') THEN 'Administrative Supervisor'
  WHEN LOWER(BTRIM(poste)) IN ('career development officer', 'charge de carriere', 'chargé de carrière', 'responsable carriere') THEN 'Career Development Officer'
  WHEN LOWER(BTRIM(poste)) IN ('training coordinator', 'coordinateur formation', 'coordonnateur formation', 'responsable formation') THEN 'Training Coordinator'
  WHEN LOWER(BTRIM(poste)) IN ('recruitment specialist', 'specialiste recrutement', 'spécialiste recrutement', 'charge recrutement', 'chargé recrutement') THEN 'Recruitment Specialist'
  WHEN LOWER(BTRIM(poste)) IN ('labour relations officer', 'responsable relations de travail', 'charge relations de travail', 'chargé relations de travail') THEN 'Labour Relations Officer'
  WHEN LOWER(BTRIM(poste)) IN ('payroll officer', 'gestionnaire paie', 'agent paie', 'responsable traitement paie') THEN 'Payroll Officer'
  WHEN LOWER(BTRIM(poste)) IN ('payroll manager', 'responsable paie', 'manager paie') THEN 'Payroll Manager'
  WHEN LOWER(BTRIM(poste)) IN ('accountant', 'comptable') THEN 'Accountant'
  WHEN LOWER(BTRIM(poste)) IN ('administrative assistant', 'assistant administratif', 'assistante administrative') THEN 'Administrative Assistant'
  WHEN LOWER(BTRIM(poste)) IN ('department manager', 'chef de departement', 'chef de département', 'directeur', 'directrice') THEN 'Department Manager'
  WHEN LOWER(BTRIM(poste)) IN ('engineer', 'ingenieur', 'ingénieur') THEN 'Engineer'
  WHEN LOWER(BTRIM(poste)) IN ('technician', 'technicien') THEN 'Technician'
  WHEN LOWER(BTRIM(poste)) IN ('team leader', 'chef equipe', 'chef d''equipe', 'chef d’équipe') THEN 'Team Leader'
  WHEN LOWER(BTRIM(poste)) IN ('operator', 'operateur', 'opérateur') THEN 'Operator'
  WHEN LOWER(BTRIM(poste)) IN ('analyst', 'analyste') THEN 'Analyst'
  ELSE 'Other role'
END;

ALTER TABLE public."Employe"
ENABLE TRIGGER trg_guard_employee_self_update;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_nationalite_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_nationalite_check
    CHECK (
      nationalite IS NULL
      OR nationalite IN (
        'Algerian',
        'Tunisian',
        'Moroccan',
        'Mauritanian',
        'Libyan',
        'Egyptian',
        'French',
        'Italian',
        'Spanish',
        'Turkish',
        'Chinese',
        'Canadian',
        'Other nationality'
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
    WHERE conname = 'employe_poste_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_poste_check
    CHECK (
      poste IS NULL
      OR poste IN (
        'HR Administrator',
        'HR Operations Manager',
        'Workforce Planning Analyst',
        'IT Support Engineer',
        'Financial Controller',
        'Procurement Officer',
        'Logistics Coordinator',
        'HSE Specialist',
        'Administrative Supervisor',
        'Career Development Officer',
        'Training Coordinator',
        'Recruitment Specialist',
        'Labour Relations Officer',
        'Payroll Officer',
        'Payroll Manager',
        'Accountant',
        'Administrative Assistant',
        'Department Manager',
        'Engineer',
        'Technician',
        'Team Leader',
        'Operator',
        'Analyst',
        'Other role'
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_employe_nationalite
ON public."Employe" (nationalite);

CREATE INDEX IF NOT EXISTS idx_employe_poste
ON public."Employe" (poste);
