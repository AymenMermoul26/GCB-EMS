-- Auto-generate Employe.matricule with a concurrency-safe sequence.
-- Format: GCB-000001, GCB-000002, ...
-- Manual override remains supported when matricule is provided.

CREATE SEQUENCE IF NOT EXISTS public.employe_matricule_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- Align sequence with existing data when matricules follow GCB-XXXXXX format.
-- Non-matching existing matricules are intentionally ignored.
DO $$
DECLARE
  max_matricule_number bigint;
BEGIN
  SELECT MAX((regexp_match(matricule, '^GCB-(\d{6})$'))[1]::bigint)
  INTO max_matricule_number
  FROM public."Employe"
  WHERE matricule ~ '^GCB-[0-9]{6}$';

  IF max_matricule_number IS NULL THEN
    PERFORM setval('public.employe_matricule_seq', 1, false);
  ELSE
    PERFORM setval('public.employe_matricule_seq', max_matricule_number, true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.next_employe_matricule()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number bigint;
BEGIN
  next_number := nextval('public.employe_matricule_seq');
  RETURN 'GCB-' || lpad(next_number::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_employe_matricule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.matricule IS NULL OR btrim(NEW.matricule) = '' THEN
    NEW.matricule := public.next_employe_matricule();
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_employe_assign_matricule'
      AND tgrelid = 'public."Employe"'::regclass
  ) THEN
    CREATE TRIGGER trg_employe_assign_matricule
    BEFORE INSERT ON public."Employe"
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_employe_matricule();
  END IF;
END
$$;
