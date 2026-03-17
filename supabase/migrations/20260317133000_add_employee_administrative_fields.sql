ALTER TABLE public."Employe"
  ADD COLUMN IF NOT EXISTS situation_familiale text,
  ADD COLUMN IF NOT EXISTS nombre_enfants integer,
  ADD COLUMN IF NOT EXISTS adresse text,
  ADD COLUMN IF NOT EXISTS numero_securite_sociale text;
