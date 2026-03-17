ALTER TABLE public."Employe"
  ADD COLUMN IF NOT EXISTS diplome text,
  ADD COLUMN IF NOT EXISTS specialite text,
  ADD COLUMN IF NOT EXISTS historique_postes text;
