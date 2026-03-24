ALTER TABLE public."Employe"
DISABLE TRIGGER trg_guard_employee_self_update;

UPDATE public."Employe"
SET specialite = 'Droit'
WHERE specialite = 'Ressources humaines'
  AND (
    LOWER(COALESCE(poste, '')) LIKE '%labour relation%'
    OR LOWER(COALESCE(poste, '')) LIKE '%relation%'
    OR LOWER(COALESCE(email, '')) = 'mourad.hamidi@gcb.com'
  );

ALTER TABLE public."Employe"
ENABLE TRIGGER trg_guard_employee_self_update;
