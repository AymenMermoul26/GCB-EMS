ALTER TABLE public."Employe"
  ADD COLUMN IF NOT EXISTS categorie_professionnelle text,
  ADD COLUMN IF NOT EXISTS type_contrat text,
  ADD COLUMN IF NOT EXISTS date_recrutement date;
