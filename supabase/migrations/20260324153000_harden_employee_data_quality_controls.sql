ALTER TABLE public."Employe"
DISABLE TRIGGER trg_guard_employee_self_update;

UPDATE public."Employe"
SET regional_branch = CASE
  WHEN regional_branch IS NULL OR BTRIM(regional_branch) = '' THEN NULL
  WHEN regional_branch IN (
    'Alger (El Harrach, Oued Smar)',
    'Boumerdès',
    'Arzew',
    'Hassi Messaoud',
    'Hassi R’Mel',
    'In Salah',
    'Adrar',
    'In Amenas'
  ) THEN regional_branch
  WHEN LOWER(BTRIM(regional_branch)) IN ('boumerdes', 'boumerdès', 'boumerdã¨s') THEN 'Boumerdès'
  WHEN LOWER(BTRIM(regional_branch)) IN ('arzew') THEN 'Arzew'
  WHEN LOWER(BTRIM(regional_branch)) IN ('hassi messaoud') THEN 'Hassi Messaoud'
  WHEN LOWER(BTRIM(regional_branch)) IN ('hassi r''mel', 'hassi r’mel', 'hassi râ€™mel') THEN 'Hassi R’Mel'
  WHEN LOWER(BTRIM(regional_branch)) IN ('in salah') THEN 'In Salah'
  WHEN LOWER(BTRIM(regional_branch)) IN ('adrar') THEN 'Adrar'
  WHEN LOWER(BTRIM(regional_branch)) IN ('in amenas') THEN 'In Amenas'
  WHEN LOWER(BTRIM(regional_branch)) LIKE '%el harrach%'
    OR LOWER(BTRIM(regional_branch)) LIKE '%oued smar%'
    OR LOWER(BTRIM(regional_branch)) = 'alger'
  THEN 'Alger (El Harrach, Oued Smar)'
  ELSE regional_branch
END;

UPDATE public."Employe"
SET sexe = CASE
  WHEN sexe IS NULL OR BTRIM(sexe) = '' THEN NULL
  WHEN sexe IN ('M', 'F') THEN sexe
  WHEN LOWER(BTRIM(sexe)) IN ('m', 'male', 'masculin', 'homme') THEN 'M'
  WHEN LOWER(BTRIM(sexe)) IN ('f', 'female', 'feminin', 'féminin', 'femme') THEN 'F'
  ELSE sexe
END;

UPDATE public."Employe"
SET situation_familiale = CASE
  WHEN situation_familiale IS NULL OR BTRIM(situation_familiale) = '' THEN NULL
  WHEN situation_familiale IN ('Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)') THEN situation_familiale
  WHEN LOWER(BTRIM(situation_familiale)) IN ('célibataire', 'celibataire', 'cã©libataire') THEN 'Célibataire'
  WHEN LOWER(BTRIM(situation_familiale)) IN ('marié(e)', 'marie(e)', 'mariã©(e)') THEN 'Marié(e)'
  WHEN LOWER(BTRIM(situation_familiale)) IN ('divorcé(e)', 'divorce(e)', 'divorcã©(e)') THEN 'Divorcé(e)'
  WHEN LOWER(BTRIM(situation_familiale)) IN ('veuf(ve)', 'veuf', 'veuve', 'widowed') THEN 'Veuf(ve)'
  ELSE situation_familiale
END;

UPDATE public."Employe"
SET categorie_professionnelle = CASE
  WHEN categorie_professionnelle IS NULL OR BTRIM(categorie_professionnelle) = '' THEN NULL
  WHEN categorie_professionnelle IN ('Cadre', 'Agent') THEN categorie_professionnelle
  WHEN LOWER(BTRIM(categorie_professionnelle)) IN ('cadre', 'executive') THEN 'Cadre'
  WHEN LOWER(BTRIM(categorie_professionnelle)) IN ('agent') THEN 'Agent'
  ELSE categorie_professionnelle
END;

UPDATE public."Employe"
SET type_contrat = CASE
  WHEN type_contrat IS NULL OR BTRIM(type_contrat) = '' THEN NULL
  WHEN type_contrat IN ('CDI', 'CDD') THEN type_contrat
  WHEN LOWER(BTRIM(type_contrat)) IN ('cdi', 'permanent') THEN 'CDI'
  WHEN LOWER(BTRIM(type_contrat)) IN ('cdd', 'fixed-term', 'fixed term') THEN 'CDD'
  ELSE type_contrat
END;

UPDATE public."Employe"
SET email = NULLIF(LOWER(BTRIM(email)), '')
WHERE email IS NOT NULL;

UPDATE public."Employe"
SET telephone = NULLIF(REGEXP_REPLACE(BTRIM(telephone), '\s+', '', 'g'), '')
WHERE telephone IS NOT NULL;

ALTER TABLE public."Employe"
ENABLE TRIGGER trg_guard_employee_self_update;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_sexe_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_sexe_check
    CHECK (
      sexe IS NULL
      OR sexe IN ('M', 'F')
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_situation_familiale_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_situation_familiale_check
    CHECK (
      situation_familiale IS NULL
      OR situation_familiale IN ('Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)')
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_categorie_professionnelle_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_categorie_professionnelle_check
    CHECK (
      categorie_professionnelle IS NULL
      OR categorie_professionnelle IN ('Cadre', 'Agent')
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employe_type_contrat_check'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
    ADD CONSTRAINT employe_type_contrat_check
    CHECK (
      type_contrat IS NULL
      OR type_contrat IN ('CDI', 'CDD')
    );
  END IF;
END
$$;
