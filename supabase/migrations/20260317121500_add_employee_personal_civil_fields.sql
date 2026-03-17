ALTER TABLE public."Employe"
  ADD COLUMN IF NOT EXISTS sexe text,
  ADD COLUMN IF NOT EXISTS date_naissance date,
  ADD COLUMN IF NOT EXISTS lieu_naissance text,
  ADD COLUMN IF NOT EXISTS nationalite text;
