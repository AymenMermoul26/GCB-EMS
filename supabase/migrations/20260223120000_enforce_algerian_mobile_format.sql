-- Enforce strict Algerian mobile format for Employe.telephone.
-- Expected pattern: +213[5|6|7]XXXXXXXX
-- Example valid values: +213612345678, +213712345678, +213512345678

-- Detection query you can run manually before this migration:
-- SELECT id, matricule, telephone
-- FROM public."Employe"
-- WHERE telephone IS NOT NULL
--   AND telephone !~ '^\+213[567][0-9]{8}$';

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*)
  INTO invalid_count
  FROM public."Employe"
  WHERE telephone IS NOT NULL
    AND telephone !~ '^\+213[567][0-9]{8}$';

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add ck_employe_telephone_format: % existing row(s) have invalid telephone values.',
      invalid_count;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_employe_telephone_format'
      AND conrelid = 'public."Employe"'::regclass
  ) THEN
    ALTER TABLE public."Employe"
      ADD CONSTRAINT ck_employe_telephone_format
      CHECK (
        telephone IS NULL
        OR telephone ~ '^\+213[567][0-9]{8}$'
      );
  END IF;
END
$$;
